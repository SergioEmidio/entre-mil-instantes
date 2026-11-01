// =====================================================================
// Entre Mil Instantes · site/cartas.js
// Tela 13: cartas «Abre quando…».
//
// Abrir (primeira vez): o envelope sai da grade e pousa no centro →
// ela toca no lacre → o lacre racha e cai em pedaços → a aba abre (por
// dentro tem um forro de estrelinhas) e saem brilhinhos → a carta sobe,
// vem para a frente e desdobra (dobrada em três) → o texto aparece como
// tinta e a assinatura é escrita.
// Abrir de novo: o envelope já está aberto, a carta só sai dele.
// Guardar: a carta dobra, volta para dentro e o envelope (aberto, com a
// cartinha aparecendo) volta para o lugar dele na grade.
//
// As trancadas chegam SEM texto e sem voz (o banco só manda no dia
// certo): o envelope treme e avisa quantos dias faltam.
// =====================================================================

import { h, texto, vibrar, menosMovimento } from "./dom.js";
import { dataCurta, dataPorExtenso, diasAte } from "./datas.js";
import { ehPrevia, lerConjunto, guardarConjunto } from "./memoria.js";
import { linkDaFoto } from "./fotos.js";
import { mostrarTela } from "./telas.js";
import { registrarCarta } from "../supabase.js";

const SUAVE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SOBE = "cubic-bezier(0.33, 1, 0.68, 1)";
const POUSA = "cubic-bezier(0.34, 1.32, 0.64, 1)";

// Proporções do envelope (iguais às do CSS)
const ALTURA = 0.66;          // altura = largura × 0.66
const ABA_ABERTA = 124;       // graus: a aba deitada para trás
const PAPEL_ALTURA = 0.82;    // a cartinha tem 82% da altura do envelope
const PAPEL_ESPIA = -0.2;     // aberto: a cartinha aparece 20% para fora

// Carta aparece se tiver título e texto (as trancadas avisam se têm texto).
export function cartasDoConteudo(conteudo) {
  const lista = conteudo && Array.isArray(conteudo.cartas) ? conteudo.cartas : [];
  return lista.filter((c) => {
    if (!c || !texto(c.titulo)) return false;
    if (typeof c.tem_texto === "boolean") return c.tem_texto;
    return Boolean(texto(c.texto));
  });
}

export function temCartas(conteudo) {
  return cartasDoConteudo(conteudo).length > 0;
}

// ---------------------------------------------------------------------
// Ajudantes de animação
// ---------------------------------------------------------------------
const podeAnimar = () => !menosMovimento() && typeof Element.prototype.animate === "function";

function animar(alvo, quadros, ms, opcoes = {}) {
  if (!alvo) return Promise.resolve();
  const a = alvo.animate(quadros, { duration: ms, easing: SUAVE, fill: "forwards", ...opcoes });
  return a.finished.then(() => a, () => a);
}

function limpar(...els) {
  for (const alvo of els) {
    if (alvo && typeof alvo.getAnimations === "function") alvo.getAnimations().forEach((a) => a.cancel());
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const aleatorio = (min, max) => min + Math.random() * (max - min);
const minSeg = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

// Curvas para a aba (girada quadro a quadro)
const saiDevagar = (t) => 1 - Math.pow(1 - t, 3);
const entraDevagar = (t) => t * t * t;
function passaUmPouco(t) {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ---------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------
const el = {};
let ligado = false;

function pegar() {
  if (ligado) return;
  ligado = true;
  for (const id of ["lista", "aviso", "seguir"]) el[id] = document.getElementById(`cartas-${id}`);
  const ids = {
    fundo: "carta-fundo",
    env: "carta-env",
    mini: "carta-mini",
    aba: "carta-aba",
    lacre: "carta-lacre",
    iniciais: "carta-iniciais",
    tocar: "carta-tocar",
    dica: "carta-dica",
    folha: "carta-folha",
    rolagem: "carta-rolagem",
    conteudo: "carta-conteudo",
    titulo: "carta-titulo",
    texto: "carta-texto",
    assinatura: "carta-assinatura",
    voz: "carta-voz",
    vozBotao: "carta-voz-botao",
    vozBarra: "carta-voz-barra",
    vozTempo: "carta-voz-tempo",
    responder: "carta-responder",
    fechar: "carta-fechar",
    fita: "carta-fita",
    polegar: "carta-fita-polegar",
  };
  for (const [nome, id] of Object.entries(ids)) el[nome] = document.getElementById(id);
  el.cera = el.lacre.querySelector(".env-lacre-cera");
  el.metades = [...el.lacre.querySelectorAll(".env-lacre-metade")];
  el.racha = el.lacre.querySelector(".env-rachadura path");
  el.dobras = [...el.folha.querySelectorAll(".folha-dobra")];
  el.vincos = [...el.folha.querySelectorAll(".folha-vinco")];

  el.fechar.addEventListener("click", () => pedirFechar());
  el.responder.addEventListener("click", () => pedirFechar("responder"));
  el.fundo.addEventListener("click", (evento) => {
    if (evento.target === el.fundo) pedirFechar();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !el.fundo.hidden) pedirFechar();
  });
  el.tocar.addEventListener("click", () => {
    if (aoTocarNoLacre) aoTocarNoLacre("abrir");
  });

  ligarFita();

  // Voz
  voz.addEventListener("timeupdate", desenharVoz);
  voz.addEventListener("loadedmetadata", desenharVoz);
  voz.addEventListener("ended", () => {
    voz.currentTime = 0;
    desenharVoz();
  });
  voz.addEventListener("pause", desenharVoz);
  voz.addEventListener("play", desenharVoz);
  el.vozBotao.addEventListener("click", () => {
    if (voz.paused) {
      const p = voz.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      voz.pause();
    }
  });
}

// ---------------------------------------------------------------------
// A fita de cetim (barrinha de rolar da carta)
// ---------------------------------------------------------------------
let fitaTempo = null;

function atualizarFita() {
  const r = el.rolagem;
  const max = r.scrollHeight - r.clientHeight;
  const rolavel = max > 4;
  el.folha.classList.toggle("folha--rolavel", rolavel);
  r.classList.toggle("folha-rolagem--acima", rolavel && r.scrollTop > 4);
  r.classList.toggle("folha-rolagem--abaixo", rolavel && r.scrollTop < max - 4);
  if (!rolavel) return;
  const trilho = el.fita.clientHeight;
  const tamanho = Math.max(28, Math.round((trilho * r.clientHeight) / r.scrollHeight));
  const pos = Math.round(((trilho - tamanho) * r.scrollTop) / max);
  el.polegar.style.height = `${tamanho}px`;
  el.polegar.style.transform = `translateY(${pos}px)`;
}

function mostrarFita(ms = 900) {
  el.folha.classList.add("folha--rolando");
  clearTimeout(fitaTempo);
  fitaTempo = setTimeout(() => el.folha.classList.remove("folha--rolando"), ms);
}

function ligarFita() {
  el.rolagem.addEventListener(
    "scroll",
    () => {
      atualizarFita();
      mostrarFita();
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    if (!el.fundo.hidden) atualizarFita();
  });

  // Arrastar a fita (computador) ou tocar no trilho para pular.
  let arraste = null;
  el.fita.addEventListener("pointerdown", (evento) => {
    const r = el.rolagem;
    const max = r.scrollHeight - r.clientHeight;
    if (max <= 4) return;
    evento.preventDefault();
    const trilho = el.fita.getBoundingClientRect();
    const tamanho = el.polegar.offsetHeight;
    if (evento.target !== el.polegar) {
      const fracao = Math.min(1, Math.max(0, (evento.clientY - trilho.top - tamanho / 2) / (trilho.height - tamanho)));
      r.scrollTop = fracao * max;
    }
    arraste = { y: evento.clientY, inicio: r.scrollTop, porPixel: max / Math.max(1, trilho.height - tamanho) };
    el.fita.classList.add("folha-fita--arrastando");
    try {
      el.fita.setPointerCapture(evento.pointerId);
    } catch {
      /* tudo bem */
    }
  });
  el.fita.addEventListener("pointermove", (evento) => {
    if (!arraste) return;
    el.rolagem.scrollTop = arraste.inicio + (evento.clientY - arraste.y) * arraste.porPixel;
  });
  const soltar = () => {
    arraste = null;
    el.fita.classList.remove("folha-fita--arrastando");
  };
  el.fita.addEventListener("pointerup", soltar);
  el.fita.addEventListener("pointercancel", soltar);
}

// ---------------------------------------------------------------------
// Voz na carta (opcional)
// ---------------------------------------------------------------------
const voz = new Audio();
voz.preload = "auto";
voz.setAttribute("playsinline", "");
let duracaoVoz = 0;

function desenharVoz() {
  const total = Number.isFinite(voz.duration) && voz.duration > 0 ? voz.duration : duracaoVoz;
  const passou = voz.currentTime || 0;
  el.vozBarra.style.transform = `scaleX(${total ? Math.min(1, passou / total) : 0})`;
  el.vozTempo.textContent = total ? `${minSeg(passou)} / ${minSeg(total)}` : minSeg(passou);
  el.vozBotao.setAttribute("aria-pressed", String(!voz.paused));
  el.vozBotao.querySelector("span").textContent = voz.paused ? "Ouvir minha voz" : "Pausar";
}

function prepararVoz(carta) {
  voz.pause();
  const link = carta.audio ? linkDaFoto(carta.audio) : null;
  el.voz.hidden = !link;
  if (!link) {
    voz.removeAttribute("src");
    return;
  }
  duracaoVoz = Number(carta.duracao) || 0;
  if (voz.getAttribute("src") !== link) voz.setAttribute("src", link);
  voz.currentTime = 0;
  desenharVoz();
}

// ---------------------------------------------------------------------
// O texto vira "tinta": cada palavra aparece um pouquinho depois da outra
// ---------------------------------------------------------------------
function escreverTexto(conteudoTexto) {
  el.texto.replaceChildren();
  const pedacos = conteudoTexto.split(/(\s+)/);
  const palavras = pedacos.filter((p) => p && !/^\s+$/.test(p)).length;
  const passo = palavras ? Math.min(26, 1500 / palavras) : 0;
  let i = 0;
  for (const pedaco of pedacos) {
    if (!pedaco) continue;
    if (/^\s+$/.test(pedaco)) {
      el.texto.append(document.createTextNode(pedaco));
    } else {
      const span = document.createElement("span");
      span.className = "tinta";
      span.style.setProperty("--d", `${Math.round(420 + i * passo)}ms`);
      span.textContent = pedaco;
      el.texto.append(span);
      i += 1;
    }
  }
  const fimDoTexto = Math.round(420 + i * passo + 300);
  el.folha.style.setProperty("--d-assinatura", `${fimDoTexto}ms`);
  el.folha.style.setProperty("--d-fim", `${fimDoTexto + 500}ms`);
}

// ---------------------------------------------------------------------
// Brilhinhos e farelos de cera
// ---------------------------------------------------------------------
function brilhos(x, y, quantos, largura) {
  for (let i = 0; i < quantos; i++) {
    const estrela = i % 4 === 0;
    const b = h("span", { class: `env-brilho${estrela ? " env-brilho--estrela" : ""}`, "aria-hidden": "true" });
    b.style.left = `${x + aleatorio(-largura * 0.32, largura * 0.32)}px`;
    b.style.top = `${y + aleatorio(-6, 10)}px`;
    el.fundo.append(b);
    const dx = aleatorio(-largura * 0.35, largura * 0.35);
    const dy = -aleatorio(largura * 0.25, largura * 0.75);
    const tamanho = aleatorio(0.6, 1.5);
    const giro = estrela ? aleatorio(-160, 160) : 0;
    animar(
      b,
      [
        { transform: `translate(0, 0) scale(0) rotate(0deg)`, opacity: 0 },
        { offset: 0.18, transform: `translate(${dx * 0.25}px, ${dy * 0.25}px) scale(${tamanho}) rotate(${giro * 0.3}deg)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${tamanho * 0.4}) rotate(${giro}deg)`, opacity: 0 },
      ],
      aleatorio(900, 1600),
      { delay: aleatorio(0, 260), easing: "cubic-bezier(0.2, 0.6, 0.35, 1)" }
    ).then(() => b.remove());
  }
}

function farelos(x, y, quantos, escala) {
  for (let i = 0; i < quantos; i++) {
    const f = h("span", { class: "env-farelo", "aria-hidden": "true" });
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    const t = aleatorio(0.5, 1.3);
    f.style.width = f.style.height = `${Math.max(3, escala * 0.022 * t)}px`;
    el.fundo.append(f);
    const dx = aleatorio(-escala * 0.28, escala * 0.28);
    const sobe = -aleatorio(escala * 0.04, escala * 0.14);
    const cai = aleatorio(escala * 0.5, escala * 0.9);
    animar(
      f,
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        { offset: 0.3, transform: `translate(${dx * 0.45}px, ${sobe}px) rotate(${aleatorio(-90, 90)}deg)`, opacity: 1 },
        { transform: `translate(${dx}px, ${cai}px) rotate(${aleatorio(-300, 300)}deg)`, opacity: 0 },
      ],
      aleatorio(650, 1000),
      { easing: "cubic-bezier(0.45, 0, 0.8, 0.6)" }
    ).then(() => f.remove());
  }
}

function tirarEnfeites() {
  el.fundo.querySelectorAll(".env-brilho, .env-farelo").forEach((n) => n.remove());
}

// ---------------------------------------------------------------------
// A aba, girada quadro a quadro (troca a cor quando passa de 90°:
// por fora é vinho, por dentro tem o forro de estrelinhas)
// ---------------------------------------------------------------------
let quadroDaAba = 0;

function poseDaAba(graus, L) {
  el.aba.style.transform = `perspective(${Math.round(L * 3.2)}px) rotateX(${graus}deg)`;
  const dentro = graus > 90;
  el.aba.classList.toggle("env-aba--dentro", dentro);
  el.aba.style.zIndex = dentro ? "0" : "";
  el.aba.style.filter = dentro ? "none" : "";
}

function girarAba(de, para, ms, curva, L) {
  cancelAnimationFrame(quadroDaAba);
  return new Promise((resolver) => {
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / ms);
      poseDaAba(de + (para - de) * curva(t), L);
      if (t < 1) quadroDaAba = requestAnimationFrame(passo);
      else resolver();
    };
    quadroDaAba = requestAnimationFrame(passo);
  });
}

// ---------------------------------------------------------------------
// Abrir e guardar
// ---------------------------------------------------------------------
let estado = "fechada";       // fechada | chegando | esperando | abrindo | aberta | fechando
let pedidoDeFechar = null;    // pedido feito no meio da animação de abrir
let aoTerminarDeFechar = null;
let aoTocarNoLacre = null;
let atual = null;             // { carta, botao, jaAberta, geo }

function pedirFechar(motivo = "guardar") {
  if (estado === "aberta") {
    fechar(motivo);
  } else if (estado === "esperando") {
    if (aoTocarNoLacre) aoTocarNoLacre("fechar");
  } else if (estado === "abrindo" || estado === "chegando") {
    pedidoDeFechar = motivo;
  }
}

// Onde o envelope grande fica: espaço para a carta sair por cima e para
// a dica embaixo (cabe em celular pequeno e deitado).
function geometria() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const L = Math.max(150, Math.min(vw - 48, 320, (vh - 96) / 1.92 / ALTURA));
  const H = L * ALTURA;
  const subida = H * 0.93;
  const left = (vw - L) / 2;
  let top = vh / 2 - H * 0.04;
  top = Math.max(top, subida + 20);
  top = Math.min(top, vh - H - 64);
  return { L, H, subida, left, top };
}

function preencher(carta, autor) {
  el.folha.classList.remove("folha--escrevendo", "folha--rolavel", "folha--rolando");
  el.titulo.textContent = texto(carta.titulo);
  escreverTexto(texto(carta.texto));
  el.assinatura.textContent = autor ? `Com amor, ${autor}.` : "";
  el.assinatura.hidden = !autor;
  prepararVoz(carta);
  el.rolagem.scrollTop = 0;
}

// Tudo do envelope grande de volta ao normal.
function zerarEnvelope() {
  cancelAnimationFrame(quadroDaAba);
  limpar(el.env, el.mini, el.cera, el.iniciais, el.racha, el.dica, el.lacre, ...el.metades);
  el.env.className = "env env-corpo";
  el.aba.classList.remove("env-aba--dentro");
  el.aba.style.transform = "";
  el.aba.style.zIndex = "";
  el.aba.style.filter = "";
  el.mini.style.opacity = "";
  el.cera.style.opacity = "";
  el.metades.forEach((m) => { m.style.display = ""; });
  el.lacre.classList.remove("env-lacre--chamando");
  el.tocar.hidden = true;
  el.dica.style.opacity = "";
  tirarEnfeites();
}

function emblema(carta) {
  el.iniciais.replaceChildren();
  if (carta.trancada) el.iniciais.append(cadeado(24));
  else el.iniciais.textContent = iniciaisAtuais;
  el.iniciais.classList.toggle("env-lacre-emblema--coracao", false);
}

function prepararEnvelope(geo, carta, jaAberta) {
  zerarEnvelope();
  el.env.style.setProperty("--env-l", `${geo.L}px`);
  el.env.style.left = `${geo.left}px`;
  el.env.style.top = `${geo.top}px`;
  el.env.hidden = false;
  if (carta.trancada) el.env.classList.add("env-corpo--trancado");
  emblema(carta);
  if (jaAberta) el.env.classList.add("env-corpo--aberto");
}

// Leva o envelope grande até o desenho do envelope na grade.
function deOndeVeio(botao, geo) {
  const corpo = botao.querySelector(".envelope-corpo") || botao;
  const r = corpo.getBoundingClientRect();
  const escala = r.width / geo.L;
  return `translate(${r.left - geo.left}px, ${r.top - geo.top}px) scale(${escala})`;
}

function prepararDobras(alturaFolha) {
  const terco = alturaFolha / 3;
  el.dobras[0].style.top = `${terco}px`;
  el.dobras[0].style.height = `${terco}px`;
  el.dobras[1].style.top = `${terco * 2}px`;
  el.dobras[1].style.height = `${alturaFolha - terco * 2}px`;
  el.dobras.forEach((d) => { d.style.display = "block"; });
  return terco;
}

const dobrada = "perspective(900px) rotateX(180deg)";
const desdobrada = "perspective(900px) rotateX(0deg)";

// Espera ela tocar no lacre. Devolve "abrir" ou "fechar".
function esperarToqueNoLacre(geo) {
  const folga = geo.L * 0.08;
  Object.assign(el.tocar.style, {
    left: `${geo.left - folga}px`,
    top: `${geo.top - folga}px`,
    width: `${geo.L + folga * 2}px`,
    height: `${geo.H + folga * 2}px`,
  });
  el.dica.style.top = `${geo.top + geo.H + 14}px`;
  el.tocar.hidden = false;
  el.lacre.classList.add("env-lacre--chamando");
  animar(el.dica, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], 500, { delay: 250 });
  el.tocar.focus({ preventScroll: true });
  return new Promise((resolver) => {
    aoTocarNoLacre = (resposta) => {
      aoTocarNoLacre = null;
      el.tocar.hidden = true;
      el.lacre.classList.remove("env-lacre--chamando");
      resolver(resposta);
    };
  });
}

// O lacre racha e cai em pedaços.
async function quebrarLacre(geo) {
  const r = el.lacre.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  animar(el.dica, [{ opacity: 1 }, { opacity: 0 }], 200);
  vibrar([14, 40, 22]);
  // 1. a rachadura corre pelo meio
  animar(el.lacre, [{ transform: "translate(-50%, -58%) scale(1)" }, { transform: "translate(-50%, -58%) scale(0.94)" }, { transform: "translate(-50%, -58%) scale(1.02)" }], 220, { easing: "ease-out" });
  await animar(el.racha, [{ strokeDashoffset: 120 }, { strokeDashoffset: 0 }], 200, { easing: "ease-in" });
  // 2. as metades se soltam e caem
  el.metades.forEach((m) => { m.style.display = "block"; });
  el.cera.style.opacity = "0";
  animar(el.racha, [{ opacity: 1 }, { opacity: 0 }], 80);
  animar(el.iniciais, [{ opacity: 1 }, { opacity: 0 }], 120);
  const L = geo.L;
  animar(el.metades[0], [
    { transform: "none", opacity: 1 },
    { offset: 0.22, transform: `translate(${-L * 0.035}px, ${-L * 0.03}px) rotate(-10deg)`, opacity: 1 },
    { transform: `translate(${-L * 0.2}px, ${L * 0.8}px) rotate(-80deg)`, opacity: 0 },
  ], 760, { easing: "cubic-bezier(0.5, 0, 0.75, 0.4)" });
  animar(el.metades[1], [
    { transform: "none", opacity: 1 },
    { offset: 0.22, transform: `translate(${L * 0.04}px, ${-L * 0.025}px) rotate(12deg)`, opacity: 1 },
    { transform: `translate(${L * 0.24}px, ${L * 0.78}px) rotate(95deg)`, opacity: 0 },
  ], 820, { easing: "cubic-bezier(0.5, 0, 0.75, 0.4)" });
  farelos(cx, cy, 10, L);
  await esperar(110);
}

async function abrir(carta, botao, autor, jaAberta) {
  const minha = atual;
  const vivo = () => atual === minha && !el.fundo.hidden;
  estado = "chegando";
  pedidoDeFechar = null;
  preencher(carta, autor);

  el.fundo.hidden = false;
  el.fundo.classList.remove("carta-fundo--simples");

  if (!podeAnimar()) {
    // Sem animação: a carta só aparece.
    el.fundo.classList.add("carta-fundo--simples");
    el.env.hidden = true;
    el.folha.style.visibility = "";
    estado = "aberta";
    if (minha.aoAbrir) minha.aoAbrir();
    atualizarFita();
    el.titulo.focus({ preventScroll: true });
    if (pedidoDeFechar) fechar(pedidoDeFechar);
    return;
  }

  const geo = geometria();
  atual.geo = geo;
  prepararEnvelope(geo, carta, jaAberta);
  el.folha.style.visibility = "hidden";
  el.dobras.forEach((d) => { d.style.display = "none"; });
  botao.style.visibility = "hidden";

  // 1. o fundo escurece e o envelope voa da grade para o centro, pousando
  animar(el.fundo, [{ opacity: 0 }, { opacity: 1 }], 320);
  const de = deOndeVeio(botao, geo);
  await animar(el.env, [
    { transform: de, opacity: 0.85 },
    { offset: 0.55, transform: `translate(0, ${-geo.H * 0.1}px) rotate(-2.5deg) scale(1.03)`, opacity: 1 },
    { offset: 0.8, transform: "translate(0, 3px) rotate(0.6deg) scale(0.995)" },
    { transform: "none", opacity: 1 },
  ], 720, { easing: "cubic-bezier(0.3, 0.7, 0.3, 1)" });
  if (!vivo()) return;

  if (pedidoDeFechar) {
    await voltarSemAbrir();
    return;
  }

  // 2. primeira vez: ela toca no lacre, ele racha e a aba abre
  if (!jaAberta) {
    estado = "esperando";
    const resposta = await esperarToqueNoLacre(geo);
    if (!vivo()) return;
    if (resposta === "fechar") {
      await voltarSemAbrir();
      return;
    }
    estado = "abrindo";
    if (minha.aoAbrir) minha.aoAbrir();
    await quebrarLacre(geo);
    const abrindo = girarAba(0, ABA_ABERTA, 720, passaUmPouco, geo.L);
    await esperar(300);
    brilhos(geo.left + geo.L / 2, geo.top + geo.H * 0.1, 26, geo.L);
    await abrindo;
  } else {
    estado = "abrindo";
    if (minha.aoAbrir) minha.aoAbrir();
    brilhos(geo.left + geo.L / 2, geo.top, 14, geo.L);
  }

  // 3. a carta sobe e sai do envelope
  const deY = jaAberta ? PAPEL_ESPIA * PAPEL_ALTURA * geo.H : 0;
  await animar(el.mini, [
    { transform: `translateY(${deY}px) rotate(0deg)` },
    { offset: 0.7, transform: `translateY(${-geo.subida * 1.04}px) rotate(-1.2deg)` },
    { transform: `translateY(${-geo.subida}px) rotate(0deg)` },
  ], 620, { easing: SOBE });
  if (!vivo()) return;

  // 4. troca pela folha (dobrada), que vem para a frente enquanto o envelope afunda
  const destino = el.folha.getBoundingClientRect();
  const origem = el.mini.getBoundingClientRect();
  const alturaFolha = destino.height;
  const terco = prepararDobras(alturaFolha);
  el.dobras.forEach((d) => { d.style.transform = dobrada; });
  el.folha.style.clipPath = `inset(0 0 ${alturaFolha - terco}px 0)`;
  el.conteudo.style.opacity = "0";
  const voltar = `translate(${origem.left - destino.left}px, ${origem.top - destino.top}px) scale(${origem.width / destino.width})`;
  geo.origem = origem;
  el.mini.style.opacity = "0";
  el.folha.style.visibility = "";

  animar(el.env, [
    { transform: "none", opacity: 1, filter: "blur(0)" },
    { transform: `translate(${geo.L * 0.05}px, ${geo.H * 0.55}px) scale(0.9)`, opacity: 0.22, filter: "blur(1.5px)" },
  ], 560);
  await animar(el.folha, [
    { transform: voltar },
    { offset: 0.6, transform: "translate(0, -10px) rotate(-1.2deg)" },
    { transform: "none" },
  ], 560);
  if (!vivo()) return;

  // 5. desdobra: primeiro o meio, depois a parte de baixo (com sombra no papel)
  const sombra = [{ filter: "brightness(0.7)" }, { filter: "brightness(1)" }];
  animar(el.dobras[0], [{ transform: dobrada }, { transform: desdobrada }], 280, { easing: "ease-out" });
  animar(el.dobras[0], sombra, 280, { easing: "ease-out" });
  await animar(el.folha, [{ clipPath: `inset(0 0 ${alturaFolha - terco}px 0)` }, { clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }], 280, { easing: "ease-out" });
  animar(el.dobras[1], [{ transform: dobrada }, { transform: desdobrada }], 280, { easing: "ease-out" });
  animar(el.dobras[1], sombra, 280, { easing: "ease-out" });
  await animar(el.folha, [{ clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }, { clipPath: "inset(0 0 0px 0)" }], 280, { easing: "ease-out" });
  if (!vivo()) return;

  // 6. o texto aparece como tinta e a assinatura é escrita
  limpar(el.folha, ...el.dobras);
  el.folha.style.clipPath = "";
  el.dobras.forEach((d) => { d.style.display = "none"; d.style.transform = ""; });
  el.vincos.forEach((v) => {
    animar(v, [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0.4 }], 1800, { easing: "ease-out" });
  });
  el.conteudo.style.opacity = "";
  void el.folha.offsetWidth;
  el.folha.classList.add("folha--escrevendo");
  atualizarFita();
  if (el.folha.classList.contains("folha--rolavel")) mostrarFita(2200);

  estado = "aberta";
  el.titulo.focus({ preventScroll: true });
  if (pedidoDeFechar) fechar(pedidoDeFechar);
}

// Ela desistiu antes de quebrar o lacre: o envelope só volta.
async function voltarSemAbrir() {
  estado = "fechando";
  const minha = atual;
  const { botao, geo } = minha;
  animar(el.dica, [{ opacity: 1 }, { opacity: 0 }], 160);
  animar(el.fundo, [{ opacity: 1 }, { opacity: 0 }], 360);
  await animar(el.env, [{ transform: "none", opacity: 1 }, { transform: deOndeVeio(botao, geo), opacity: 0.85 }], 420, { easing: "ease-in-out" });
  if (atual !== minha) return;
  el.fundo.hidden = true;
  limpar(el.fundo);
  zerarEnvelope();
  el.folha.style.visibility = "";
  terminarDeFechar("guardar", false);
}

async function fechar(motivo = "guardar") {
  if (estado !== "aberta") return;
  estado = "fechando";
  voz.pause();
  const minha = atual;
  const vivo = () => atual === minha && !el.fundo.hidden;
  const { botao, geo, carta } = minha;
  const voltaLacrada = Boolean(carta.trancada) && !atual.jaAberta;

  if (!podeAnimar() || !geo || el.fundo.classList.contains("carta-fundo--simples")) {
    el.fundo.hidden = true;
    el.folha.classList.remove("folha--escrevendo");
    terminarDeFechar(motivo, true);
    return;
  }

  // 1. o texto some e a folha volta ao topo
  await animar(el.conteudo, [{ opacity: 1 }, { opacity: 0 }], 160);
  if (!vivo()) return;
  el.folha.classList.remove("folha--escrevendo", "folha--rolando");
  el.rolagem.scrollTop = 0;
  el.rolagem.classList.remove("folha-rolagem--acima", "folha-rolagem--abaixo");
  limpar(...el.vincos);

  // 2. dobra: primeiro a parte de baixo, depois o meio
  const alturaFolha = el.folha.getBoundingClientRect().height;
  const terco = prepararDobras(alturaFolha);
  const sombra = [{ filter: "brightness(1)" }, { filter: "brightness(0.72)" }];
  animar(el.dobras[1], [{ transform: desdobrada }, { transform: dobrada }], 220, { easing: "ease-in" });
  animar(el.dobras[1], sombra, 220, { easing: "ease-in" });
  await animar(el.folha, [{ clipPath: "inset(0 0 0px 0)" }, { clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }], 220, { easing: "ease-in" });
  animar(el.dobras[0], [{ transform: desdobrada }, { transform: dobrada }], 220, { easing: "ease-in" });
  animar(el.dobras[0], sombra, 220, { easing: "ease-in" });
  await animar(el.folha, [{ clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }, { clipPath: `inset(0 0 ${alturaFolha - terco}px 0)` }], 220, { easing: "ease-in" });
  if (!vivo()) return;

  // 3. a carta dobrada volta para cima do envelope (que sobe de novo)
  const destino = el.folha.getBoundingClientRect();
  const origem = geo.origem;
  const voltar = `translate(${origem.left - destino.left}px, ${origem.top - destino.top}px) scale(${origem.width / destino.width})`;
  animar(el.env, [
    { transform: `translate(${geo.L * 0.05}px, ${geo.H * 0.55}px) scale(0.9)`, opacity: 0.22, filter: "blur(1.5px)" },
    { transform: "none", opacity: 1, filter: "blur(0)" },
  ], 420);
  await animar(el.folha, [{ transform: "none" }, { offset: 0.45, transform: "translate(0, -8px) rotate(1deg)" }, { transform: voltar }], 440);
  if (!vivo()) return;

  // 4. troca de volta pela cartinha, que desce para dentro do envelope
  el.folha.style.visibility = "hidden";
  limpar(el.folha, ...el.dobras);
  el.folha.style.clipPath = "";
  el.dobras.forEach((d) => { d.style.display = "none"; d.style.transform = ""; });
  el.conteudo.style.opacity = "";
  limpar(el.conteudo);
  el.mini.style.opacity = "";
  const espia = voltaLacrada ? 0 : PAPEL_ESPIA * PAPEL_ALTURA * geo.H;
  limpar(el.mini);
  await animar(el.mini, [{ transform: `translateY(${-geo.subida}px)` }, { transform: `translateY(${espia}px)` }], 420, { easing: "cubic-bezier(0.55, 0, 0.3, 1)" });
  if (!vivo()) return;

  // 5. (só na prévia de uma trancada) a aba fecha e um lacre novo é carimbado
  if (voltaLacrada) {
    await girarAba(ABA_ABERTA, 0, 360, entraDevagar, geo.L);
    el.metades.forEach((m) => { m.style.display = ""; });
    limpar(...el.metades, el.racha);
    el.cera.style.opacity = "";
    await animar(el.lacre, [
      { transform: "translate(-50%, -58%) scale(1.5)", opacity: 0 },
      { transform: "translate(-50%, -58%) scale(0.92)", opacity: 1 },
      { transform: "translate(-50%, -58%) scale(1)", opacity: 1 },
    ], 320, { easing: "ease-out" });
    animar(el.iniciais, [{ opacity: 0 }, { opacity: 1 }], 200);
    vibrar(16);
  }

  // 6. o envelope volta para o lugar dele na grade
  animar(el.fundo, [{ opacity: 1 }, { opacity: 0 }], 420);
  await animar(el.env, [
    { transform: "none", opacity: 1 },
    { offset: 0.4, transform: `translate(0, ${-geo.H * 0.06}px) rotate(1.5deg) scale(1.02)`, opacity: 1 },
    { transform: deOndeVeio(botao, geo), opacity: 0.9 },
  ], 520, { easing: "cubic-bezier(0.5, 0, 0.3, 1)" });
  if (!vivo()) return;

  el.fundo.hidden = true;
  limpar(el.fundo);
  zerarEnvelope();
  el.folha.style.visibility = "";
  terminarDeFechar(motivo, true);
}

function terminarDeFechar(motivo, abriu) {
  estado = "fechada";
  const { botao, carta } = atual;
  botao.style.visibility = "";
  atual = null;
  if (aoTerminarDeFechar) aoTerminarDeFechar(motivo, carta, botao, abriu);
}

// Fecha na hora, sem animação (quando ela sai da tela).
function fecharJa() {
  if (estado === "fechada") return;
  voz.pause();
  if (aoTocarNoLacre) aoTocarNoLacre("fechar");
  el.fundo.hidden = true;
  limpar(el.fundo, el.folha, el.conteudo, ...el.dobras, ...el.vincos);
  zerarEnvelope();
  el.folha.style.clipPath = "";
  el.folha.style.visibility = "";
  el.folha.classList.remove("folha--escrevendo", "folha--rolando");
  el.conteudo.style.opacity = "";
  el.dobras.forEach((d) => { d.style.display = "none"; });
  if (atual && atual.botao) atual.botao.style.visibility = "";
  atual = null;
  estado = "fechada";
}

// ---------------------------------------------------------------------
// A grade de envelopes
// ---------------------------------------------------------------------
let iniciaisAtuais = "♥";

function iniciais(conteudo) {
  const a = texto(conteudo && conteudo.nome);
  const b = texto(conteudo && conteudo.autor);
  if (a && b) return `${a[0]}♥${b[0]}`;
  return (a || b || "♥")[0];
}

const ICONE_CADEADO = "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z";

function cadeado(tamanho = 12) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(tamanho));
  svg.setAttribute("height", String(tamanho));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", ICONE_CADEADO);
  svg.append(p);
  return svg;
}

// O desenho do envelope na grade (o mesmo do envelope grande, em miniatura).
function desenhoDoEnvelope({ aberto, trancado }) {
  const classes = ["envelope-corpo", "env-corpo"];
  if (aberto) classes.push("env-corpo--aberto");
  if (trancado) classes.push("env-corpo--trancado");
  const marca = trancado
    ? h("span", { class: "env-lacre-emblema" }, cadeado(24))
    : h("span", { class: "env-lacre-emblema env-lacre-emblema--coracao" }, "♥");
  return h(
    "span",
    { class: "envelope-arte", "aria-hidden": "true" },
    h(
      "span",
      { class: classes.join(" ") },
      h("span", { class: "env-aba" }, h("span", { class: "env-aba-face" })),
      h("span", { class: "env-costas" }),
      h("span", { class: "env-papel" }, h("i"), h("i"), h("i"), h("i")),
      h("span", { class: "env-bolso" }),
      trancado ? h("span", { class: "env-barbante" }) : null,
      h("span", { class: "env-lacre" }, h("span", { class: "env-lacre-cera" }), marca)
    )
  );
}

function textoDaContagem(dias) {
  if (dias <= 1) return "Abre amanhã";
  return `Faltam ${dias} dias`;
}

// Mostra a grade e espera ela tocar em "Continuar".
// Devolve "seguir" ou { responder: "título da carta" }.
export async function tocarCartas(conteudo, { deCantinho = false } = {}) {
  pegar();
  const cartas = cartasDoConteudo(conteudo);
  const autor = texto(conteudo && conteudo.autor);
  const lidas = lerConjunto("cartas-lidas");
  const previa = ehPrevia();
  let avisoTempo = null;

  el.seguir.textContent = deCantinho ? "Voltar ao cantinho" : "Continuar";
  el.aviso.textContent = "";
  iniciaisAtuais = iniciais(conteudo);
  el.responder.hidden = false;

  function avisar(mensagem) {
    el.aviso.textContent = mensagem;
    clearTimeout(avisoTempo);
    avisoTempo = setTimeout(() => { el.aviso.textContent = ""; }, 5000);
  }

  function tremer(botao) {
    botao.classList.remove("envelope--tremendo");
    void botao.offsetWidth;
    botao.classList.add("envelope--tremendo");
    vibrar(30);
  }

  function desenhar() {
    el.lista.replaceChildren(
      ...cartas.map((carta) => {
        const trancada = Boolean(carta.trancada);
        const lida = lidas.has(carta.id);
        const nova = !trancada && Boolean(carta.libera_em) && !lida;
        const dias = trancada ? diasAte(carta.libera_em) : 0;

        let marca;
        if (trancada) marca = [cadeado(), ` ${textoDaContagem(dias)}`];
        else if (nova) marca = "Nova!";
        else if (lida) marca = "Lida";
        else marca = "Pode abrir";

        const classes = ["envelope"];
        if (trancada) classes.push("envelope--trancado");
        if (lida && !trancada) classes.push("envelope--lido");
        if (nova) classes.push("envelope--nova");

        const botao = h(
          "button",
          {
            class: classes.join(" "),
            type: "button",
            "data-id": carta.id,
            "aria-disabled": trancada && !previa ? "true" : null,
            "aria-label": trancada
              ? `Abre quando ${texto(carta.titulo)}. Trancada até ${dataPorExtenso(carta.libera_em)}.`
              : `Abre quando ${texto(carta.titulo)}${nova ? ". Carta nova." : lida ? ". Já lida." : ""}`,
          },
          desenhoDoEnvelope({ aberto: lida && !trancada, trancado: trancada }),
          h("span", { class: "envelope-marca" }, marca),
          h("span", { class: "envelope-titulo" }, texto(carta.titulo)),
          trancada ? h("span", { class: "envelope-data" }, `abre ${dataCurta(carta.libera_em, "/")}${previa ? " · prévia" : ""}`) : null
        );
        botao.addEventListener("animationend", (evento) => {
          if (evento.animationName === "envelope-treme") botao.classList.remove("envelope--tremendo");
        });
        botao.addEventListener("click", () => {
          if (estado !== "fechada") return;
          if (trancada && !previa) {
            tremer(botao);
            avisar(`Essa carta só abre em ${dataPorExtenso(carta.libera_em)}. Guarda ela até lá.`);
            return;
          }
          const jaAberta = !trancada && lidas.has(carta.id);
          // Só conta como lida quando o lacre quebra de verdade.
          const aoAbrir = () => {
            if (trancada) return;
            lidas.add(carta.id);
            guardarConjunto("cartas-lidas", lidas);
            if (!previa) registrarCarta(carta.id, texto(carta.titulo)).catch(() => {});
          };
          atual = { carta, botao, jaAberta, aoAbrir };
          abrir(carta, botao, autor, jaAberta);
        });
        return botao;
      })
    );
  }

  desenhar();
  await mostrarTela("tela-cartas");

  return new Promise((resolver) => {
    const sair = (resultado) => {
      el.seguir.removeEventListener("click", aoSeguir);
      aoTerminarDeFechar = null;
      clearTimeout(avisoTempo);
      fecharJa();
      resolver(resultado);
    };
    const aoSeguir = () => sair("seguir");
    el.seguir.addEventListener("click", aoSeguir);

    aoTerminarDeFechar = (motivo, carta) => {
      if (motivo === "responder") {
        sair({ responder: texto(carta.titulo) });
        return;
      }
      desenhar();
      const mesmo = el.lista.querySelector(`[data-id="${CSS.escape(String(carta.id))}"]`);
      if (mesmo) mesmo.focus({ preventScroll: true });
    };
  });
}
