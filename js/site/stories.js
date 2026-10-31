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

  // 3. Detalhes (só os que estiverem preenchidos)
  const detalhes = [
    ["O apelido que eu mais te chamo", texto(retro.apelido), false],
    ["Nosso lugar favorito", texto(retro.lugar), false],
    ["A frase que tu mais falas", texto(retro.frase_dela), true],
  ].filter((d) => d[1]);
  if (detalhes.length) {
    lista.push({ secao: "Nossa retrospectiva", tema: "azul", duracao: DURACAO_RETRO, montar: () => slideDetalhes(detalhes) });
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

function slideDetalhes(detalhes) {
  return h(
    "div",
    { class: "st st--centro" },
    h("h2", { class: "st-titulo st-titulo--m" }, "Os detalhes que são só nossos"),
    h(
      "ol",
      { class: "st-lista" },
      detalhes.map(([rotulo, valor, citacao], i) =>
        h(
          "li",
          { class: "st-lista-item" },
          h("span", { class: "st-lista-numero", "aria-hidden": "true" }, String(i + 1)),
          h(
            "span",
            { class: "st-lista-textos" },
            h("span", { class: "st-lista-rotulo" }, rotulo),
            h("span", { class: citacao ? "st-lista-valor st-lista-valor--citacao" : "st-lista-valor" }, citacao ? `“${valor}”` : valor)
          )
        )
      )
    )
  );
}

function legenda(story) {
  const tag = texto(story.tag);
  const frase = texto(story.frase);
  if (!tag && !frase) return null;
  return h(
    "div",
    { class: "st-legenda" },
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
