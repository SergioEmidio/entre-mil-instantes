// =====================================================================
// Entre Mil Instantes · site/confete.js
// Chuva de confete dourado (some sozinha; quem pediu menos movimento
// no celular não vê).
// =====================================================================

import { menosMovimento } from "./dom.js";

const CORES = ["#e8d3a2", "#f2e8d8", "#c9a86a", "#e8d3a2", "#d9b7c4"];

export function soltarConfete(caixa, quantidade = 46) {
  if (!caixa || menosMovimento()) return;
  caixa.replaceChildren();
  const fragmento = document.createDocumentFragment();
  for (let i = 0; i < quantidade; i++) {
    const pedaco = document.createElement("span");
    pedaco.className = "confete-pedaco";
    const largura = 5 + Math.random() * 6;
    const redondo = Math.random() < 0.25;
    pedaco.style.left = `${Math.random() * 100}%`;
    pedaco.style.width = `${largura}px`;
    pedaco.style.height = `${redondo ? largura : largura * 1.7}px`;
    pedaco.style.borderRadius = redondo ? "50%" : "1px";
    pedaco.style.background = CORES[i % CORES.length];
    pedaco.style.setProperty("--deriva", `${(Math.random() * 2 - 1) * 80}px`);
    pedaco.style.setProperty("--giro", `${360 + Math.random() * 540}deg`);
    pedaco.style.animationDelay = `${(Math.random() * 0.9).toFixed(2)}s`;
    pedaco.style.animationDuration = `${(2.6 + Math.random() * 1.6).toFixed(2)}s`;
    fragmento.appendChild(pedaco);
  }
  caixa.appendChild(fragmento);
  setTimeout(() => caixa.replaceChildren(), 5200);
}
