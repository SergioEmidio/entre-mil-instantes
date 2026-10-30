// =====================================================================
// Entre Mil Instantes · site/lista.js
// Tela 14: «Nossos próximos 365 dias». Os dois escrevem, marcam a
// caixinha quando fizerem e podem apagar. Fica salvo no banco.
// Na pré-visualização, nada do que mudar aqui é salvo.
// =====================================================================

import { h, texto, vibrar, esperarClique } from "./dom.js";
import { lerDataISO } from "./datas.js";
import { ehPrevia } from "./memoria.js";
import { mostrarTela } from "./telas.js";
import { lerLista, adicionarNaLista, marcarNaLista, apagarDaLista } from "../supabase.js";

const el = {};
let ligado = false;
let itens = [];
let conteudoAtual = {};
let confirmandoApagar = null;   // id do item que está perguntando "Apagar?"
let avisoTempo = null;
let contadorTemporario = 0;

function pegar() {
  if (ligado) return;
  ligado = true;
  for (const id of ["rotulo", "feitos", "faltam", "progresso", "form", "campo", "mais", "aviso", "itens", "vazia", "seguir"]) {
    el[id] = document.getElementById(`lista-${id}`);
  }
  el.form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    adicionar();
  });
}

const dois = (n) => String(n).padStart(2, "0");

function rotuloAte(conteudo) {
  const aniversario = lerDataISO(conteudo && conteudo.datas && conteudo.datas.aniversario);
  if (!aniversario) return "Até o próximo aniversário";
  return `Até ${dois(aniversario.dia)} · ${dois(aniversario.mes)} · ${aniversario.ano + 1}`;
}

function avisar(mensagem, tipo = "info", ms = 4500) {
  el.aviso.textContent = mensagem;
  el.aviso.dataset.tipo = tipo;
  clearTimeout(avisoTempo);
  if (ms) avisoTempo = setTimeout(() => { el.aviso.textContent = ""; }, ms);
}

function mensagemDeErro(erro, acao) {
  if (erro && erro.codigo === "rede") return `Sem internet agora. Não deu para ${acao}.`;
  return `Não consegui ${acao}. Tenta de novo.`;
}

// Não feitos primeiro (mais novos em cima); depois os feitos (mais recentes em cima).
function ordenar(lista) {
  const tempo = (t) => (t ? new Date(t).getTime() : 0);
  return lista.slice().sort((a, b) => {
    if (a.feito !== b.feito) return a.feito ? 1 : -1;
    if (a.feito) return tempo(b.feito_em) - tempo(a.feito_em);
    return tempo(b.criado_em) - tempo(a.criado_em);
  });
}

// Quem escreveu (mostra o nome só nos itens do outro).
function nomeDoAutor(item) {
  const c = conteudoAtual;
  if (item.autor === "admin") return texto(c.autor) || "ele";
  if (item.autor === "convidada") return texto(c.nome) || "ela";
  return "";
}

// ---------------------------------------------------------------------
// Desenhar
// ---------------------------------------------------------------------
function desenhar() {
  const feitos = itens.filter((i) => i.feito).length;
  const total = itens.length;
  el.feitos.textContent = String(feitos);
  el.faltam.textContent = String(total - feitos);
  el.progresso.style.transform = `scaleX(${total ? feitos / total : 0})`;
  el.vazia.hidden = total > 0;

  el.itens.replaceChildren(
    ...ordenar(itens).map((item) => {
      const idCaixa = `lista-item-${item.id}`;
      const temporario = String(item.id).startsWith("tmp-");
      const autor = nomeDoAutor(item);
      const meu = item.autor === papelAtual;

      if (confirmandoApagar === item.id) {
        return h(
          "li",
          { class: "lista-item lista-item--apagar" },
          h("span", { class: "lista-item-texto" }, `Apagar “${item.texto}”?`),
          h("button", { class: "lista-botao lista-botao--sim", type: "button", onClick: () => apagar(item) }, "Apagar"),
          h(
            "button",
            {
              class: "lista-botao",
              type: "button",
              onClick: () => {
                confirmandoApagar = null;
                desenhar();
              },
            },
            "Não"
          )
        );
      }

      const caixa = h("input", {
        class: "lista-caixa",
        type: "checkbox",
        id: idCaixa,
        disabled: temporario,
        onChange: () => marcar(item, caixa.checked),
      });
      caixa.checked = Boolean(item.feito);

      return h(
        "li",
        { class: `lista-item${item.feito ? " lista-item--feito" : ""}`, "data-id": item.id },
        caixa,
        h(
          "label",
          { class: "lista-item-texto", for: idCaixa },
          item.texto,
          autor && !meu ? h("span", { class: "lista-autor" }, `— ${autor}`) : null
        ),
        h(
          "button",
          {
            class: "lista-apagar",
            type: "button",
            disabled: temporario,
            "aria-label": `Apagar ${item.texto}`,
            onClick: () => {
              confirmandoApagar = item.id;
              desenhar();
              const sim = el.itens.querySelector(".lista-botao--sim");
              if (sim) sim.focus();
            },
          },
          "×"
        )
      );
    })
  );
}

// ---------------------------------------------------------------------
// Ações (a tela muda na hora; se o banco falhar, volta como estava)
// ---------------------------------------------------------------------
let papelAtual = "convidada";

async function adicionar() {
  const novo = texto(el.campo.value).replace(/\s+/g, " ");
  if (!novo) {
    el.campo.focus();
    return;
  }
  if (novo.length > 120) {
    avisar("Escreve em até 120 letras.", "erro");
    return;
  }

  contadorTemporario += 1;
  const temporario = {
    id: `tmp-${contadorTemporario}`,
    texto: novo,
    feito: false,
    feito_em: null,
    autor: papelAtual,
    criado_em: new Date().toISOString(),
  };
  itens.push(temporario);
  el.campo.value = "";
  desenhar();
  vibrar(15);

  if (ehPrevia()) {
    temporario.id = `previa-${contadorTemporario}`;
    desenhar();
    return;
  }

  try {
    const salvo = await adicionarNaLista(novo);
    itens = itens.map((i) => (i === temporario ? salvo : i));
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    itens = itens.filter((i) => i !== temporario);
    if (!el.campo.value) el.campo.value = novo;
    avisar(mensagemDeErro(erro, "adicionar"), "erro");
  }
  desenhar();
}

async function marcar(item, feito) {
  const antes = { feito: item.feito, feito_em: item.feito_em };
  item.feito = feito;
  item.feito_em = feito ? new Date().toISOString() : null;
  if (feito) vibrar([20, 40, 20]);
  desenhar();
  if (ehPrevia()) return;

  try {
    const salvo = await marcarNaLista(item.id, feito);
    Object.assign(item, salvo);
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    Object.assign(item, antes);
    avisar(mensagemDeErro(erro, "marcar"), "erro");
  }
  desenhar();
}

async function apagar(item) {
  confirmandoApagar = null;
  const posicao = itens.indexOf(item);
  itens = itens.filter((i) => i !== item);
  desenhar();
  if (ehPrevia()) return;

  try {
    await apagarDaLista(item.id);
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    itens.splice(Math.max(0, posicao), 0, item);
    avisar(mensagemDeErro(erro, "apagar"), "erro");
    desenhar();
  }
}

async function carregar() {
  el.vazia.hidden = true;
  el.itens.replaceChildren(h("li", { class: "lista-carregando" }, "Carregando a lista…"));
  try {
    itens = await lerLista();
    if (ehPrevia()) {
      avisar("Na prévia, o que tu mudares aqui não é salvo.", "info", 0);
    }
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    itens = [];
    avisar(mensagemDeErro(erro, "carregar a lista"), "erro", 0);
  }
  desenhar();
}

// ---------------------------------------------------------------------
export async function tocarLista(conteudo, { deCantinho = false, papel = "convidada" } = {}) {
  pegar();
  conteudoAtual = conteudo || {};
  papelAtual = papel === "admin" ? "admin" : "convidada";
  confirmandoApagar = null;
  el.rotulo.textContent = rotuloAte(conteudoAtual);
  el.seguir.textContent = deCantinho ? "Voltar ao cantinho" : "Continuar";
  el.aviso.textContent = "";
  el.campo.value = "";

  const saida = esperarClique([[el.seguir, "seguir"]]);
  carregar();
  await mostrarTela("tela-lista");
  await saida;
  clearTimeout(avisoTempo);
  return "seguir";
}
