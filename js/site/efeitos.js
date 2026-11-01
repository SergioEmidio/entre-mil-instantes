// =====================================================================
// Nós, em Todos os Instantes · site/efeitos.js
// Dois toques de "mundo real" nas cartas:
//
//  1. LUZ: um brilho que acompanha o celular (inclinando) ou o mouse.
//     O lacre de cera, o envelope e o papel refletem essa luz.
//     Fica em --luz-x / --luz-y no <html> (0% a 100%).
//
//  2. SONS: estalo da cera, aba abrindo, papel desdobrando e brilhinhos.
//     Feitos na hora pelo navegador (nenhum arquivo para baixar), bem
//     baixinhos, e só tocam se o som não estiver desligado.
// =====================================================================

import { somDesligado } from "./som.js";
import { menosMovimento } from "./dom.js";

// ---------------------------------------------------------------------
// 1. Luz
// ---------------------------------------------------------------------
const luz = { x: 0.35, y: 0.25, alvoX: 0.35, alvoY: 0.25, quadro: 0, ligada: false };
const raiz = document.documentElement;

function aplicarLuz() {
  luz.x += (luz.alvoX - luz.x) * 0.12;
  luz.y += (luz.alvoY - luz.y) * 0.12;
  raiz.style.setProperty("--luz-x", `${(luz.x * 100).toFixed(1)}%`);
  raiz.style.setProperty("--luz-y", `${(luz.y * 100).toFixed(1)}%`);
  if (Math.abs(luz.alvoX - luz.x) > 0.002 || Math.abs(luz.alvoY - luz.y) > 0.002) {
    luz.quadro = requestAnimationFrame(aplicarLuz);
  } else {
    luz.quadro = 0;
  }
}

function mirar(x, y) {
  luz.alvoX = Math.min(0.9, Math.max(0.1, x));
  luz.alvoY = Math.min(0.85, Math.max(0.08, y));
  if (!luz.quadro) luz.quadro = requestAnimationFrame(aplicarLuz);
}

function aoInclinar(evento) {
  if (evento.gamma == null || evento.beta == null) return;
  // gamma: esquerda/direita (-90..90) · beta: frente/trás (celular em pé ≈ 40..70)
  mirar(0.5 + evento.gamma / 60, 0.3 + (evento.beta - 45) / 90);
}

function aoMexerMouse(evento) {
  if (evento.pointerType && evento.pointerType !== "mouse") return;
  mirar(evento.clientX / window.innerWidth, evento.clientY / window.innerHeight);
}

export function ligarLuz() {
  if (luz.ligada || menosMovimento()) return;
  luz.ligada = true;
  window.addEventListener("deviceorientation", aoInclinar, { passive: true });
  window.addEventListener("pointermove", aoMexerMouse, { passive: true });
}

export function desligarLuz() {
  if (!luz.ligada) return;
  luz.ligada = false;
  window.removeEventListener("deviceorientation", aoInclinar);
  window.removeEventListener("pointermove", aoMexerMouse);
}

// ---------------------------------------------------------------------
// 2. Sons (sintetizados)
// ---------------------------------------------------------------------
let contexto = null;
let ruidoGuardado = null;

function audio() {
  if (somDesligado()) return null;
  try {
    if (!contexto) {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return null;
      contexto = new Contexto();
    }
    if (contexto.state === "suspended") contexto.resume().catch(() => {});
    return contexto;
  } catch {
    return null;
  }
}

function ruido(ctx) {
  if (ruidoGuardado && ruidoGuardado.sampleRate === ctx.sampleRate) return ruidoGuardado;
  const tamanho = Math.floor(ctx.sampleRate * 1.2);
  const buffer = ctx.createBuffer(1, tamanho, ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
  ruidoGuardado = buffer;
  return buffer;
}

// Um sopro de ruído filtrado (papel, aba, cera)
function sopro(ctx, { quando = 0, dura = 0.2, tipo = "bandpass", freq = 1200, freqFim = null, q = 0.8, volume = 0.08, ataque = 0.01 }) {
  const t = ctx.currentTime + quando;
  const fonte = ctx.createBufferSource();
  fonte.buffer = ruido(ctx);
  const filtro = ctx.createBiquadFilter();
  filtro.type = tipo;
  filtro.Q.value = q;
  filtro.frequency.setValueAtTime(freq, t);
  if (freqFim) filtro.frequency.exponentialRampToValueAtTime(freqFim, t + dura);
  const ganho = ctx.createGain();
  ganho.gain.setValueAtTime(0.0001, t);
  ganho.gain.exponentialRampToValueAtTime(volume, t + ataque);
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  fonte.connect(filtro).connect(ganho).connect(ctx.destination);
  fonte.start(t, Math.random() * 0.8);
  fonte.stop(t + dura + 0.05);
}

// Um sininho (seno com um harmônico)
function sino(ctx, { quando = 0, freq = 1568, dura = 0.9, volume = 0.03 }) {
  const t = ctx.currentTime + quando;
  for (const [mult, vol] of [[1, 1], [2.01, 0.35]]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(volume * vol, t + 0.008);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + dura * (mult === 1 ? 1 : 0.5));
    osc.connect(ganho).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dura + 0.05);
  }
}

// Batidinha grave (a cera cedendo, o envelope pousando)
function baque(ctx, { quando = 0, freq = 140, volume = 0.12, dura = 0.09 }) {
  const t = ctx.currentTime + quando;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dura);
  const ganho = ctx.createGain();
  ganho.gain.setValueAtTime(0.0001, t);
  ganho.gain.exponentialRampToValueAtTime(volume, t + 0.005);
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dura + 0.02);
}

function tocarSom(fn) {
  const ctx = audio();
  if (!ctx) return;
  try {
    fn(ctx);
  } catch {
    /* som é enfeite: se falhar, tudo segue */
  }
}

export const sons = {
  // a cera rachando
  estalo: () =>
    tocarSom((ctx) => {
      baque(ctx, { freq: 170, volume: 0.1, dura: 0.07 });
      sopro(ctx, { tipo: "highpass", freq: 2200, dura: 0.06, volume: 0.09, ataque: 0.002, q: 0.5 });
      sopro(ctx, { quando: 0.05, tipo: "highpass", freq: 3200, dura: 0.05, volume: 0.05, ataque: 0.002, q: 0.5 });
    }),
  // a aba abrindo (um "fffp" de papel)
  aba: () =>
    tocarSom((ctx) => {
      sopro(ctx, { freq: 700, freqFim: 2200, dura: 0.38, volume: 0.045, ataque: 0.12, q: 0.9 });
    }),
  // brilhinhos
  brilho: () =>
    tocarSom((ctx) => {
      [2093, 2637, 3136, 2349].forEach((f, i) => sino(ctx, { quando: i * 0.075, freq: f, volume: 0.016, dura: 0.8 }));
    }),
  // a carta deslizando para fora
  desliza: () =>
    tocarSom((ctx) => {
      sopro(ctx, { freq: 1800, freqFim: 3800, dura: 0.42, volume: 0.035, ataque: 0.1, q: 0.6 });
    }),
  // papel desdobrando (duas dobras)
  desdobra: () =>
    tocarSom((ctx) => {
      sopro(ctx, { freq: 2600, dura: 0.12, volume: 0.06, ataque: 0.01, q: 1.2 });
      sopro(ctx, { quando: 0.28, freq: 2300, dura: 0.12, volume: 0.06, ataque: 0.01, q: 1.2 });
    }),
  // envelope pousando
  pousa: () =>
    tocarSom((ctx) => {
      baque(ctx, { freq: 110, volume: 0.07, dura: 0.12 });
      sopro(ctx, { tipo: "lowpass", freq: 900, dura: 0.1, volume: 0.03, ataque: 0.004 });
    }),
};
