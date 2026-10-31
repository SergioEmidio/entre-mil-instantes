// =====================================================================
// Entre Mil Instantes · site/radio.js
// "A Rádio dela", no estilo Spotify:
//   · playlist com capa, aleatório e play
//   · tela "tocando agora" com barra que dá para tocar/arrastar,
//     anterior / play-pause / próxima, aleatório, repetir e fila
//   · quando uma faixa acaba, a próxima começa sozinha
//   · mini player embaixo da lista
//   · mostra a faixa na tela de bloqueio do celular
// =====================================================================

import { h, texto } from "./dom.js";
import { linkDaFoto } from "./fotos.js";
import { mostrarTela } from "./telas.js";

const CORES = ["#462c3a", "#24304d", "#3a2b1e", "#1e3434", "#2e2546", "#3a2a2a"];

const audio = new Audio();
audio.preload = "metadata";
audio.setAttribute("playsinline", "");

let faixas = [];
let ordem = [];
let pos = 0;
let aleatorio = false;
let repetir = false;
let acabou = false;
let arrastando = false;
let idCarregada = null;
let nomePlaylist = "A Rádio";
let capaPlaylist = null;
let aoContinuar = null;
let ligado = false;
const curtidas = new Set();

const el = {};

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const minSeg = (s) => {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function embaralhar(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const faixaAtual = () => faixas[ordem[pos]];

function duracaoAtual() {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  const f = faixaAtual();
  return f && f.duracao ? f.duracao : 0;
}

function tocarSemErro() {
  const promessa = audio.play();
  if (promessa && typeof promessa.catch === "function") {
    promessa.catch((erro) => {
      if (erro && erro.name !== "AbortError") console.error("[Rádio]", erro);
      atualizarBotoes();
    });
  }
}

function imagem(caminho, alt = "", preguicosa = false) {
  const link = linkDaFoto(caminho);
  if (!link) return null;
  return h("img", {
    src: link,
    alt,
    draggable: "false",
    decoding: "async",
    loading: preguicosa ? "lazy" : null,
  });
}

// Capa de uma faixa; sem capa própria, usa a da playlist.
const capaDe = (f) => (f && f.capa) || capaPlaylist;

// Ícones
const ICONES = {
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pausa: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  anterior: '<path d="M6 5h2.5v14H6zM20 5v14L9 12z" fill="currentColor" stroke="none"/>',
  proxima: '<path d="M15.5 5H18v14h-2.5zM4 5v14l11-7z" fill="currentColor" stroke="none"/>',
};

function trocarIcone(botao, nome) {
  const svg = botao.querySelector("svg[data-icone]");
  if (svg && svg.dataset.icone !== nome) {
    svg.innerHTML = ICONES[nome];   // texto fixo deste arquivo (não vem do banco)
    svg.dataset.icone = nome;
  }
}

// ---------------------------------------------------------------------
// Montar (chamado quando o site abre)
// ---------------------------------------------------------------------
export function montarRadio(conteudo) {
  const c = conteudo || {};
  const autor = texto(c.autor);
  const nome = texto(c.nome);
  nomePlaylist = nome ? `A Rádio da ${nome}` : "A nossa Rádio";
  capaPlaylist = (c.radio && typeof c.radio.capa === "string" && c.radio.capa) || null;

  const lista = c.radio && Array.isArray(c.radio.faixas) ? c.radio.faixas : [];
  faixas = lista
    .filter((f) => f && f.audio && linkDaFoto(f.audio))
    .map((f, i) => ({
      id: f.id || String(i),
      titulo: texto(f.titulo) || `Faixa ${i + 1}`,
      artista: texto(f.artista) || autor || "",
      capa: f.capa || null,
      audio: f.audio,
      duracao: Number(f.duracao) || null,
      cor: CORES[i % CORES.length],
    }));

  ordem = faixas.map((_, i) => i);
  pos = 0;
  acabou = false;
  aleatorio = false;

  ligarUmaVez();
  if (!faixas.length) return false;

  // Já deixa a primeira faixa pronta (sem tocar).
  carregar(ordem[0]);
  desenharCabecalho();
  desenharLista();
  atualizarTudo();
  return true;
}

// Chamar DENTRO do toque em "Entrar" (destrava o som no iPhone).
export function destravarRadio() {
  if (!faixas.length || !audio.getAttribute("src")) return;
  audio.muted = true;
  const promessa = audio.play();
  const voltar = () => {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* ok */
    }
    audio.muted = false;
  };
  if (promessa && typeof promessa.then === "function") promessa.then(voltar, voltar);
  else voltar();
}

// Mostra a playlist e espera ela tocar em "Continuar".
export function tocarRadio() {
  return new Promise((resolver) => {
    aoContinuar = resolver;
    mostrarTela("tela-radio");
  });
}

export function pararRadio() {
  audio.pause();
}

// ---------------------------------------------------------------------
// Tocar
// ---------------------------------------------------------------------
function carregar(indiceFaixa) {
  const f = faixas[indiceFaixa];
  if (!f) return;
  idCarregada = f.id;
  audio.setAttribute("src", linkDaFoto(f.audio));
  audio.load();
}

function tocarPosicao(p) {
  pos = Math.max(0, Math.min(ordem.length - 1, p));
  acabou = false;
  const f = faixaAtual();
  if (idCarregada !== f.id) carregar(ordem[pos]);
  else {
    try {
      audio.currentTime = 0;
    } catch {
      /* ok */
    }
  }
  tocarSemErro();
  atualizarTudo();
  avisarTelaDeBloqueio();
}

function playPausa() {
  if (!faixas.length) return;
  if (acabou) {
    tocarPosicao(0);
    return;
  }
  const f = faixaAtual();
  if (idCarregada !== f.id) {
    carregar(ordem[pos]);
    tocarSemErro();
  } else if (audio.paused) {
    tocarSemErro();
  } else {
    audio.pause();
  }
  avisarTelaDeBloqueio();
}

function proxima(porBotao) {
  if (!faixas.length) return;
  if (pos < ordem.length - 1) {
    tocarPosicao(pos + 1);
  } else if (repetir) {
    tocarPosicao(0);
  } else if (porBotao) {
    // Última faixa e sem repetir: volta para o começo, parado.
    pos = 0;
    acabou = false;
    carregar(ordem[0]);
    atualizarTudo();
  } else {
    acabou = true;
    audio.pause();
    atualizarTudo();
  }
}

function anterior() {
  if (!faixas.length) return;
  if (audio.currentTime > 3 || pos === 0) {
    try {
      audio.currentTime = 0;
    } catch {
      /* ok */
    }
    if (acabou) tocarPosicao(pos);
    else atualizarTempo();
    return;
  }
  tocarPosicao(pos - 1);
}

function alternarAleatorio() {
  if (!faixas.length) return;
  const atual = ordem[pos];
  if (!aleatorio) {
    const resto = embaralhar(faixas.map((_, i) => i).filter((i) => i !== atual));
    ordem = [atual, ...resto];
    pos = 0;
  } else {
    ordem = faixas.map((_, i) => i);
    pos = atual;
  }
  aleatorio = !aleatorio;
  desenharLista();
  atualizarTudo();
}

function alternarRepetir() {
  repetir = !repetir;
  atualizarTudo();
}

function alternarCurtida() {
  const f = faixaAtual();
  if (!f) return;
  if (curtidas.has(f.id)) curtidas.delete(f.id);
  else curtidas.add(f.id);
  atualizarTudo();
}

function continuar() {
  audio.pause();
  const resolver = aoContinuar;
  aoContinuar = null;
  if (resolver) resolver();
}

// ---------------------------------------------------------------------
// Tela de bloqueio do celular (Media Session)
// ---------------------------------------------------------------------
function avisarTelaDeBloqueio() {
  if (!("mediaSession" in navigator) || typeof window.MediaMetadata !== "function") return;
  const f = faixaAtual();
  if (!f) return;
  try {
    const capa = linkDaFoto(capaDe(f));
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: f.titulo,
      artist: f.artista,
      album: nomePlaylist,
      artwork: capa ? [{ src: capa, sizes: "512x512" }] : [],
    });
  } catch {
    /* não é essencial */
  }
}

// ---------------------------------------------------------------------
// Desenhar
// ---------------------------------------------------------------------
function desenharCabecalho() {
  el.titulo.textContent = nomePlaylist;
  el.tocandoPlaylist.textContent = nomePlaylist;
  const total = faixas.reduce((soma, f) => soma + (f.duracao || 0), 0);
  const autor = faixas[0] && faixas[0].artista;
  const partes = [];
  if (autor) partes.push(`Memórias contadas por ${autor}`);
  partes.push(faixas.length === 1 ? "1 faixa" : `${faixas.length} faixas`);
  if (total) partes.push(total >= 60 ? `${Math.round(total / 60)}\u00a0min` : `${total}\u00a0s`);
  el.sub.textContent = partes.join(" · ");
  const capa = capaPlaylist || (faixas.find((f) => f.capa) || {}).capa;
  el.capa.replaceChildren(...[imagem(capa, nomePlaylist)].filter(Boolean));
}

function desenharLista() {
  el.lista.replaceChildren(
    ...ordem.map((indice, p) => {
      const f = faixas[indice];
      return h(
        "li",
        null,
        h(
          "button",
          {
            type: "button",
            class: "radio-faixa",
            "data-pos": String(p),
            onClick: () => {
              tocarPosicao(p);
              mostrarTela("tela-tocando");
            },
          },
          h("span", { class: "radio-faixa-capa" }, imagem(capaDe(f), "", true)),
          h(
            "span",
            { class: "radio-faixa-textos" },
            h("span", { class: "radio-faixa-titulo" }, f.titulo),
            h("span", { class: "radio-faixa-artista" }, f.artista ? `${f.artista} · narração` : "narração")
          ),
          h("span", { class: "radio-faixa-tempo" }, f.duracao ? minSeg(f.duracao) : "")
        )
      );
    })
  );
}

function atualizarBotoes() {
  const tocando = !audio.paused && !acabou;
  for (const botao of [el.play, el.tocPlay, el.miniPlay]) {
    trocarIcone(botao, tocando ? "pausa" : "play");
    botao.setAttribute("aria-label", tocando ? "Pausar" : "Tocar");
  }
  el.lista.querySelectorAll(".radio-faixa").forEach((botao) => {
    const atual = Number(botao.dataset.pos) === pos;
    botao.classList.toggle("radio-faixa--atual", atual);
    botao.classList.toggle("radio-faixa--tocando", atual && tocando);
    if (atual) botao.setAttribute("aria-current", "true");
    else botao.removeAttribute("aria-current");
  });
}

function atualizarTudo() {
  const f = faixaAtual();
  if (!f) return;

  // Botões de modo
  for (const botao of [el.aleatorio, el.tocAleatorio]) {
    botao.setAttribute("aria-pressed", String(aleatorio));
  }
  el.tocRepetir.setAttribute("aria-pressed", String(repetir));
  el.tocCurtir.setAttribute("aria-pressed", String(curtidas.has(f.id)));
  el.sub.dataset.aleatorio = String(aleatorio);

  // Tela "tocando agora"
  el.tocando.style.setProperty("--cor-faixa", f.cor);
  el.tocCapa.replaceChildren(...[imagem(capaDe(f), f.titulo)].filter(Boolean));
  el.tocTitulo.textContent = f.titulo;
  el.tocArtista.textContent = f.artista;
  el.tocContinuar.hidden = !acabou;
  el.tocFila.hidden = acabou;

  // Fila
  const proximas = [];
  for (let k = 1; k <= 2; k++) {
    const p = pos + k;
    if (p < ordem.length) proximas.push(faixas[ordem[p]]);
    else if (repetir && ordem.length > 1) proximas.push(faixas[ordem[p - ordem.length]]);
  }
  el.tocFilaRotulo.textContent = aleatorio ? "A seguir · modo aleatório" : "A seguir na fila";
  el.tocFilaLista.replaceChildren(
    ...(proximas.length
      ? proximas.map((p) => h("li", null, p.titulo))
      : [h("li", { class: "tocando-fila-fim" }, "Depois desta faixa, a rádio termina")])
  );

  // Mini player
  el.mini.hidden = false;
  el.miniCapa.replaceChildren(...[imagem(capaDe(f))].filter(Boolean));
  el.miniTitulo.textContent = f.titulo;
  el.miniArtista.textContent = f.artista;

  atualizarBotoes();
  atualizarTempo();
}

function atualizarTempo() {
  const total = duracaoAtual();
  const passou = acabou ? total : audio.currentTime || 0;
  const fracao = total ? Math.min(1, passou / total) : 0;

  if (!arrastando) {
    el.tocBarra.max = String(total || 1);
    el.tocBarra.value = String(passou);
  }
  el.tocBarra.style.setProperty("--p", `${(fracao * 100).toFixed(2)}%`);
  el.tocPassou.textContent = minSeg(arrastando ? Number(el.tocBarra.value) : passou);
  el.tocFalta.textContent = `-${minSeg(total - (arrastando ? Number(el.tocBarra.value) : passou))}`;
  el.miniBarra.style.transform = `scaleX(${fracao})`;
}

// ---------------------------------------------------------------------
// Ligar os botões (uma vez só)
// ---------------------------------------------------------------------
function ligarUmaVez() {
  if (ligado) return;
  ligado = true;

  const id = (x) => document.getElementById(x);
  Object.assign(el, {
    capa: id("radio-capa"),
    titulo: id("radio-titulo"),
    sub: id("radio-sub"),
    lista: id("radio-lista"),
    aleatorio: id("radio-aleatorio"),
    play: id("radio-play"),
    continuar: id("radio-continuar"),
    mini: id("radio-mini"),
    miniAbrir: id("radio-mini-abrir"),
    miniCapa: id("radio-mini-capa"),
    miniTitulo: id("radio-mini-titulo"),
    miniArtista: id("radio-mini-artista"),
    miniPlay: id("radio-mini-play"),
    miniBarra: id("radio-mini-barra"),
    tocando: id("tocando"),
    tocandoPlaylist: id("toc-playlist"),
    tocFechar: id("toc-fechar"),
    tocCapa: id("toc-capa"),
    tocTitulo: id("toc-titulo"),
    tocArtista: id("toc-artista"),
    tocCurtir: id("toc-curtir"),
    tocBarra: id("toc-barra"),
    tocPassou: id("toc-passou"),
    tocFalta: id("toc-falta"),
    tocAleatorio: id("toc-aleatorio"),
    tocAnterior: id("toc-anterior"),
    tocPlay: id("toc-play"),
    tocProxima: id("toc-proxima"),
    tocRepetir: id("toc-repetir"),
    tocFila: id("toc-fila"),
    tocFilaRotulo: id("toc-fila-rotulo"),
    tocFilaLista: id("toc-fila-lista"),
    tocContinuar: id("toc-continuar"),
  });

  // Playlist
  el.play.addEventListener("click", () => {
    if (audio.paused || acabou) {
      playPausa();
      mostrarTela("tela-tocando");
    } else {
      playPausa();
    }
  });
  el.aleatorio.addEventListener("click", alternarAleatorio);
  el.continuar.addEventListener("click", continuar);
  el.miniAbrir.addEventListener("click", () => mostrarTela("tela-tocando"));
  el.miniPlay.addEventListener("click", playPausa);

  // Tocando agora
  el.tocFechar.addEventListener("click", () => mostrarTela("tela-radio"));
  el.tocPlay.addEventListener("click", playPausa);
  el.tocAnterior.addEventListener("click", anterior);
  el.tocProxima.addEventListener("click", () => proxima(true));
  el.tocAleatorio.addEventListener("click", alternarAleatorio);
  el.tocRepetir.addEventListener("click", alternarRepetir);
  el.tocCurtir.addEventListener("click", alternarCurtida);
  el.tocContinuar.addEventListener("click", continuar);

  // Barra: tocar ou arrastar para escolher o momento
  const aoArrastar = () => {
    arrastando = true;
    const total = duracaoAtual();
    const v = Number(el.tocBarra.value);
    el.tocBarra.style.setProperty("--p", `${total ? ((v / total) * 100).toFixed(2) : 0}%`);
    el.tocPassou.textContent = minSeg(v);
    el.tocFalta.textContent = `-${minSeg(total - v)}`;
  };
  const aoSoltar = () => {
    if (!arrastando) return;
    arrastando = false;
    const v = Number(el.tocBarra.value);
    if (acabou) {
      acabou = false;
      atualizarTudo();
    }
    try {
      audio.currentTime = v;
    } catch {
      /* ok */
    }
    atualizarTempo();
  };
  el.tocBarra.addEventListener("input", aoArrastar);
  el.tocBarra.addEventListener("change", aoSoltar);
  el.tocBarra.addEventListener("pointerup", aoSoltar);
  el.tocBarra.addEventListener("keyup", aoSoltar);

  // Áudio
  audio.addEventListener("timeupdate", atualizarTempo);
  audio.addEventListener("loadedmetadata", atualizarTempo);
  audio.addEventListener("durationchange", atualizarTempo);
  audio.addEventListener("play", atualizarBotoes);
  audio.addEventListener("pause", atualizarBotoes);
  audio.addEventListener("ended", () => proxima(false));
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    console.error("[Rádio] Não consegui tocar a faixa", faixaAtual() && faixaAtual().titulo);
    atualizarBotoes();
  });

  // Fones e tela de bloqueio
  if ("mediaSession" in navigator) {
    const acoes = {
      play: () => playPausa(),
      pause: () => audio.pause(),
      previoustrack: () => anterior(),
      nexttrack: () => proxima(true),
    };
    for (const [acao, fn] of Object.entries(acoes)) {
      try {
        navigator.mediaSession.setActionHandler(acao, fn);
      } catch {
        /* nem todo celular tem todas */
      }
    }
  }
}
