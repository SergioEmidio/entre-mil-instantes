// =====================================================================
// Entre Mil Instantes · site/contagem.js
// Tela 00: contagem regressiva até a hora de abrir.
// =====================================================================

import { partesDoTempo } from "./datas.js";

const dois = (n) => String(n).padStart(2, "0");

// Começa a contagem. Chama aoTerminar() uma vez, quando chegar a zero.
// agora(): hora certa (a do servidor). Devolve uma função que para a contagem.
export function iniciarContagem(liberarEm, aoTerminar, agora = () => new Date()) {
  const campos = {
    dias: document.getElementById("cont-dias"),
    horas: document.getElementById("cont-horas"),
    minutos: document.getElementById("cont-min"),
    segundos: document.getElementById("cont-seg"),
  };
  const relogio = document.querySelector(".contagem-grade");
  let terminou = false;
  let temporizador = null;

  function atualizar() {
    const falta = liberarEm.getTime() - agora().getTime();
    const p = partesDoTempo(falta);

    campos.dias.textContent = dois(p.dias);
    campos.horas.textContent = dois(p.horas);
    campos.minutos.textContent = dois(p.minutos);
    campos.segundos.textContent = dois(p.segundos);
    relogio.setAttribute(
      "aria-label",
      `Faltam ${p.dias} dias, ${p.horas} horas e ${p.minutos} minutos`
    );

    if (falta <= 0 && !terminou) {
      terminou = true;
      parar();
      aoTerminar();
    }
  }

  // Acerta o próximo "tique" no começo de cada segundo (não escorrega).
  function agendar() {
    atualizar();
    if (terminou) return;
    temporizador = setTimeout(agendar, 1000 - (Date.now() % 1000) + 5);
  }

  function parar() {
    clearTimeout(temporizador);
    document.removeEventListener("visibilitychange", aoVoltar);
  }

  // Celular volta do bloqueio: atualiza na hora.
  function aoVoltar() {
    if (document.visibilityState === "visible" && !terminou) {
      clearTimeout(temporizador);
      agendar();
    }
  }

  document.addEventListener("visibilitychange", aoVoltar);
  agendar();
  return parar;
}
