// =====================================================================
// Entre Mil Instantes · site/antes-agora.js
// Duas fotos sobrepostas: ela arrasta a barrinha para comparar.
// =====================================================================

import { texto } from "./dom.js";
import { linkDaFoto } from "./fotos.js";

// Só aparece se as duas fotos existirem.
export function temAntesAgora(conteudo) {
  const aa = (conteudo && conteudo.antes_agora) || {};
  return Boolean(aa.antes && aa.agora);
}

// Mostra e espera ela escolher: devolve "proximo" ou "voltar".
export function tocarAntesAgora(conteudo) {
  const aa = (conteudo && conteudo.antes_agora) || {};
  const quadro = document.getElementById("aa-quadro");
  const antes = document.getElementById("aa-antes");
  const agora = document.getElementById("aa-agora");
  const barra = document.getElementById("aa-barra");
  const frase = document.getElementById("aa-frase");
  const voltar = document.getElementById("aa-voltar");
  const seguir = document.getElementById("aa-proximo");

  antes.src = linkDaFoto(aa.antes) || "";
  agora.src = linkDaFoto(aa.agora) || "";
  const textoFrase = texto(aa.frase);
  frase.textContent = textoFrase ? `“${textoFrase}”` : "";
  frase.hidden = !textoFrase;

  function posicionar(valor) {
    const p = Math.min(100, Math.max(0, Number(valor)));
    quadro.style.setProperty("--corte", `${p}%`);
    barra.setAttribute("aria-valuetext", `${Math.round(p)}% da foto do começo`);
  }

  barra.value = "50";
  posicionar(50);

  // Arrastar direto na foto também move a barrinha.
  let arrastando = false;
  function moverPeloDedo(evento) {
    const caixa = quadro.getBoundingClientRect();
    const p = ((evento.clientX - caixa.left) / caixa.width) * 100;
    barra.value = String(Math.round(Math.min(100, Math.max(0, p))));
    posicionar(barra.value);
  }

  const aoMudarBarra = () => posicionar(barra.value);
  const aoApertar = (evento) => {
    arrastando = true;
    try { quadro.setPointerCapture(evento.pointerId); } catch { /* ok */ }
    moverPeloDedo(evento);
  };
  const aoMover = (evento) => {
    if (arrastando) moverPeloDedo(evento);
  };
  const aoSoltar = () => {
    arrastando = false;
  };

  barra.addEventListener("input", aoMudarBarra);
  quadro.addEventListener("pointerdown", aoApertar);
  quadro.addEventListener("pointermove", aoMover);
  quadro.addEventListener("pointerup", aoSoltar);
  quadro.addEventListener("pointercancel", aoSoltar);

  return new Promise((terminar) => {
    function sair(resposta) {
      barra.removeEventListener("input", aoMudarBarra);
      quadro.removeEventListener("pointerdown", aoApertar);
      quadro.removeEventListener("pointermove", aoMover);
      quadro.removeEventListener("pointerup", aoSoltar);
      quadro.removeEventListener("pointercancel", aoSoltar);
      voltar.removeEventListener("click", aoVoltar);
      seguir.removeEventListener("click", aoSeguir);
      terminar(resposta);
    }
    const aoVoltar = () => sair("voltar");
    const aoSeguir = () => sair("proximo");
    voltar.addEventListener("click", aoVoltar);
    seguir.addEventListener("click", aoSeguir);
  });
}
