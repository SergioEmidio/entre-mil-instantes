// =====================================================================
// Entre Mil Instantes · site/cantinho.js
// Tela 17: «Nosso cantinho». Depois de ver tudo, ela pode voltar
// direto em qualquer parte (as cartas e a lista ficam o ano inteiro).
// =====================================================================

import { h } from "./dom.js";
import { mostrarTela } from "./telas.js";

const ICONES = {
  stories: "M4 5h16v14H4zM9 5v14M15 5v14",
  radio: "M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  presente: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z",
  vales: "M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3zM14 4v16",
  cartas: "M3 6h18v12H3zM3 6l9 7 9-7",
  lista: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  recado: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  cartao: "M6 3h12v18H6zM9 15h6M12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
};

function icone(nome) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const caminho = document.createElementNS(ns, "path");
  caminho.setAttribute("d", ICONES[nome] || "");
  svg.append(caminho);
  return svg;
}

// itens: [{ id, titulo, sub }] — só os que existem no site dela.
// Devolve o id escolhido (ou "inicio" para ver tudo desde o começo).
export async function tocarCantinho(itens) {
  const lista = document.getElementById("cantinho-lista");
  const inicio = document.getElementById("cantinho-inicio");

  return new Promise((resolver) => {
    const escolher = (id) => {
      inicio.removeEventListener("click", aoInicio);
      resolver(id);
    };
    const aoInicio = () => escolher("inicio");
    inicio.addEventListener("click", aoInicio);

    lista.replaceChildren(
      ...itens.map((item) =>
        h(
          "button",
          { class: "cantinho-item", type: "button", "data-id": item.id, onClick: () => escolher(item.id) },
          h("span", { class: "cantinho-icone" }, icone(item.id)),
          h("span", { class: "cantinho-textos" }, h("span", { class: "cantinho-titulo" }, item.titulo), item.sub ? h("span", { class: "cantinho-sub" }, item.sub) : null),
          h("span", { class: "cantinho-seta", "aria-hidden": "true" }, "›")
        )
      )
    );
    mostrarTela("tela-cantinho");
  });
}
