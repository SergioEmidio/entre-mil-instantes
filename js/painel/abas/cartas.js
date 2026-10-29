// =====================================================================
// Entre Mil Instantes · aba Cartas ("Abre quando…")
// Uma carta pode ficar trancada até uma data (ex.: 2 anos de namoro).
// =====================================================================

import { h, campo, icone, confirmar, avisar } from "../ui.js";
import { rascunho, alterar, novoIdentificador } from "../estado.js";
import { dataCurta, hojeEmBrasilia, lerDataISO } from "../../site/datas.js";

const MAXIMO = 12;
const SUGESTOES = [
  ["Estiver com saudade", null],
  ["For um dia difícil", null],
  ["A gente brigar", null],
  ["Não conseguir dormir", null],
  ["Precisar rir", null],
  ["Fizermos 2 anos de namoro", "2027-06-20"],
];

let abrirId = null;

function estaTrancada(libera) {
  const data = lerDataISO(libera);
  if (!data) return false;
  const hoje = hojeEmBrasilia();
  const n = (d) => d.ano * 10000 + d.mes * 100 + d.dia;
  return n(data) > n(hoje);
}

export function desenharCartas(area, redesenhar) {
  const lista = rascunho().cartas;

  area.append(
    h("div", { class: "area-titulo" }, h("h2", null, "Cartas «Abre quando…»"), h("p", null, `${lista.length} de ${MAXIMO}`)),
    h(
      "p",
      { class: "area-intro" },
      "Cartas para ela abrir quando precisar. Cartas sem texto não aparecem para ela. Com data, a carta fica trancada até o dia."
    )
  );

  if (!lista.length) {
    area.append(
      h(
        "button",
        {
          class: "botao-adicionar",
          type: "button",
          onClick: () => {
            alterar((r) => {
              r.cartas = SUGESTOES.map(([titulo, libera]) => ({
                id: novoIdentificador(),
                titulo,
                texto: "",
                libera_em: libera,
              }));
            });
            redesenhar();
            avisar("6 cartas criadas. Agora é só escrever cada uma.");
          },
        },
        "Começar com as 6 sugestões do protótipo"
      )
    );
  }

  const caixa = h("div", { class: "lista" });
  lista.forEach((carta, indice) => caixa.append(item(carta, indice, lista.length, redesenhar)));
  area.append(caixa);

  area.append(
    h(
      "button",
      {
        class: "botao-adicionar",
        type: "button",
        disabled: lista.length >= MAXIMO,
        onClick: () => {
          const id = novoIdentificador();
          alterar((r) => {
            r.cartas.push({ id, titulo: "", texto: "", libera_em: null });
          });
          abrirId = id;
          redesenhar();
        },
      },
      icone("mais"),
      "Adicionar carta"
    )
  );

  if (abrirId) {
    const aberto = area.querySelector(`[data-id="${abrirId}"]`);
    abrirId = null;
    if (aberto) aberto.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function item(carta, indice, total, redesenhar) {
  const sobre = h("span", { class: "item-sobre" });
  const principal = h("span", { class: "item-principal" });

  function atualizarResumo() {
    sobre.replaceChildren(document.createTextNode(`Abre quando… ${carta.titulo || "(sem título)"}`));
    if (carta.libera_em) {
      const trancada = estaTrancada(carta.libera_em);
      sobre.append(
        h("span", { class: "marca-trancada" }, trancada ? `· trancada até ${dataCurta(carta.libera_em, "/")}` : "· liberada")
      );
    }
    const texto = (carta.texto || "").trim();
    principal.textContent = texto || "Sem texto ainda (não aparece para ela)";
    principal.classList.toggle("item-principal--vazio", !texto);
  }

  const mudar = (fn) =>
    alterar((r) => {
      const alvo = r.cartas.find((c) => c.id === carta.id);
      if (alvo) fn(alvo);
    });

  const mover = (passo) => {
    alterar((r) => {
      const de = r.cartas.findIndex((c) => c.id === carta.id);
      const para = de + passo;
      if (de < 0 || para < 0 || para >= r.cartas.length) return;
      const [movida] = r.cartas.splice(de, 1);
      r.cartas.splice(para, 0, movida);
    });
    abrirId = carta.id;
    redesenhar();
  };

  const excluir = async () => {
    const sim = await confirmar("Esta carta sai do rascunho.", { titulo: "Excluir esta carta?" });
    if (!sim) return;
    alterar((r) => {
      r.cartas = r.cartas.filter((c) => c.id !== carta.id);
    });
    redesenhar();
    avisar("Carta excluída.");
  };

  const corpo = h(
    "div",
    { class: "item-corpo" },
    campo({
      rotulo: "Abre quando…",
      valor: carta.titulo,
      max: 50,
      placeholder: "Ex.: estiver com saudade",
      aoMudar: (v) => {
        mudar((c) => { c.titulo = v; });
        atualizarResumo();
      },
    }),
    campo({
      rotulo: "Carta",
      valor: carta.texto,
      multilinha: true,
      linhas: 8,
      max: 3000,
      aoMudar: (v) => {
        mudar((c) => { c.texto = v; });
        atualizarResumo();
      },
    }),
    campo({
      rotulo: "Trancada até (opcional)",
      tipo: "date",
      valor: carta.libera_em || "",
      dica: "Deixa vazio para ela poder abrir já no dia 3.",
      aoMudar: (v) => {
        mudar((c) => { c.libera_em = v || null; });
        atualizarResumo();
      },
    }),
    h(
      "div",
      { class: "item-acoes" },
      h("button", { class: "botao-pequeno", type: "button", disabled: indice === 0, onClick: () => mover(-1) }, icone("cima", 16), "Subir"),
      h("button", { class: "botao-pequeno", type: "button", disabled: indice === total - 1, onClick: () => mover(1) }, icone("baixo", 16), "Descer"),
      h("span", { class: "espaco" }),
      h("button", { class: "botao-pequeno botao-pequeno--perigo", type: "button", onClick: excluir }, icone("lixo", 16), "Excluir")
    )
  );

  atualizarResumo();

  return h(
    "details",
    { class: "item", "data-id": carta.id, open: carta.id === abrirId },
    h(
      "summary",
      { class: "item-resumo" },
      h("span", { class: "item-numero" }, String(indice + 1)),
      h("span", { class: "item-textos" }, sobre, principal),
      h("span", { class: "item-seta" }, icone("seta", 18))
    ),
    corpo
  );
}
