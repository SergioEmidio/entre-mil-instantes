// =====================================================================
// Entre Mil Instantes · site/telas.js
// Troca de telas com transição suave e o céu estrelado do fundo.
// =====================================================================

import { atualizarFioDaPagina } from "./fio.js";
import { ligarLuz } from "./efeitos.js";

const SAIDA_MS = 450;   // igual ao --medio do CSS
let telaAtual = document.querySelector(".cena--ativa");
let trocando = Promise.resolve();

const menosMovimento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Mostra a tela de id informado. As trocas ficam em fila, nunca se atropelam.
export function mostrarTela(id) {
  trocando = trocando.then(() => trocarPara(id));
  return trocando;
}

async function trocarPara(id) {
  const nova = document.getElementById(id);
  if (!nova || nova === telaAtual) return;

  const antiga = telaAtual;
  if (antiga && !menosMovimento()) {
    antiga.classList.add("cena--saindo");
    await esperar(SAIDA_MS);
  }
  if (antiga) {
    antiga.hidden = true;
    antiga.classList.remove("cena--ativa", "cena--saindo", "cena--entrando");
  }

  nova.hidden = false;
  nova.classList.add("cena--ativa", "cena--entrando", "cena--recem");
  telaAtual = nova;
  revelarEmCascata(nova);
  clearTimeout(nova.__recem);
  nova.__recem = setTimeout(() => nova.classList.remove("cena--recem"), 2800);

  // Tira a animação de entrada quando ela acaba: enquanto ela "fica",
  // as janelas fixas da tela (carta aberta, confete, mini player) ficariam
  // presas à tela em vez de ao celular.
  const limpar = (evento) => {
    if (evento && evento.target !== nova) return;
    nova.removeEventListener("animationend", limpar);
    nova.classList.remove("cena--entrando");
  };
  nova.addEventListener("animationend", limpar);
  setTimeout(() => limpar(), 1200);
  window.scrollTo(0, 0);
  atualizarFioDaPagina();

  // Leva o foco para o título da tela nova (bom para leitores de tela).
  const titulo = nova.querySelector("h1");
  if (titulo) {
    titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
  }
}

// ---------------------------------------------------------------------
// Entrada em cascata: os blocos da tela chegam um depois do outro
// (de cima para baixo), em vez de tudo aparecer de uma vez.
// ---------------------------------------------------------------------
const AGRUPADORES = ".pagina-cabeca, .pilha, .abertura-meio, .abertura-pe, .radio-info, .carga-textos, .senha-form, .aa-cabeca, .presente-fechado, .recado-escrever";
const LISTAS = ".cantinho, .lista-placar, .vales, .cartao-estilos";
const NUNCA = ".cartas, .abertura-titulo, .confete, .segredo, .carta-fundo, .radio-mini, [hidden]";

function revelarEmCascata(tela) {
  if (menosMovimento() || typeof Element.prototype.animate !== "function") return;
  if (tela.classList.contains("cena--stories")) return;
  const raiz = tela.querySelector(".tela, .radio, .tocando");
  if (!raiz) return;
  const blocos = [];
  const juntar = (el) => {
    if (!el || el.matches(NUNCA) || blocos.length >= 16) return;
    if (el.matches(AGRUPADORES)) {
      for (const filho of el.children) juntar(filho);
      return;
    }
    if (el.matches(LISTAS)) {
      [...el.children].slice(0, 8).forEach((filho) => !filho.matches(NUNCA) && blocos.push(filho));
      return;
    }
    blocos.push(el);
  };
  for (const filho of raiz.children) juntar(filho);
  blocos.forEach((bloco, i) => {
    try {
      bloco.animate(
        [
          { opacity: 0, transform: "translateY(18px)", filter: "blur(3px)" },
          { opacity: 1, transform: "none", filter: "blur(0)" },
        ],
        { duration: 680, delay: 80 + i * 65, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }
      );
    } catch {
      /* animação é enfeite */
    }
  });
}

export function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

// ---------------------------------------------------------------------
// Céu: estrelas espalhadas, em posições fixas (sempre o mesmo céu).
// ---------------------------------------------------------------------
export function desenharCeu(quantidade = 34) {
  const ceu = document.getElementById("ceu");
  if (!ceu || ceu.childElementCount) return;

  let semente = 7351297;
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };

  const fragmento = document.createDocumentFragment();
  for (let i = 0; i < quantidade; i++) {
    const estrela = document.createElement("span");
    estrela.className = "estrela";
    const tamanho = aleatorio() < 0.15 ? 3 : 2;
    estrela.style.cssText = [
      `top: ${(aleatorio() * 100).toFixed(2)}%`,
      `left: ${(aleatorio() * 100).toFixed(2)}%`,
      `width: ${tamanho}px`,
      `height: ${tamanho}px`,
      `animation-delay: ${(aleatorio() * 4).toFixed(2)}s`,
      `animation-duration: ${(3 + aleatorio() * 3).toFixed(2)}s`,
    ].join("; ");
    fragmento.appendChild(estrela);
  }
  ceu.appendChild(fragmento);

  // A luz/inclinação do celular também mexe o céu (profundidade).
  ligarLuz();
  // De vez em quando, uma estrela cadente.
  if (!menosMovimento()) agendarCadente(ceu, 6000);
}

function agendarCadente(ceu, espera) {
  setTimeout(() => {
    if (!document.hidden && !menosMovimento()) {
      const risco = document.createElement("span");
      risco.className = "cadente";
      risco.style.top = `${(4 + Math.random() * 38).toFixed(1)}%`;
      risco.style.left = `${(35 + Math.random() * 60).toFixed(1)}%`;
      risco.addEventListener("animationend", () => risco.remove());
      ceu.appendChild(risco);
    }
    agendarCadente(ceu, 11000 + Math.random() * 14000);
  }, espera);
}
