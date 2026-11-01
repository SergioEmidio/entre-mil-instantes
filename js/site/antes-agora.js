// =====================================================================
// Entre Mil Instantes · site/antes-agora.js
// Duas fotos sobrepostas: ela arrasta a barrinha para comparar.
// =====================================================================

import { texto, menosMovimento } from "./dom.js";
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

  // Uma "dica" sem palavras: a linha vai e volta uma vez, mostrando que
  // dá para arrastar. Para na hora se ela tocar.
  let dicaQuadro = 0;
  let dicaParada = menosMovimento();
  const pararDica = () => {
    dicaParada = true;
    cancelAnimationFrame(dicaQuadro);
  };
  const PONTOS = [50, 30, 70, 50];
  setTimeout(() => {
    if (dicaParada) return;
    const inicio = performance.now();
    const DURA = 2200;
    const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const passo = (agora) => {
      if (dicaParada) return;
      const t = Math.min(1, (agora - inicio) / DURA);
      const trecho = Math.min(PONTOS.length - 2, Math.floor(t * (PONTOS.length - 1)));
      const local = t * (PONTOS.length - 1) - trecho;
      const valor = PONTOS[trecho] + (PONTOS[trecho + 1] - PONTOS[trecho]) * suave(local);
      barra.value = String(Math.round(valor));
      posicionar(valor);
      if (t < 1) dicaQuadro = requestAnimationFrame(passo);
    };
    dicaQuadro = requestAnimationFrame(passo);
  }, 1100);

  // Arrastar direto na foto também move a barrinha.
  let arrastando = false;
  function moverPeloDedo(evento) {
    const caixa = quadro.getBoundingClientRect();
    const p = ((evento.clientX - caixa.left) / caixa.width) * 100;
    barra.value = String(Math.round(Math.min(100, Math.max(0, p))));
    posicionar(barra.value);
  }

  const aoMudarBarra = () => {
    pararDica();
    posicionar(barra.value);
  };
  const aoApertar = (evento) => {
    pararDica();
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
      pararDica();
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
