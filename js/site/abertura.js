// =====================================================================
// Entre Mil Instantes · site/abertura.js
// Tela 03: nome dela, "Feliz aniversário", a frase e o botão de entrar.
// Segredo: 5 toques rápidos no nome abrem a mensagem secreta.
// =====================================================================

import { texto } from "./dom.js";
import { dataCurta } from "./datas.js";

const TOQUES_PARA_SEGREDO = 5;
const JANELA_DOS_TOQUES = 3000;   // os 5 toques precisam acontecer em 3 s

let ligada = false;
let aoEntrar = null;

// Preenche a abertura com o conteúdo. Chama entrar() quando ela tocar no botão.
export function montarAbertura(conteudo, entrar) {
  const c = conteudo || {};
  const nome = texto(c.nome) || "Feliz aniversário";
  const autor = texto(c.autor);
  const frase = texto(c.abertura && c.abertura.frase);
  const segredo = texto(c.abertura && c.abertura.segredo);
  const aniversario = dataCurta(c.datas && c.datas.aniversario, " · ");

  const elNome = document.getElementById("abertura-nome");
  elNome.textContent = nome;
  elNome.classList.toggle("abertura-nome--longo", nome.length > 8);
  elNome.classList.toggle("abertura-nome--muito-longo", nome.length > 14);

  const elData = document.getElementById("abertura-data");
  elData.textContent = aniversario;
  elData.hidden = !aniversario;

  const elFrase = document.getElementById("abertura-frase");
  elFrase.textContent = frase;
  elFrase.hidden = !frase;

  document.getElementById("segredo-texto").textContent = segredo ? `“${segredo}”` : "";
  const elAssinatura = document.getElementById("segredo-assinatura");
  elAssinatura.textContent = autor ? `— ${autor}` : "";
  elAssinatura.hidden = !autor;

  aoEntrar = entrar;
  ligarUmaVez(Boolean(segredo));
}

function ligarUmaVez(temSegredo) {
  const elNome = document.getElementById("abertura-nome");
  elNome.dataset.temSegredo = String(temSegredo);
  if (ligada) return;
  ligada = true;

  // ---- 5 toques no nome ----
  let toques = 0;
  let primeiro = 0;
  elNome.addEventListener("click", () => {
    if (elNome.dataset.temSegredo !== "true") return;
    const agora = Date.now();
    if (!toques || agora - primeiro > JANELA_DOS_TOQUES) {
      toques = 0;
      primeiro = agora;
    }
    toques += 1;
    if (toques >= TOQUES_PARA_SEGREDO) {
      toques = 0;
      abrirSegredo();
    }
  });

  // ---- mensagem secreta ----
  const caixa = document.getElementById("segredo");
  const fechar = document.getElementById("segredo-fechar");

  function abrirSegredo() {
    caixa.hidden = false;
    caixa.classList.add("segredo--abrindo");
    if (navigator.vibrate) {
      try { navigator.vibrate([30, 40, 30]); } catch { /* ok */ }
    }
    fechar.focus();
  }

  function fecharSegredo() {
    caixa.hidden = true;
    caixa.classList.remove("segredo--abrindo");
    elNome.focus({ preventScroll: true });
  }

  fechar.addEventListener("click", fecharSegredo);
  caixa.addEventListener("click", (evento) => {
    if (evento.target === caixa) fecharSegredo();   // tocar fora da carta fecha
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !caixa.hidden) fecharSegredo();
  });

  // ---- entrar ----
  document.getElementById("abertura-entrar").addEventListener("click", () => {
    if (aoEntrar) aoEntrar();
  });
}
