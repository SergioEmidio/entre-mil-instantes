// =====================================================================
// Entre Mil Instantes · painel/estado.js
// Guarda o rascunho em memória e salva sozinho no Supabase
// (1 segundo depois da última alteração). Nada aparece para ela até
// tu publicares.
// =====================================================================

import { carregarPainel, salvarRascunho } from "../supabase.js";

const ESPERA_SALVAR = 1000;
const ESPERA_TENTAR_DE_NOVO = 5000;

// Formato completo do rascunho. Serve para completar rascunhos antigos.
const MODELO = {
  nome: "Mika",
  autor: "Sérgio",
  datas: { conhecemos: "2025-05-19", namoro: "2025-06-20", aniversario: "2026-11-03" },
  abertura: {
    frase: "Preparei uma retrospectiva, alguns stories e uma rádio feita só pra ti.",
    segredo: "",
  },
  retrospectiva: {
    musica: { nome: "", artista: "", frase: "", capa: null, audio: null, duracao: null, inicio: 0 },
    apelido: "",
    lugar: "",
    frase_dela: "",
  },
  stories: [],
  antes_agora: { antes: null, agora: null, frase: "" },
  radio: { faixas: [] },
  presente: { frase_caixa: "Hoje eu não queria só te dizer. Queria te dar algo." },
  vales: [],
  cartas: [],
  cartao: { foto: null },
};

const MODELO_PRESENTE = { nome: "", frase: "", foto: null, esconder_foto: false };

const copiar = (valor) => JSON.parse(JSON.stringify(valor));

// Junta o que veio do banco com o modelo (o que faltar ganha o padrão).
function completar(modelo, dados) {
  if (Array.isArray(modelo)) return Array.isArray(dados) ? dados : copiar(modelo);
  if (modelo && typeof modelo === "object") {
    const base = dados && typeof dados === "object" && !Array.isArray(dados) ? dados : {};
    const resultado = { ...base };
    for (const chave of Object.keys(modelo)) {
      resultado[chave] = completar(modelo[chave], base[chave]);
    }
    return resultado;
  }
  return dados === undefined ? modelo : dados;
}

// Texto com as chaves sempre na mesma ordem (para comparar versões).
function emTexto(valor) {
  if (Array.isArray(valor)) return `[${valor.map(emTexto).join(",")}]`;
  if (valor && typeof valor === "object") {
    return `{${Object.keys(valor)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${emTexto(valor[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valor === undefined ? null : valor);
}

// ---------------------------------------------------------------------
const estado = {
  rascunho: null,
  presente: null,
  publicadoTexto: "",
  presentePublicadoTexto: "",
  publicadoEm: null,
  presenteAbertoEm: null,
  salvando: false,
  pendente: false,
  erro: false,
};

let temporizador = null;
let salvamentoAtual = null;
const ouvintes = new Set();

function avisarOuvintes() {
  for (const ouvinte of ouvintes) ouvinte(situacao());
}

export function aoMudarSituacao(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export async function carregar() {
  const { conteudo, presente } = await carregarPainel();
  estado.rascunho = completar(MODELO, conteudo.rascunho);
  estado.presente = completar(MODELO_PRESENTE, presente.rascunho);
  const publicado = conteudo.publicado && Object.keys(conteudo.publicado).length ? conteudo.publicado : null;
  estado.publicadoTexto = publicado ? emTexto(completar(MODELO, publicado)) : "";
  estado.presentePublicadoTexto =
    presente.publicado && Object.keys(presente.publicado).length
      ? emTexto(completar(MODELO_PRESENTE, presente.publicado))
      : "";
  estado.publicadoEm = conteudo.publicado_em;
  estado.presenteAbertoEm = presente.aberto_em || null;
  avisarOuvintes();
}

// Quando ela abriu a caixa (null = ainda fechada).
export function presenteAbertoEm() {
  return estado.presenteAbertoEm;
}

export function marcarPresenteFechado() {
  estado.presenteAbertoEm = null;
}

// Leitura (não altere o objeto devolvido diretamente: use alterar()).
export function rascunho() {
  return estado.rascunho;
}

export function presente() {
  return estado.presente;
}

// alterar((r, p) => { r.nome = "Mika"; }) → muda e agenda o salvamento.
export function alterar(mudanca) {
  mudanca(estado.rascunho, estado.presente);
  estado.pendente = true;
  estado.erro = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(salvar, ESPERA_SALVAR);
  avisarOuvintes();
}

async function salvar() {
  clearTimeout(temporizador);
  if (!estado.pendente) return;
  if (salvamentoAtual) {
    // Já está salvando: salva de novo quando terminar.
    await salvamentoAtual.catch(() => {});
    if (estado.pendente) return salvar();
    return;
  }

  estado.salvando = true;
  estado.pendente = false;
  avisarOuvintes();

  salvamentoAtual = salvarRascunho(copiar(estado.rascunho), copiar(estado.presente));
  try {
    await salvamentoAtual;
    estado.erro = false;
  } catch (erro) {
    console.error(erro.original || erro);
    estado.erro = true;
    estado.pendente = true;
    temporizador = setTimeout(salvar, ESPERA_TENTAR_DE_NOVO);
  } finally {
    salvamentoAtual = null;
    estado.salvando = false;
    avisarOuvintes();
  }
}

// Salva agora (antes de publicar ou pré-visualizar). Dá erro se não conseguir.
export async function salvarAgora() {
  clearTimeout(temporizador);
  if (salvamentoAtual) await salvamentoAtual.catch(() => {});
  if (estado.pendente) await salvar();
  if (estado.erro) throw new Error("nao_salvou");
}

export function marcarPublicado(quando) {
  estado.publicadoTexto = emTexto(estado.rascunho);
  estado.presentePublicadoTexto = emTexto(estado.presente);
  estado.publicadoEm = quando || new Date().toISOString();
  avisarOuvintes();
}

// Resumo para o selo do topo.
export function situacao() {
  const temDiferenca =
    estado.rascunho !== null &&
    (emTexto(estado.rascunho) !== estado.publicadoTexto ||
      emTexto(estado.presente) !== estado.presentePublicadoTexto);

  let tipo = "publicado";
  if (estado.erro) tipo = "erro";
  else if (estado.salvando || estado.pendente) tipo = "salvando";
  else if (temDiferenca) tipo = "pendente";

  return {
    tipo,
    temDiferenca,
    salvandoOuPendente: estado.salvando || estado.pendente,
    publicadoEm: estado.publicadoEm,
    nuncaPublicado: !estado.publicadoTexto,
  };
}

// Identificador único para stories, cartas, vales…
export function novoIdentificador() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Avisa antes de fechar a página se ainda não salvou.
window.addEventListener("beforeunload", (evento) => {
  if (estado.pendente || estado.salvando) {
    evento.preventDefault();
    evento.returnValue = "";
  }
});
