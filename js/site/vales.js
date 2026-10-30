// =====================================================================
// Entre Mil Instantes · site/vales.js
// Tela 12: raspadinha. Cada vale tem uma camada dourada que ela raspa
// com o dedo. Passou da metade raspada, o vale aparece inteiro.
// Os vales já raspados ficam lembrados neste celular.
// =====================================================================

import { h, texto, vibrar, esperarClique } from "./dom.js";
import { lerConjunto, guardarConjunto } from "./memoria.js";
import { mostrarTela } from "./telas.js";

const PARA_REVELAR = 0.45;   // fração raspada que já revela tudo
const NUMEROS = ["", "Um vale, só teu", "Dois vales, só teus", "Três vales, só teus", "Quatro vales, só teus"];

export function valesDoConteudo(conteudo) {
  const lista = conteudo && Array.isArray(conteudo.vales) ? conteudo.vales : [];
  return lista.filter((v) => v && texto(v.texto)).slice(0, 4);
}

export function temVales(conteudo) {
  return valesDoConteudo(conteudo).length > 0;
}

// ---------------------------------------------------------------------
// Uma raspadinha
// ---------------------------------------------------------------------
function criarCartao(vale, indice, jaRaspado, aoRevelar) {
  const capa = h("canvas", { class: "vale-capa", "aria-hidden": "true" });
  const cartao = h(
    "div",
    { class: `vale${jaRaspado ? " vale--revelado" : ""}`, "data-id": vale.id || String(indice) },
    h(
      "div",
      { class: "vale-conteudo" },
      h("span", { class: "vale-numero" }, `Vale 0${indice + 1}`),
      h("span", { class: "vale-premio" }, texto(vale.texto)),
      h("span", { class: "vale-validade" }, "Válido quando tu quiseres.")
    ),
    jaRaspado ? null : capa,
    jaRaspado ? null : h("span", { class: "vale-raspa", "aria-hidden": "true" }, "Raspa aqui")
  );

  // Para leitor de tela: o prêmio fica escondido até revelar.
  const conteudo = cartao.querySelector(".vale-conteudo");
  if (!jaRaspado) conteudo.setAttribute("aria-hidden", "true");

  let revelado = jaRaspado;
  let ctx = null;
  let escala = 1;
  let ultimo = null;
  let movimentos = 0;
  let larguraDesenhada = 0;

  function revelar() {
    if (revelado) return;
    revelado = true;
    cartao.classList.add("vale--revelado");
    conteudo.removeAttribute("aria-hidden");
    vibrar(25);
    aoRevelar(cartao.dataset.id);
    setTimeout(() => {
      capa.remove();
      const aviso = cartao.querySelector(".vale-raspa");
      if (aviso) aviso.remove();
    }, 600);
  }

  // Pinta a camada dourada no tamanho atual do cartão.
  function pintar() {
    if (revelado || !capa.isConnected) return;
    const caixa = cartao.getBoundingClientRect();
    if (!caixa.width || Math.abs(caixa.width - larguraDesenhada) < 1) return;
    larguraDesenhada = caixa.width;
    escala = Math.min(2, window.devicePixelRatio || 1);
    capa.width = Math.round(caixa.width * escala);
    capa.height = Math.round(caixa.height * escala);
    ctx = capa.getContext("2d", { willReadFrequently: true });

    const fundo = ctx.createLinearGradient(0, 0, capa.width, capa.height);
    fundo.addColorStop(0, "#efdcae");
    fundo.addColorStop(0.5, "#e8d3a2");
    fundo.addColorStop(1, "#d8bd83");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, capa.width, capa.height);

    // brilhinhos
    ctx.fillStyle = "rgba(255, 250, 235, 0.35)";
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97) % 100) / 100 * capa.width;
      const y = ((i * 53) % 100) / 100 * capa.height;
      ctx.beginPath();
      ctx.arc(x, y, (1 + (i % 3)) * escala, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ponto(evento) {
    const caixa = capa.getBoundingClientRect();
    return { x: (evento.clientX - caixa.left) * escala, y: (evento.clientY - caixa.top) * escala };
  }

  function raspar(de, ate) {
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 38 * escala;
    ctx.beginPath();
    ctx.moveTo(de.x, de.y);
    ctx.lineTo(ate.x + 0.01, ate.y + 0.01);
    ctx.stroke();
  }

  // Quanto já foi raspado (olha 1 a cada 6 pixels, é rápido).
  function fracaoRaspada() {
    if (!ctx) return 0;
    const { width, height } = capa;
    const dados = ctx.getImageData(0, 0, width, height).data;
    let vazios = 0;
    let total = 0;
    const passo = 6 * Math.max(1, Math.round(escala));
    for (let y = 0; y < height; y += passo) {
      for (let x = 0; x < width; x += passo) {
        total += 1;
        if (dados[(y * width + x) * 4 + 3] < 40) vazios += 1;
      }
    }
    return total ? vazios / total : 0;
  }

  function conferir() {
    if (!revelado && fracaoRaspada() >= PARA_REVELAR) revelar();
  }

  if (!jaRaspado) {
    capa.addEventListener("pointerdown", (evento) => {
      if (revelado) return;
      evento.preventDefault();
      try { capa.setPointerCapture(evento.pointerId); } catch { /* ok */ }
      cartao.classList.add("vale--raspando");
      ultimo = ponto(evento);
      raspar(ultimo, ultimo);
    });
    capa.addEventListener("pointermove", (evento) => {
      if (revelado || !ultimo) return;
      const agora = ponto(evento);
      raspar(ultimo, agora);
      ultimo = agora;
      movimentos += 1;
      if (movimentos % 14 === 0) conferir();
    });
    const soltar = () => {
      if (!ultimo) return;
      ultimo = null;
      conferir();
    };
    capa.addEventListener("pointerup", soltar);
    capa.addEventListener("pointercancel", soltar);
  }

  return { cartao, pintar, revelar, revelado: () => revelado };
}

// ---------------------------------------------------------------------
// A tela
// ---------------------------------------------------------------------
export async function tocarVales(conteudo, { deCantinho = false } = {}) {
  const lista = valesDoConteudo(conteudo);
  const caixa = document.getElementById("vales-lista");
  const titulo = document.getElementById("vales-titulo");
  const seguir = document.getElementById("vales-seguir");
  const revelarTudo = document.getElementById("vales-revelar");

  titulo.textContent = NUMEROS[lista.length] || "Vales só teus";
  seguir.textContent = deCantinho ? "Voltar ao cantinho" : "Continuar";

  const raspados = lerConjunto("vales-raspados");
  const atualizarBotao = () => {
    revelarTudo.hidden = cartoes.every((c) => c.revelado());
  };
  const aoRevelar = (id) => {
    raspados.add(id);
    guardarConjunto("vales-raspados", raspados);
    atualizarBotao();
  };

  const cartoes = lista.map((vale, i) => criarCartao(vale, i, raspados.has(vale.id || String(i)), aoRevelar));
  caixa.replaceChildren(...cartoes.map((c) => c.cartao));
  atualizarBotao();

  const pintarTodos = () => cartoes.forEach((c) => c.pintar());
  await mostrarTela("tela-vales");
  // Pinta depois que a tela aparece (precisa do tamanho real dos cartões).
  pintarTodos();
  requestAnimationFrame(() => requestAnimationFrame(pintarTodos));
  setTimeout(pintarTodos, 500);
  window.addEventListener("resize", pintarTodos);

  const aoRevelarTudo = () => cartoes.forEach((c) => c.revelar());
  revelarTudo.addEventListener("click", aoRevelarTudo);

  await esperarClique([[seguir, "seguir"]]);

  window.removeEventListener("resize", pintarTodos);
  revelarTudo.removeEventListener("click", aoRevelarTudo);
  return "seguir";
}
