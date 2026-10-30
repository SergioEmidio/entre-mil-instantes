// =====================================================================
// Entre Mil Instantes · site/cartas.js
// Tela 13: cartas «Abre quando…».
//
// Abrir: o envelope sai da grade e vem para o centro → o lacre racha →
// a aba abre → a carta sobe e sai do envelope → vai para a frente e
// desdobra (dobrada em três) → o texto aparece.
// Guardar: tudo ao contrário, e o envelope volta para o lugar dele.
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

function animar(el, quadros, ms, opcoes = {}) {
  if (!el) return Promise.resolve();
  const a = el.animate(quadros, { duration: ms, easing: SUAVE, fill: "forwards", ...opcoes });
  return a.finished.then(() => a, () => a);
}

function limpar(...els) {
  for (const el of els) {
    if (el && typeof el.getAnimations === "function") el.getAnimations().forEach((a) => a.cancel());
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const minSeg = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

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
  };
  for (const [nome, id] of Object.entries(ids)) el[nome] = document.getElementById(id);
  el.metades = [...el.lacre.querySelectorAll(".env-lacre-metade")];
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
// Abrir e guardar
// ---------------------------------------------------------------------
let estado = "fechada";       // fechada | abrindo | aberta | fechando
let pedidoDeFechar = null;    // pedido feito no meio da animação de abrir
let aoTerminarDeFechar = null;
let atual = null;             // { carta, botao, geo }

function pedirFechar(motivo = "guardar") {
  if (estado === "aberta") {
    fechar(motivo);
  } else if (estado === "abrindo") {
    pedidoDeFechar = motivo;
  }
}

// Onde o envelope grande fica (cabe em celular pequeno e deitado).
function geometria() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const L = Math.max(160, Math.min(vw - 48, 320, (vh * 0.42) / 0.64));
  const H = L * 0.64;
  const subida = H * 0.62;
  const left = (vw - L) / 2;
  const top = Math.min(vh - H - 24, Math.max(vh / 2 - H * 0.25, subida + 24));
  return { L, H, subida, left, top };
}

function preencher(carta, autor) {
  el.titulo.textContent = texto(carta.titulo);
  el.texto.textContent = texto(carta.texto);
  el.assinatura.textContent = autor ? `Com amor, ${autor}.` : "";
  el.assinatura.hidden = !autor;
  prepararVoz(carta);
  el.rolagem.scrollTop = 0;
}

function estadoInicialDoEnvelope(geo) {
  el.env.style.setProperty("--env-l", `${geo.L}px`);
  el.env.style.left = `${geo.left}px`;
  el.env.style.top = `${geo.top}px`;
  el.env.hidden = false;
  el.aba.style.zIndex = "";
  el.mini.style.opacity = "";
  limpar(el.env, el.mini, el.aba, el.iniciais, ...el.metades);
}

// Transforma o retângulo do botão da grade no envelope grande.
function deOndeVeio(botao, geo) {
  const r = botao.getBoundingClientRect();
  const escala = r.width / geo.L;
  const dy = r.top + r.height / 2 - (geo.top + (geo.H * escala) / 2);
  return `translate(${r.left - geo.left}px, ${dy}px) scale(${escala})`;
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
const aberta = "perspective(900px) rotateX(0deg)";

async function abrir(carta, botao, autor) {
  estado = "abrindo";
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
    el.titulo.focus({ preventScroll: true });
    if (pedidoDeFechar) fechar(pedidoDeFechar);
    return;
  }

  const geo = geometria();
  atual.geo = geo;
  estadoInicialDoEnvelope(geo);
  el.folha.style.visibility = "hidden";
  el.dobras.forEach((d) => { d.style.display = "none"; });
  botao.style.visibility = "hidden";

  // 1. fundo escurece e o envelope vem da grade para o centro
  animar(el.fundo, [{ opacity: 0 }, { opacity: 1 }], 260);
  animar(el.env, [
    { transform: deOndeVeio(botao, geo), opacity: 0.6 },
    { transform: "none", opacity: 1 },
  ], 420);
  await esperar(330);

  // 2. o lacre racha
  vibrar([18, 30, 18]);
  animar(el.iniciais, [{ opacity: 1 }, { opacity: 0 }], 140);
  animar(el.metades[0], [{ transform: "none", opacity: 1 }, { transform: "translate(-38%, 30%) rotate(-28deg)", opacity: 0 }], 260);
  animar(el.metades[1], [{ transform: "none", opacity: 1 }, { transform: "translate(38%, 30%) rotate(28deg)", opacity: 0 }], 260);
  await esperar(150);

  // 3. a aba abre (depois da metade ela fica atrás da carta)
  setTimeout(() => { el.aba.style.zIndex = "1"; }, 170);
  await animar(el.aba, [{ transform: aberta }, { transform: dobrada }], 340);

  // 4. a carta sobe e sai do envelope
  await animar(el.mini, [{ transform: "none" }, { transform: `translateY(${-geo.subida}px)` }], 420, { easing: SOBE });

  // 5. troca pela folha (dobrada), que vem para a frente enquanto o envelope desce
  const destino = el.folha.getBoundingClientRect();
  const origem = el.mini.getBoundingClientRect();
  geo.origem = origem;
  const alturaFolha = destino.height;
  const terco = prepararDobras(alturaFolha);
  el.dobras.forEach((d) => { d.style.transform = dobrada; });
  el.folha.style.clipPath = `inset(0 0 ${alturaFolha - terco}px 0)`;
  el.conteudo.style.opacity = "0";
  el.vincos.forEach((v) => { v.style.opacity = "0"; });
  const voltar = `translate(${origem.left - destino.left}px, ${origem.top - destino.top}px) scale(${origem.width / destino.width})`;
  geo.voltar = voltar;
  el.mini.style.opacity = "0";
  el.folha.style.visibility = "";

  animar(el.env, [{ transform: "none", opacity: 1 }, { transform: `translate(${geo.L * 0.04}px, ${geo.H * 0.35}px) scale(0.92)`, opacity: 0.3 }], 440);
  await animar(el.folha, [{ transform: voltar }, { transform: "none" }], 440);

  // 6. desdobra: primeiro o meio, depois a parte de baixo
  animar(el.dobras[0], [{ transform: dobrada }, { transform: aberta }], 230, { easing: "ease-out" });
  await animar(el.folha, [{ clipPath: `inset(0 0 ${alturaFolha - terco}px 0)` }, { clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }], 230, { easing: "ease-out" });
  animar(el.dobras[1], [{ transform: dobrada }, { transform: aberta }], 230, { easing: "ease-out" });
  await animar(el.folha, [{ clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }, { clipPath: "inset(0 0 0px 0)" }], 230, { easing: "ease-out" });

  // 7. o texto aparece, como tinta
  limpar(el.folha, ...el.dobras);
  el.folha.style.clipPath = "";
  el.dobras.forEach((d) => { d.style.display = "none"; d.style.transform = ""; });
  el.vincos.forEach((v) => { v.style.opacity = ""; });
  el.conteudo.style.opacity = "";
  await animar(el.conteudo, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], 320);
  limpar(el.conteudo);

  estado = "aberta";
  el.titulo.focus({ preventScroll: true });
  if (pedidoDeFechar) fechar(pedidoDeFechar);
}

async function fechar(motivo = "guardar") {
  if (estado !== "aberta") return;
  estado = "fechando";
  voz.pause();
  const { botao, geo } = atual;

  if (!podeAnimar() || !geo || el.fundo.classList.contains("carta-fundo--simples")) {
    el.fundo.hidden = true;
    terminarDeFechar(motivo);
    return;
  }

  // 1. o texto some e a folha volta ao topo
  await animar(el.conteudo, [{ opacity: 1 }, { opacity: 0 }], 130);
  el.rolagem.scrollTop = 0;

  // 2. dobra: primeiro a parte de baixo, depois o meio
  const alturaFolha = el.folha.getBoundingClientRect().height;
  const terco = prepararDobras(alturaFolha);
  el.vincos.forEach((v) => { v.style.opacity = "0"; });
  animar(el.dobras[1], [{ transform: aberta }, { transform: dobrada }], 190, { easing: "ease-in" });
  await animar(el.folha, [{ clipPath: "inset(0 0 0px 0)" }, { clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }], 190, { easing: "ease-in" });
  animar(el.dobras[0], [{ transform: aberta }, { transform: dobrada }], 190, { easing: "ease-in" });
  await animar(el.folha, [{ clipPath: `inset(0 0 ${alturaFolha - terco * 2}px 0)` }, { clipPath: `inset(0 0 ${alturaFolha - terco}px 0)` }], 190, { easing: "ease-in" });

  // 3. a carta dobrada volta para cima do envelope (que sobe de novo)
  const destino = el.folha.getBoundingClientRect();
  const origem = geo.origem;
  const voltar = `translate(${origem.left - destino.left}px, ${origem.top - destino.top}px) scale(${origem.width / destino.width})`;
  animar(el.env, [{ transform: `translate(${geo.L * 0.04}px, ${geo.H * 0.35}px) scale(0.92)`, opacity: 0.3 }, { transform: "none", opacity: 1 }], 360);
  await animar(el.folha, [{ transform: "none" }, { transform: voltar }], 360);

  // 4. troca de volta pela cartinha e ela desce para dentro do envelope
  el.folha.style.visibility = "hidden";
  limpar(el.folha, ...el.dobras);
  el.folha.style.clipPath = "";
  el.dobras.forEach((d) => { d.style.display = "none"; d.style.transform = ""; });
  el.vincos.forEach((v) => { v.style.opacity = ""; });
  el.conteudo.style.opacity = "";
  limpar(el.conteudo);
  el.mini.style.opacity = "";
  animar(el.mini, [{ transform: `translateY(${-geo.subida}px)` }, { transform: "none" }], 300, { easing: "ease-in-out" });
  await esperar(220);

  // 5. a aba fecha e o lacre se junta de novo
  setTimeout(() => { el.aba.style.zIndex = ""; }, 130);
  await animar(el.aba, [{ transform: dobrada }, { transform: aberta }], 270, { easing: "ease-in-out" });
  animar(el.iniciais, [{ opacity: 0 }, { opacity: 1 }], 170);
  animar(el.metades[0], [{ transform: "translate(-38%, 30%) rotate(-28deg)", opacity: 0 }, { transform: "none", opacity: 1 }], 170);
  animar(el.metades[1], [{ transform: "translate(38%, 30%) rotate(28deg)", opacity: 0 }, { transform: "none", opacity: 1 }], 170);
  await esperar(120);

  // 6. o envelope volta para o lugar dele na grade
  animar(el.fundo, [{ opacity: 1 }, { opacity: 0 }], 340);
  await animar(el.env, [{ transform: "none", opacity: 1 }, { transform: deOndeVeio(botao, geo), opacity: 0.6 }], 360, { easing: "ease-in-out" });

  el.fundo.hidden = true;
  limpar(el.fundo, el.env, el.mini, el.aba, el.iniciais, ...el.metades);
  el.aba.style.zIndex = "";
  el.mini.style.opacity = "";
  el.folha.style.visibility = "";
  terminarDeFechar(motivo);
}

function terminarDeFechar(motivo) {
  estado = "fechada";
  const { botao, carta } = atual;
  botao.style.visibility = "";
  atual = null;
  if (aoTerminarDeFechar) aoTerminarDeFechar(motivo, carta, botao);
}

// Fecha na hora, sem animação (quando ela sai da tela).
function fecharJa() {
  if (estado === "fechada") return;
  voz.pause();
  el.fundo.hidden = true;
  limpar(el.fundo, el.env, el.mini, el.aba, el.iniciais, el.folha, el.conteudo, ...el.metades, ...el.dobras);
  el.folha.style.clipPath = "";
  el.folha.style.visibility = "";
  el.conteudo.style.opacity = "";
  el.dobras.forEach((d) => { d.style.display = "none"; });
  el.aba.style.zIndex = "";
  el.mini.style.opacity = "";
  if (atual && atual.botao) atual.botao.style.visibility = "";
  atual = null;
  estado = "fechada";
}

// ---------------------------------------------------------------------
// A grade de envelopes
// ---------------------------------------------------------------------
function iniciais(conteudo) {
  const a = texto(conteudo && conteudo.nome);
  const b = texto(conteudo && conteudo.autor);
  if (a && b) return `${a[0]}&${b[0]}`;
  return (a || b || "♥")[0];
}

const ICONE_CADEADO = "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z";

function cadeado() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
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
  el.iniciais.textContent = iniciais(conteudo);
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
        else marca = "Livre";

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
              : `Abre quando ${texto(carta.titulo)}${nova ? ". Carta nova." : ""}`,
          },
          h("span", { class: "envelope-aba", "aria-hidden": "true" }),
          h("span", { class: "envelope-lacre", "aria-hidden": "true" }),
          h("span", { class: "envelope-marca" }, marca),
          h("span", { class: "envelope-titulo" }, texto(carta.titulo)),
          trancada ? h("span", { class: "envelope-data" }, `abre ${dataCurta(carta.libera_em, "/")}${previa ? " · prévia" : ""}`) : null
        );
        botao.addEventListener("animationend", () => botao.classList.remove("envelope--tremendo"));
        botao.addEventListener("click", () => {
          if (estado !== "fechada") return;
          if (trancada && !previa) {
            tremer(botao);
            avisar(`Essa carta só abre em ${dataPorExtenso(carta.libera_em)}. Guarda ela até lá.`);
            return;
          }
          if (!trancada) {
            lidas.add(carta.id);
            guardarConjunto("cartas-lidas", lidas);
            if (!previa) registrarCarta(carta.id, texto(carta.titulo)).catch(() => {});
          }
          atual = { carta, botao };
          abrir(carta, botao, autor);
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
