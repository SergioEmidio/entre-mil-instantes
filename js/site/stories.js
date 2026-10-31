// =====================================================================
// Entre Mil Instantes · site/stories.js
// Os stories (igual ao Instagram):
//   · barrinhas no topo, passam sozinhos
//   · toque à direita = próximo · toque à esquerda = anterior
//   · segurar = pausa
//   · no computador: setas do teclado e espaço
// Ordem: Retrospectiva (dias, música, detalhes) → memórias com foto.
// =====================================================================

import { h, texto } from "./dom.js";
import { diasDesde, mesesDesde, dataCurta, dataPorExtenso } from "./datas.js";
import { linkDaFoto } from "./fotos.js";
import {
  entrarNoStoryDaMusica,
  sairDoStoryDaMusica,
  pausarMusica,
  continuarMusica,
  somDesligado,
  aoMudarSom,
  silenciarSemGuardar,
} from "./som.js";

const DURACAO_RETRO = 7000;
const TRECHO_MAXIMO = 30;      // segundos de música no story
const DURACAO_MEMORIA = 6500;
const VIDEO_MAXIMO = 60;       // segundos
const TOQUE_MAXIMO = 250;      // até isso é toque; mais que isso foi "segurar"
const AREA_VOLTAR = 0.3;       // 30% da esquerda volta

// ---------------------------------------------------------------------
// Monta a lista de stories a partir do conteúdo
// ---------------------------------------------------------------------
export function montarListaDeStories(conteudo) {
  const c = conteudo || {};
  const datas = c.datas || {};
  const retro = c.retrospectiva || {};
  const musica = retro.musica || {};
  const lista = [];

  // 1. Dias juntos (sempre que houver a data)
  if (dataCurta(datas.conhecemos)) {
    lista.push({ secao: "Nossa retrospectiva", tema: "vinho", duracao: DURACAO_RETRO, montar: () => slideDias(datas) });
  }

  // 2. Nossa música (só se tiver o nome). Com áudio, o story dura o trecho.
  if (texto(musica.nome)) {
    const item = { secao: "Nossa retrospectiva", tema: "champanhe", duracao: DURACAO_RETRO, montar: () => slideMusica(musica) };
    if (musica.audio && linkDaFoto(musica.audio)) {
      const total = Number(musica.duracao) || 0;
      const restante = total ? total - (Number(musica.inicio) || 0) : TRECHO_MAXIMO;
      item.duracao = Math.max(DURACAO_RETRO, Math.min(TRECHO_MAXIMO, restante) * 1000);
      item.aoEntrar = entrarNoStoryDaMusica;
      item.aoSair = sairDoStoryDaMusica;
      item.aoPausar = pausarMusica;
      item.aoContinuar = continuarMusica;
    }
    lista.push(item);
  }

  // 3. Detalhes: cada um no seu story (só os que estiverem preenchidos).
  //    Separados por ";" viram etiquetas (apelidos) e balões (frases).
  const apelidos = partes(retro.apelido);
  if (apelidos.length) {
    lista.push({
      secao: "Nossos detalhes",
      tema: "azul",
      duracao: Math.min(12000, Math.max(DURACAO_RETRO, 3500 + apelidos.length * 900)),
      montar: () => slideApelidos(apelidos),
    });
  }
  const lugar = texto(retro.lugar);
  if (lugar) {
    lista.push({ secao: "Nossos detalhes", tema: "vinho", duracao: DURACAO_RETRO, montar: () => slideLugar(lugar) });
  }
  const frases = partes(retro.frase_dela);
  if (frases.length) {
    lista.push({
      secao: "Nossos detalhes",
      tema: "azul",
      duracao: Math.min(15000, Math.max(DURACAO_RETRO, 3800 + frases.length * 1100)),
      montar: () => slideFrases(frases, texto(c.nome)),
    });
  }

  // 4. Memórias (foto ou vídeo)
  const memorias = (Array.isArray(c.stories) ? c.stories : []).filter((s) => s && (s.foto || s.video));
  for (const story of memorias) {
    if (story.video && linkDaFoto(story.video)) {
      lista.push(itemDeVideo(story));
    } else if (story.foto) {
      lista.push({ secao: "Pequenos infinitos", tema: "foto", duracao: DURACAO_MEMORIA, montar: () => slideMemoria(story) });
    }
  }

  return lista;
}

// ---------------------------------------------------------------------
// Cada tipo de story
// ---------------------------------------------------------------------
function slideDias(datas) {
  const dias = diasDesde(datas.conhecemos);
  const meses = mesesDesde(datas.namoro);
  const numero = h("p", { class: "st-numero", "data-contar": String(dias) }, "0");

  return h(
    "div",
    { class: "st st--centro" },
    h("p", { class: "st-intro" }, `Desde que a gente se conheceu, em ${dataCurta(datas.conhecemos, "/")}, foram`),
    numero,
    h("p", { class: "st-titulo" }, dias === 1 ? "dia ao teu lado." : "dias ao teu lado."),
    meses >= 1 && dataPorExtenso(datas.namoro)
      ? h(
          "div",
          { class: "st-caixa" },
          h("span", { class: "st-caixa-numero" }, String(meses)),
          h(
            "span",
            { class: "st-caixa-textos" },
            h("span", { class: "st-caixa-titulo" }, meses === 1 ? "mês de namoro" : "meses de namoro"),
            h("span", { class: "st-caixa-sub" }, `desde ${dataPorExtenso(datas.namoro)}`)
          )
        )
      : null,
    h("p", { class: "st-texto" }, "E eu lembro de muito mais deles do que tu imaginas.")
  );
}

function slideMusica(musica) {
  const link = linkDaFoto(musica.capa);
  return h(
    "div",
    { class: "st st--centro" },
    h("h2", { class: "st-titulo st-titulo--m" }, "A música que mais tocou na nossa história"),
    h("div", { class: "st-capa" }, link ? h("img", { src: link, alt: "" }) : null),
    h(
      "div",
      { class: "st-musica" },
      h("p", { class: "st-musica-nome" }, texto(musica.nome)),
      texto(musica.artista) ? h("p", { class: "st-musica-artista" }, texto(musica.artista)) : null
    ),
    texto(musica.frase) ? h("p", { class: "st-citacao" }, texto(musica.frase)) : null
  );
}

// "Meu neném; Minha carente" → ["Meu neném", "Minha carente"]
function partes(valor) {
  return texto(valor)
    .split(/\s*[;\n]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function iconeSvg(caminho, tamanho) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(tamanho));
  svg.setAttribute("height", String(tamanho));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", caminho);
  svg.append(p);
  return svg;
}

// Apelidos: etiquetas que vão aparecendo
function slideApelidos(apelidos) {
  const um = apelidos.length === 1;
  return h(
    "div",
    { class: "st st--centro st--encaixar st--apelidos" },
    h("p", { class: "st-rotulo" }, um ? "O apelido que eu mais te chamo" : "Os apelidos que eu mais te chamo"),
    h("h2", { class: "st-titulo st-encaixe-titulo" }, "Do jeitinho que só eu te chamo"),
    h(
      "ul",
      { class: "st-chips" },
      apelidos.map((apelido, i) => h("li", { class: "st-chip", style: `--i: ${i}` }, apelido))
    )
  );
}

// Lugar: "Marco Zero, onde tudo começou" → nome grande + subtítulo
function slideLugar(lugar) {
  const corte = lugar.search(/\s*[,–—-]\s+/);
  const nome = corte > 0 ? lugar.slice(0, corte) : lugar;
  const sub = corte > 0 ? lugar.slice(corte).replace(/^\s*[,–—-]\s*/, "") : "";
  return h(
    "div",
    { class: "st st--centro st--encaixar st--lugar" },
    h("p", { class: "st-rotulo" }, "Nosso lugar favorito"),
    h(
      "span",
      { class: "st-pino" },
      h("span", { class: "st-pino-onda" }),
      iconeSvg("M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", 40)
    ),
    h("h2", { class: "st-lugar-nome" }, nome),
    sub ? h("p", { class: "st-lugar-sub" }, sub) : null
  );
}

// Frases: balões de conversa, um por vez, como se ela estivesse digitando
function slideFrases(frases, nome) {
  const quem = nome || "Tu";
  const fim = (frases.length - 1) * 0.9 + 0.6;
  return h(
    "div",
    { class: "st st--centro st--encaixar st--frases" },
    h("p", { class: "st-rotulo" }, frases.length === 1 ? "A frase que tu mais falas" : "As frases que tu mais falas"),
    h(
      "div",
      { class: "st-chat", style: `--fim: ${fim}s` },
      h(
        "div",
        { class: "st-chat-cabeca" },
        h("span", { class: "st-chat-avatar", "aria-hidden": "true" }, quem[0]),
        h(
          "span",
          { class: "st-chat-quem" },
          h("span", { class: "st-chat-nome" }, quem),
          h(
            "span",
            { class: "st-chat-status" },
            h("span", { class: "st-chat-digitando" }, "digitando…"),
            h("span", { class: "st-chat-online" }, "online")
          )
        )
      ),
      h(
        "ul",
        { class: "st-baloes" },
        frases.map((frase, i) =>
          h("li", { class: `st-balao${i === frases.length - 1 ? " st-balao--ultimo" : ""}`, style: `--i: ${i}` }, frase)
        )
      )
    )
  );
}

// Legenda que ainda passa do espaço dela: diminui um pouco mais a letra.
function encaixarLegenda(raiz) {
  const leg = raiz.querySelector(".st-legenda");
  if (!leg) return;
  let escala = 1;
  leg.style.setProperty("--escala", "1");
  for (let i = 0; i < 10 && leg.scrollHeight > leg.clientHeight + 1 && escala > 0.6; i++) {
    escala = Math.round((escala - 0.05) * 100) / 100;
    leg.style.setProperty("--escala", String(escala));
  }
}

// Diminui o texto até caber na tela (stories não rolam).
function encaixar(raiz) {
  encaixarLegenda(raiz);
  const alvo = raiz.classList.contains("st--encaixar") ? raiz : null;
  if (!alvo) return;
  let escala = 1;
  alvo.classList.remove("st--compacto");
  alvo.style.setProperty("--escala", "1");
  const passa = () => alvo.scrollHeight > alvo.clientHeight + 1;
  for (let i = 0; i < 12 && passa() && escala > 0.6; i++) {
    escala = Math.round((escala - 0.05) * 100) / 100;
    alvo.style.setProperty("--escala", String(escala));
  }
  // Ainda não coube (muito texto em tela pequena): tira os enfeites e aperta mais.
  if (passa()) {
    alvo.classList.add("st--compacto");
    for (let i = 0; i < 12 && passa() && escala > 0.4; i++) {
      escala = Math.round((escala - 0.05) * 100) / 100;
      alvo.style.setProperty("--escala", String(escala));
    }
  }
}

function legenda(story) {
  const tag = texto(story.tag);
  const frase = texto(story.frase);
  if (!tag && !frase) return null;
  const tamanho = tag.length * 0.5 + frase.length;
  const classe = tamanho > 110 ? "st-legenda st-legenda--longa" : tamanho > 60 ? "st-legenda st-legenda--media" : "st-legenda";
  return h(
    "div",
    { class: classe },
    tag ? h("p", { class: "st-legenda-tag" }, tag) : null,
    frase ? h("p", { class: "st-legenda-frase" }, `“${frase}”`) : null
  );
}

function slideMemoria(story) {
  const link = linkDaFoto(story.foto);
  const alt = texto(story.frase) || texto(story.tag) || "Foto de nós dois";
  return h(
    "div",
    { class: "st st--foto" },
    // Fundo: a mesma foto, desfocada, preenchendo a tela.
    h("div", { class: "st-foto" }, link ? h("img", { class: "st-foto-fundo", src: link, alt: "", "aria-hidden": "true" }) : null),
    // Frente: a foto inteira, sem cortar nada.
    h("div", { class: "st-foto-inteira" }, link ? h("img", { src: link, alt }) : null),
    legenda(story)
  );
}

// ---------------------------------------------------------------------
// Story com vídeo (com o som do vídeo)
// ---------------------------------------------------------------------
let videoAtual = null;

// Botão de som do topo: liga/desliga o som do vídeo que está tocando.
aoMudarSom((mudo) => {
  if (videoAtual) videoAtual.muted = mudo;
});

function tocarVideo(video) {
  video.muted = somDesligado();
  const promessa = video.play();
  if (promessa && typeof promessa.catch === "function") {
    promessa.catch(() => {
      // O celular não deixou tocar com som: toca sem som; o botão liga.
      if (!video.isConnected || video.muted) return;
      silenciarSemGuardar();
      video.muted = true;
      const outra = video.play();
      if (outra && typeof outra.catch === "function") outra.catch(() => {});
    });
  }
}

function slideVideo(story) {
  const capa = linkDaFoto(story.foto);
  const alt = texto(story.frase) || texto(story.tag) || "Vídeo de nós dois";
  const video = h("video", {
    class: "st-video",
    src: linkDaFoto(story.video),
    poster: capa || null,
    preload: "auto",
    playsinline: true,
    "webkit-playsinline": true,
    "aria-label": alt,
  });
  video.playsInline = true;
  const raiz = h(
    "div",
    { class: "st st--foto st--video st--esperando" },
    h("div", { class: "st-foto" }, capa ? h("img", { class: "st-foto-fundo", src: capa, alt: "", "aria-hidden": "true" }) : null),
    h("div", { class: "st-foto-inteira" }, video, h("span", { class: "st-carregando", "aria-hidden": "true" })),
    legenda(story)
  );
  const esperando = (sim) => raiz.classList.toggle("st--esperando", sim);
  video.addEventListener("waiting", () => esperando(true));
  video.addEventListener("playing", () => esperando(false));
  video.addEventListener("canplay", () => { if (!video.paused) esperando(false); });
  video.addEventListener("error", () => esperando(false));
  return { raiz, video };
}

function itemDeVideo(story) {
  let video = null;
  let terminou = false;
  let falhou = false;
  const segundos = Math.max(3, Math.min(VIDEO_MAXIMO, Number(story.duracao) || 15));
  const item = { secao: "Pequenos infinitos", tema: "foto", duracao: segundos * 1000 };

  item.montar = () => {
    const { raiz, video: v } = slideVideo(story);
    video = v;
    terminou = false;
    falhou = false;
    v.addEventListener("ended", () => { terminou = true; });
    v.addEventListener("error", () => { falhou = true; });
    return raiz;
  };
  item.aoEntrar = () => {
    if (!video) return;
    videoAtual = video;
    tocarVideo(video);
  };
  item.aoSair = () => {
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (videoAtual === video) videoAtual = null;
    video = null;
  };
  item.aoPausar = () => {
    if (video) video.pause();
  };
  item.aoContinuar = () => {
    if (video && !terminou) tocarVideo(video);
  };
  // A barrinha anda com o vídeo (se ele travar para carregar, ela espera).
  item.progresso = () => {
    if (!video || falhou) return null;
    if (terminou) return 1;
    const d = video.duration;
    return Number.isFinite(d) && d > 0 ? video.currentTime / d : 0;
  };
  item.acabou = () => terminou;
  return item;
}

// Número subindo (ex.: 0 → 533) quando o story aparece.
function animarNumeros(raiz) {
  const menos = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const el of raiz.querySelectorAll("[data-contar]")) {
    const alvo = Number(el.dataset.contar) || 0;
    if (menos || alvo === 0) {
      el.textContent = String(alvo);
      continue;
    }
    const inicio = performance.now();
    const duracao = 1300;
    const passo = (agora) => {
      const f = Math.min(1, (agora - inicio) / duracao);
      el.textContent = String(Math.round(alvo * (1 - Math.pow(1 - f, 3))));
      if (f < 1 && el.isConnected) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }
}

// ---------------------------------------------------------------------
// O "tocador" de stories
// ---------------------------------------------------------------------
// Mostra a lista e devolve uma promessa que termina quando ela passa do último.
// comecarEm: índice inicial (−1 = último).
export function tocarStories(lista, comecarEm = 0) {
  const el = {
    palco: document.getElementById("stories-palco"),
    barras: document.getElementById("stories-barras"),
    secao: document.getElementById("stories-secao"),
    conta: document.getElementById("stories-conta"),
    slide: document.getElementById("stories-slide"),
    toque: document.getElementById("stories-toque"),
    dica: document.getElementById("stories-dica"),
    anterior: document.getElementById("stories-anterior"),
    proximo: document.getElementById("stories-proximo"),
    pausar: document.getElementById("stories-pausar"),
  };

  return new Promise((terminar) => {
    if (!lista.length) {
      terminar();
      return;
    }

    let atual = comecarEm < 0 ? lista.length - 1 : Math.min(comecarEm, lista.length - 1);
    let decorrido = 0;
    let ultimoQuadro = 0;
    let pausadoPorToque = false;
    let pausadoPorBotao = false;
    let pausadoPorAba = false;
    let encerrado = false;
    let quadro = 0;

    // Barrinhas
    el.barras.replaceChildren(
      ...lista.map(() => h("span", { class: "stories-barra" }, h("span", { class: "stories-barra-cheia" })))
    );
    const cheias = [...el.barras.querySelectorAll(".stories-barra-cheia")];
    // Muitos stories: barrinhas mais juntinhas (cabem até no celular pequeno).
    el.barras.classList.toggle("stories-barras--muitas", lista.length > 16);

    const pausado = () => pausadoPorToque || pausadoPorBotao || pausadoPorAba;
    let inicioToque = 0;
    // Para o som: um toque rápido (passar de story) não conta como pausa,
    // senão a música corta de uma vez em vez de sumir devagar.
    const pausadoParaSom = () =>
      pausadoPorBotao || pausadoPorAba ||
      (pausadoPorToque && performance.now() - inicioToque > TOQUE_MAXIMO);

    function desenharBarras() {
      const fracao = Math.min(1, decorrido / lista[atual].duracao);
      cheias.forEach((barra, i) => {
        const valor = i < atual ? 1 : i > atual ? 0 : fracao;
        barra.style.transform = `scaleX(${valor})`;
      });
    }

    // Avisos opcionais de cada story (usados pela música).
    function avisarItem(item, nome) {
      if (item && typeof item[nome] === "function") {
        try {
          item[nome]();
        } catch (erro) {
          console.error(erro);
        }
      }
    }

    let estavaPausado = false;

    function mostrar(indice) {
      if (lista[atual] && el.slide.childElementCount) avisarItem(lista[atual], "aoSair");
      atual = indice;
      decorrido = 0;
      const item = lista[atual];
      el.palco.dataset.tema = item.tema;
      el.secao.textContent = item.secao;
      el.conta.textContent = `${atual + 1} de ${lista.length}`;
      const conteudo = item.montar();
      conteudo.classList.add("st--entrando");
      el.slide.replaceChildren(conteudo);
      encaixar(conteudo);
      animarNumeros(conteudo);
      desenharBarras();
      estavaPausado = false;
      avisarItem(item, "aoEntrar");
      if (pausadoParaSom()) {
        estavaPausado = true;
        avisarItem(item, "aoPausar");
      }
    }

    function proximo() {
      if (encerrado) return;
      if (atual >= lista.length - 1) {
        encerrar();
        return;
      }
      mostrar(atual + 1);
    }

    function anterior() {
      if (encerrado) return;
      if (atual === 0) {
        mostrar(0);   // no primeiro, recomeça ele
        return;
      }
      mostrar(atual - 1);
    }

    function loop(agora) {
      if (encerrado) return;
      const passo = ultimoQuadro ? agora - ultimoQuadro : 0;
      ultimoQuadro = agora;
      const agoraPausado = pausado();
      const somPausado = pausadoParaSom();
      if (somPausado !== estavaPausado) {
        estavaPausado = somPausado;
        avisarItem(lista[atual], somPausado ? "aoPausar" : "aoContinuar");
      }
      if (!agoraPausado) {
        const item = lista[atual];
        const progresso = typeof item.progresso === "function" ? item.progresso() : null;
        if (progresso !== null && progresso !== undefined) {
          // story de vídeo: o tempo é o do próprio vídeo
          decorrido = Math.min(1, progresso) * item.duracao;
          if (item.acabou()) proximo();
        } else {
          decorrido += Math.min(passo, 100);   // se a aba travar, não pula vários stories
          if (decorrido >= item.duracao) {
            proximo();
          }
        }
      }
      if (!encerrado) {
        desenharBarras();
        quadro = requestAnimationFrame(loop);
      }
    }

    // ---- toques ----
    let xInicio = 0;
    let yInicio = 0;

    function aoApertar(evento) {
      if (evento.button !== undefined && evento.button !== 0) return;
      inicioToque = performance.now();
      xInicio = evento.clientX;
      yInicio = evento.clientY;
      pausadoPorToque = true;
      el.palco.classList.add("stories-palco--pausado");
      try { el.toque.setPointerCapture(evento.pointerId); } catch { /* ok */ }
    }

    function aoSoltar(evento) {
      if (!inicioToque) return;
      const tempo = performance.now() - inicioToque;
      const andou = Math.hypot(evento.clientX - xInicio, evento.clientY - yInicio);
      inicioToque = 0;
      pausadoPorToque = false;
      el.palco.classList.toggle("stories-palco--pausado", pausadoPorBotao);
      el.dica.classList.add("stories-dica--some");

      if (tempo <= TOQUE_MAXIMO && andou < 12) {
        const caixa = el.toque.getBoundingClientRect();
        const posicao = (evento.clientX - caixa.left) / caixa.width;
        if (posicao < AREA_VOLTAR) anterior();
        else proximo();
      }
    }

    function aoCancelar() {
      inicioToque = 0;
      pausadoPorToque = false;
      el.palco.classList.toggle("stories-palco--pausado", pausadoPorBotao);
    }

    // ---- teclado e botões ----
    function aoTeclar(evento) {
      if (evento.key === "ArrowRight") {
        evento.preventDefault();
        proximo();
      } else if (evento.key === "ArrowLeft") {
        evento.preventDefault();
        anterior();
      } else if (evento.key === " " && !/^(BUTTON|INPUT|TEXTAREA|A)$/.test(evento.target.tagName)) {
        evento.preventDefault();
        alternarPausa();
      }
    }

    function alternarPausa() {
      pausadoPorBotao = !pausadoPorBotao;
      el.pausar.textContent = pausadoPorBotao ? "Continuar" : "Pausar";
      el.palco.classList.toggle("stories-palco--pausado", pausadoPorBotao);
    }

    function aoMudarAba() {
      pausadoPorAba = document.visibilityState !== "visible";
    }

    const ouvintes = [
      [el.toque, "pointerdown", aoApertar],
      [el.toque, "pointerup", aoSoltar],
      [el.toque, "pointercancel", aoCancelar],
      [el.toque, "contextmenu", (e) => e.preventDefault()],
      [document, "keydown", aoTeclar],
      [document, "visibilitychange", aoMudarAba],
      [el.anterior, "click", anterior],
      [el.proximo, "click", proximo],
      [el.pausar, "click", alternarPausa],
    ];
    for (const [alvo, tipo, fn] of ouvintes) alvo.addEventListener(tipo, fn);

    function encerrar() {
      if (encerrado) return;
      encerrado = true;
      cancelAnimationFrame(quadro);
      avisarItem(lista[atual], "aoSair");
      for (const [alvo, tipo, fn] of ouvintes) alvo.removeEventListener(tipo, fn);
      cheias.forEach((barra) => { barra.style.transform = "scaleX(1)"; });
      terminar();
    }

    pausadoPorBotao = false;
    el.pausar.textContent = "Pausar";
    el.palco.classList.remove("stories-palco--pausado");
    el.dica.classList.remove("stories-dica--some");
    mostrar(atual);
    quadro = requestAnimationFrame(loop);
  });
}
