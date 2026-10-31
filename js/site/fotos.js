// =====================================================================
// Entre Mil Instantes · site/fotos.js
// As fotos ficam privadas no Supabase. Aqui o site pede os links (que
// valem por 12 horas) e já baixa as fotos durante o carregamento, para
// os stories passarem sem ficar esperando.
// =====================================================================

import { linksDosArquivos } from "../supabase.js";

const VALIDADE = 60 * 60 * 12;     // 12 horas
const LIMITE_ESPERA = 15000;        // nunca segura o carregamento mais que isso

const links = new Map();

export function linkDaFoto(caminho) {
  return caminho ? links.get(caminho) || null : null;
}

// Todas as fotos do site (do conteúdo publicado), na ordem em que aparecem.
export function fotosDoConteudo(conteudo) {
  const c = conteudo || {};
  const retro = c.retrospectiva || {};
  const musica = retro.musica || {};
  const antesAgora = c.antes_agora || {};
  const stories = Array.isArray(c.stories) ? c.stories : [];
  const faixas = c.radio && Array.isArray(c.radio.faixas) ? c.radio.faixas : [];
  return [
    musica.capa,
    ...stories.map((s) => s && s.foto),
    antesAgora.antes,
    antesAgora.agora,
    c.radio && c.radio.capa,
    // as capas das faixas carregam só quando aparecem (pode ter muitas)
    c.cartao && c.cartao.foto,
  ].filter((caminho) => typeof caminho === "string" && caminho);
}

// Áudios (música do story e faixas da rádio): só pega o link, não baixa antes.
export function audiosDoConteudo(conteudo) {
  const c = conteudo || {};
  const musica = (c.retrospectiva && c.retrospectiva.musica) || {};
  const faixas = c.radio && Array.isArray(c.radio.faixas) ? c.radio.faixas : [];
  const cartas = Array.isArray(c.cartas) ? c.cartas : [];
  const stories = Array.isArray(c.stories) ? c.stories : [];
  return [musica.audio, ...faixas.map((f) => f && f.audio), ...faixas.map((f) => f && f.capa), ...cartas.map((x) => x && x.audio), ...stories.map((s) => s && s.video)].filter(
    (caminho) => typeof caminho === "string" && caminho
  );
}

function baixar(url) {
  return new Promise((resolver) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (typeof img.decode === "function") img.decode().catch(() => {}).finally(resolver);
      else resolver();
    };
    img.onerror = resolver;   // uma foto com problema não trava o resto
    img.src = url;
  });
}

// Pede os links e baixa as fotos. Nunca dá erro: no pior caso, a foto
// aparece um pouco depois.
export async function prepararFotos(conteudo) {
  const fotos = [...new Set(fotosDoConteudo(conteudo))];
  const caminhos = [...new Set([...fotos, ...audiosDoConteudo(conteudo)])].filter((c) => !links.has(c));
  if (!caminhos.length) return;

  const trabalho = (async () => {
    try {
      const mapa = await linksDosArquivos("midia", caminhos, VALIDADE);
      for (const [caminho, link] of Object.entries(mapa)) links.set(caminho, link);
      await Promise.all(fotos.map((c) => (links.has(c) ? baixar(links.get(c)) : null)));
    } catch (erro) {
      console.error("[Entre Mil Instantes] Não consegui preparar as fotos:", (erro && erro.original) || erro);
    }
  })();

  await Promise.race([trabalho, new Promise((r) => setTimeout(r, LIMITE_ESPERA))]);
}
