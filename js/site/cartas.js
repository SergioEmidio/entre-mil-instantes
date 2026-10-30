// =====================================================================
// Entre Mil Instantes · site/cartas.js
// Tela 13: cartas «Abre quando…». As trancadas chegam SEM o texto
// (o banco só manda no dia certo). As lidas ficam marcadas.
// =====================================================================

import { h, texto, esperarClique } from "./dom.js";
import { dataCurta, dataPorExtenso } from "./datas.js";
import { ehPrevia, lerConjunto, guardarConjunto } from "./memoria.js";
import { mostrarTela } from "./telas.js";

// Carta aparece se tiver título e texto (as trancadas avisam se têm texto).
export function cartasDoConteudo(conteudo) {
  const lista = conteudo && Array.isArray(conteudo.cartas) ? conteudo.cartas : [];
  return lista.filter((c) => {
    if (!c || !texto(c.titulo)) return false;
    if (typeof c.tem_texto === "boolean") return c.tem_texto;
    return Boolean(texto(c.texto));
  });
}

export function temCartas(conteudo) {
  return cartasDoConteudo(conteudo).length > 0;
}

const el = {};
let ligado = false;
let fecharAtual = null;

function pegar() {
  if (ligado) return;
  ligado = true;
  for (const id of ["lista", "aviso", "seguir"]) el[id] = document.getElementById(`cartas-${id}`);
  for (const id of ["fundo", "titulo", "texto", "assinatura", "fechar"]) el[id] = document.getElementById(`carta-${id}`);

  el.fechar.addEventListener("click", () => fecharAtual && fecharAtual());
  el.fundo.addEventListener("click", (evento) => {
    if (evento.target === el.fundo && fecharAtual) fecharAtual();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !el.fundo.hidden && fecharAtual) fecharAtual();
  });
}

export async function tocarCartas(conteudo, { deCantinho = false } = {}) {
  pegar();
  const cartas = cartasDoConteudo(conteudo);
  const autor = texto(conteudo && conteudo.autor);
  const lidas = lerConjunto("cartas-lidas");
  const previa = ehPrevia();
  let avisoTempo = null;

  el.seguir.textContent = deCantinho ? "Voltar ao cantinho" : "Continuar";
  el.aviso.textContent = "";

  function avisar(mensagem) {
    el.aviso.textContent = mensagem;
    clearTimeout(avisoTempo);
    avisoTempo = setTimeout(() => { el.aviso.textContent = ""; }, 4500);
  }

  function abrir(carta, botao) {
    el.titulo.textContent = texto(carta.titulo);
    el.texto.textContent = texto(carta.texto);
    el.assinatura.textContent = autor ? `Com amor, ${autor}.` : "";
    el.assinatura.hidden = !autor;
    el.fundo.hidden = false;
    el.fundo.classList.remove("carta-fundo--abrindo");
    void el.fundo.offsetWidth;
    el.fundo.classList.add("carta-fundo--abrindo");
    el.fundo.scrollTop = 0;
    el.fechar.focus({ preventScroll: true });

    if (!carta.trancada) {
      lidas.add(carta.id);
      guardarConjunto("cartas-lidas", lidas);
    }

    fecharAtual = () => {
      el.fundo.hidden = true;
      fecharAtual = null;
      desenhar();
      const mesmo = el.lista.querySelector(`[data-id="${CSS.escape(String(carta.id))}"]`);
      (mesmo || botao).focus({ preventScroll: true });
    };
  }

  function desenhar() {
    el.lista.replaceChildren(
      ...cartas.map((carta) => {
        const trancada = Boolean(carta.trancada);
        const dataAbre = dataCurta(carta.libera_em, "/");
        let marca = "Livre";
        if (trancada) marca = previa ? `Abre ${dataAbre} · prévia` : `Abre ${dataAbre}`;
        else if (lidas.has(carta.id)) marca = "Lida";

        const botao = h(
          "button",
          {
            class: `envelope${trancada ? " envelope--trancado" : ""}${lidas.has(carta.id) && !trancada ? " envelope--lido" : ""}`,
            type: "button",
            "data-id": carta.id,
            "aria-disabled": trancada && !previa ? "true" : null,
            "aria-label": trancada
              ? `Abre quando ${texto(carta.titulo)}. Trancada até ${dataPorExtenso(carta.libera_em)}.`
              : `Abre quando ${texto(carta.titulo)}`,
          },
          h("span", { class: "envelope-aba", "aria-hidden": "true" }),
          h("span", { class: "envelope-marca" }, marca),
          h("span", { class: "envelope-titulo" }, texto(carta.titulo))
        );
        botao.addEventListener("click", () => {
          if (trancada && !previa) {
            avisar(`Essa carta só abre em ${dataPorExtenso(carta.libera_em)}. Guarda ela até lá.`);
            return;
          }
          abrir(carta, botao);
        });
        return botao;
      })
    );
  }

  desenhar();
  await mostrarTela("tela-cartas");
  await esperarClique([[el.seguir, "seguir"]]);
  clearTimeout(avisoTempo);
  if (fecharAtual) fecharAtual();
  return "seguir";
}
