// =====================================================================
// Nós, em Todos os Instantes · site/instalar.js
// Transforma o site em app e convida ela a instalar.
//
//  · Android (Chrome, Samsung Internet…): botão "Instalar" que abre a
//    janela do próprio celular. Se o celular ainda não ofereceu, mostra
//    onde tocar no menu ⋮.
//  · iPhone: passo a passo (o iPhone não deixa site instalar sozinho).
//  · Já instalado, ou aberto pelo ícone: o convite não aparece.
// =====================================================================

import { lerMemoria, guardarMemoria, ehPrevia } from "./memoria.js";

let pedidoGuardado = null;   // a janela de instalar que o Android oferece
let dispensado = false;      // "Agora não" (vale até ela abrir de novo)
const el = {};

const ua = navigator.userAgent || "";
const ehIphone = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const ehAndroid = /android/i.test(ua);

export function abertoComoApp() {
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true
  );
}

function pegar() {
  if (el.caixa) return;
  el.caixa = document.getElementById("convite-app");
  el.texto = document.getElementById("convite-texto");
  el.botao = document.getElementById("convite-instalar");
  el.passos = document.getElementById("convite-passos");
  el.agoraNao = document.getElementById("convite-agora-nao");
  if (!el.caixa) return;
  el.botao.addEventListener("click", instalar);
  el.agoraNao.addEventListener("click", () => {
    dispensado = true;
    atualizarConvite();
  });
}

function passos(lista) {
  el.passos.replaceChildren(
    ...lista.map((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      return li;
    })
  );
  el.passos.hidden = false;
}

export function atualizarConvite() {
  pegar();
  if (!el.caixa) return;
  const instalado = abertoComoApp() || lerMemoria("app-instalado", false);
  const podeMostrar = !instalado && !dispensado && (pedidoGuardado || ehAndroid || ehIphone || ehPrevia());
  el.caixa.hidden = !podeMostrar;
  if (!podeMostrar) return;

  el.passos.hidden = true;
  if (pedidoGuardado) {
    el.texto.textContent = "Instala o app e abre direto pelo ícone, quando quiser: as cartas e a nossa lista ficam a um toque.";
    el.botao.hidden = false;
  } else if (ehIphone) {
    el.texto.textContent = "No iPhone é assim:";
    el.botao.hidden = true;
    passos([
      "Abre este site no Safari.",
      "Toca no botão Compartilhar (o quadrado com a setinha para cima).",
      "Escolhe «Adicionar à Tela de Início» e toca em Adicionar.",
    ]);
  } else {
    el.texto.textContent = "Para instalar:";
    el.botao.hidden = true;
    passos([
      "Toca no menu ⋮ do navegador (no canto de cima).",
      "Escolhe «Instalar app» ou «Adicionar à tela inicial».",
      "Confirma. O ícone «Nossos Instantes» aparece na tua tela.",
    ]);
  }
}

async function instalar() {
  if (!pedidoGuardado) return;
  const pedido = pedidoGuardado;
  pedidoGuardado = null;
  el.botao.disabled = true;
  try {
    await pedido.prompt();
    const escolha = await pedido.userChoice;
    if (escolha && escolha.outcome === "accepted") {
      guardarMemoria("app-instalado", true);
      mostrarInstalado();
      return;
    }
  } catch {
    /* ela fechou a janela: tudo bem */
  } finally {
    el.botao.disabled = false;
  }
  atualizarConvite();
}

function mostrarInstalado() {
  pegar();
  if (!el.caixa) return;
  el.caixa.hidden = false;
  el.botao.hidden = true;
  el.passos.hidden = true;
  el.agoraNao.hidden = true;
  el.texto.textContent = "Pronto! Procura o ícone «Nossos Instantes» na tua tela inicial.";
  setTimeout(() => {
    el.caixa.hidden = true;
    el.agoraNao.hidden = false;
  }, 6000);
}

// ---------------------------------------------------------------------
// Ligar (uma vez, quando o site abre)
// ---------------------------------------------------------------------
export function prepararApp() {
  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();   // o convite é nosso, no momento certo
    pedidoGuardado = evento;
    atualizarConvite();
  });

  window.addEventListener("appinstalled", () => {
    pedidoGuardado = null;
    guardarMemoria("app-instalado", true);
    atualizarConvite();
  });

  if ("serviceWorker" in navigator && window.isSecureContext) {
    const registrar = () =>
      navigator.serviceWorker.register("./sw.js").catch((erro) => {
        console.warn("[Nossos Instantes] O app não ficou instalável agora:", erro);
      });
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar);
  }
}
