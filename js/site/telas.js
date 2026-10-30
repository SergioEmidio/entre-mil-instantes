// =====================================================================
// Entre Mil Instantes · site/telas.js
// Troca de telas com transição suave e o céu estrelado do fundo.
// =====================================================================

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
  nova.classList.add("cena--ativa", "cena--entrando");
  telaAtual = nova;

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

  // Leva o foco para o título da tela nova (bom para leitores de tela).
  const titulo = nova.querySelector("h1");
  if (titulo) {
    titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
  }
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
}
