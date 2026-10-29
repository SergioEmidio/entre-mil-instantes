// =====================================================================
// Entre Mil Instantes · aba Rádio
// Cada faixa é uma memória: capa (foto), título, "artista" e a tua voz.
// =====================================================================

import { h, campo, icone, confirmar, avisar } from "../ui.js";
import { campoFoto } from "../campo-foto.js";
import { campoAudio } from "../campo-audio.js";
import { rascunho, alterar, novoIdentificador } from "../estado.js";
import { linkGuardado, linkDe } from "../midia.js";

const MAXIMO = 12;
let abrirId = null;

const minSeg = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export function desenharRadio(area, redesenhar) {
  const r = rascunho();
  const lista = r.radio.faixas;
  const total = lista.reduce((soma, f) => soma + (f.audio && f.duracao ? f.duracao : 0), 0);

  area.append(
    h("div", { class: "area-titulo" }, h("h2", null, "A Rádio dela"), h("p", null, `${lista.length} de ${MAXIMO}`)),
    h(
      "p",
      { class: "area-intro" },
      "Cada faixa é uma memória contada pela tua voz (uns 30 segundos). Grava direto pelo celular ou envia um áudio. Faixa sem áudio não aparece para ela."
    ),
    total ? h("p", { class: "bloco-dica" }, `Duração total da rádio: ${minSeg(total)}`) : null
  );

  const caixa = h("div", { class: "lista" });
  lista.forEach((faixa, indice) => caixa.append(item(faixa, indice, lista.length, redesenhar, r.autor)));
  area.append(caixa);

  area.append(
    h(
      "button",
      {
        class: "botao-adicionar",
        type: "button",
        disabled: lista.length >= MAXIMO,
        onClick: () => {
          const id = novoIdentificador();
          alterar((d) => {
            d.radio.faixas.push({ id, titulo: "", artista: "", capa: null, audio: null, duracao: null });
          });
          abrirId = id;
          redesenhar();
        },
      },
      icone("mais"),
      "Adicionar faixa"
    )
  );

  if (abrirId) {
    const aberto = area.querySelector(`[data-id="${abrirId}"]`);
    abrirId = null;
    if (aberto) aberto.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function item(faixa, indice, total, redesenhar, autor) {
  const miniatura = h("div", { class: "item-miniatura item-miniatura--quadrada" });
  const sobre = h("span", { class: "item-sobre" });
  const principal = h("span", { class: "item-principal" });

  function atualizarResumo() {
    sobre.textContent = `Faixa ${String(indice + 1).padStart(2, "0")}${faixa.audio && faixa.duracao ? ` · ${minSeg(faixa.duracao)}` : ""}${faixa.audio ? "" : " · sem áudio"}`;
    principal.textContent = faixa.titulo || "Sem título ainda";
    principal.classList.toggle("item-principal--vazio", !faixa.titulo);
    miniatura.replaceChildren();
    const link = linkGuardado("midia", faixa.capa);
    if (link) miniatura.append(h("img", { src: link, alt: "" }));
    else if (faixa.capa) {
      linkDe("midia", faixa.capa).then((l) => {
        if (l) miniatura.replaceChildren(h("img", { src: l, alt: "" }));
      });
    }
  }

  const mudar = (fn) =>
    alterar((d) => {
      const alvo = d.radio.faixas.find((f) => f.id === faixa.id);
      if (alvo) fn(alvo);
    });

  const mover = (passo) => {
    alterar((d) => {
      const lista = d.radio.faixas;
      const de = lista.findIndex((f) => f.id === faixa.id);
      const para = de + passo;
      if (de < 0 || para < 0 || para >= lista.length) return;
      const [movida] = lista.splice(de, 1);
      lista.splice(para, 0, movida);
    });
    abrirId = faixa.id;
    redesenhar();
  };

  const excluir = async () => {
    const sim = await confirmar("Esta faixa sai do rascunho.", { titulo: "Excluir esta faixa?" });
    if (!sim) return;
    alterar((d) => {
      d.radio.faixas = d.radio.faixas.filter((f) => f.id !== faixa.id);
    });
    redesenhar();
    avisar("Faixa excluída.");
  };

  const corpo = h(
    "div",
    { class: "item-corpo" },
    campoFoto({
      rotulo: "Capa da faixa (uma foto de vocês)",
      caminho: faixa.capa,
      pasta: "radio",
      aoMudar: (c) => {
        mudar((f) => { f.capa = c; });
        atualizarResumo();
      },
    }),
    campo({
      rotulo: "Título da faixa",
      valor: faixa.titulo,
      max: 60,
      placeholder: "Ex.: O dia em que a gente se conheceu",
      aoMudar: (v) => {
        mudar((f) => { f.titulo = v; });
        atualizarResumo();
      },
    }),
    campo({
      rotulo: "Artista (aparece embaixo do título)",
      valor: faixa.artista,
      max: 40,
      placeholder: autor || "Sérgio",
      dica: `Vazio = "${autor || "Sérgio"}"`,
      aoMudar: (v) => mudar((f) => { f.artista = v; }),
    }),
    campoAudio({
      rotulo: "Tua voz",
      caminho: faixa.audio,
      duracao: faixa.duracao,
      pasta: "radio",
      gravar: true,
      aoMudar: (c, d) => {
        mudar((f) => {
          f.audio = c;
          f.duracao = d;
        });
        atualizarResumo();
      },
    }),
    h(
      "div",
      { class: "item-acoes" },
      h("button", { class: "botao-pequeno", type: "button", disabled: indice === 0, onClick: () => mover(-1) }, icone("cima", 16), "Subir"),
      h("button", { class: "botao-pequeno", type: "button", disabled: indice === total - 1, onClick: () => mover(1) }, icone("baixo", 16), "Descer"),
      h("span", { class: "espaco" }),
      h("button", { class: "botao-pequeno botao-pequeno--perigo", type: "button", onClick: excluir }, icone("lixo", 16), "Excluir")
    )
  );

  atualizarResumo();

  return h(
    "details",
    { class: "item", "data-id": faixa.id, open: faixa.id === abrirId },
    h(
      "summary",
      { class: "item-resumo" },
      h("span", { class: "item-numero" }, String(indice + 1)),
      miniatura,
      h("span", { class: "item-textos" }, sobre, principal),
      h("span", { class: "item-seta" }, icone("seta", 18))
    ),
    corpo
  );
}
