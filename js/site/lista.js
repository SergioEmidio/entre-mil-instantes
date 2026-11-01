// =====================================================================
// Entre Mil Instantes · site/lista.js
// Tela 14: «Nossos próximos 365 dias». Os dois escrevem, marcam a
// caixinha quando fizerem e podem apagar. Fica salvo no banco.
// Na pré-visualização, nada do que mudar aqui é salvo.
// =====================================================================

import { h, texto, vibrar, esperarClique, menosMovimento } from "./dom.js";
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
// O item que acabou de chegar ou de ser marcado ganha uma animação.
// Se a lista for redesenhada no meio (resposta do banco), a animação
// continua de onde estava (atraso negativo), sem recomeçar.
let destaque = null;   // { item, tipo: "novo" | "marcado", inicio }
const DESTAQUE_MS = 1000;

function destacar(item, tipo) {
  destaque = { item, tipo, inicio: performance.now() };
}

function classeDoDestaque(item) {
  if (!destaque || destaque.item !== item) return null;
  const passou = performance.now() - destaque.inicio;
  if (passou > DESTAQUE_MS) return null;
  return { classe: `lista-item--${destaque.tipo}`, atraso: `${-Math.round(passou)}ms` };
}

// O número pula quando muda.
function trocarNumero(campo, valor) {
  const novo = String(valor);
  if (campo.textContent === novo) return;
  const tinha = campo.textContent !== "";
  campo.textContent = novo;
  if (!tinha || menosMovimento() || typeof campo.animate !== "function") return;
  campo.animate(
    [{ transform: "translateY(-30%) scale(1.25)", opacity: 0.2 }, { transform: "none", opacity: 1 }],
    { duration: 520, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
  );
}

function desenhar() {
  const feitos = itens.filter((i) => i.feito).length;
  const total = itens.length;
  trocarNumero(el.feitos, feitos);
  trocarNumero(el.faltam, total - feitos);
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

      const d = classeDoDestaque(item);
      const li = h(
        "li",
        { class: `lista-item${item.feito ? " lista-item--feito" : ""}${d ? ` ${d.classe}` : ""}`, "data-id": item.id },
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
      if (d) li.style.setProperty("--atraso", d.atraso);
      return li;
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
  destacar(temporario, "novo");
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
    if (destaque && destaque.item === temporario) destaque.item = salvo;
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
  destacar(item, "marcado");
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
