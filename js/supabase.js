// =====================================================================
// Entre Mil Instantes · supabase.js
// Conexão com o Supabase e as funções que o site e o painel usam.
// =====================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { CONFIG, configPreenchido } from "./config.js";

const pronto = configPreenchido();
if (!pronto) {
  console.error("[Entre Mil Instantes] Preencha o js/config.js com a URL e a chave publicável do Supabase.");
}

// Se o config.js ainda estiver vazio, usa um endereço reserva só para a página não travar.
const url = pronto ? CONFIG.SUPABASE_URL : "https://preencha-o-config-js.supabase.co";
const chave = pronto ? CONFIG.SUPABASE_CHAVE_PUBLICA : "preencha-o-config-js";

export const supabase = createClient(url, chave, {
  auth: {
    persistSession: true,      // ela não precisa digitar a data toda vez que voltar
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ---------------------------------------------------------------------
// Erros: transforma o erro do Supabase numa mensagem simples.
// ---------------------------------------------------------------------
export class ErroDoSite extends Error {
  constructor(codigo, mensagem, original) {
    super(mensagem);
    this.codigo = codigo;       // "senha_errada", "sem_acesso", "muitas_tentativas", "rede"…
    this.original = original;
  }
}

function traduzirErro(erro) {
  if (!erro) return null;
  const texto = `${erro.message || ""} ${erro.code || ""}`.toLowerCase();

  if (texto.includes("invalid login credentials")) {
    return new ErroDoSite("senha_errada", "Senha errada.", erro);
  }
  if (erro.status === 429 || texto.includes("rate limit") || texto.includes("too many")) {
    return new ErroDoSite("muitas_tentativas", "Muitas tentativas. Espera alguns minutos.", erro);
  }
  if (texto.includes("sem_acesso") || erro.code === "42501") {
    return new ErroDoSite("sem_acesso", "Ainda não está liberado.", erro);
  }
  if (texto.includes("confirmacao_invalida")) {
    return new ErroDoSite("confirmacao_invalida", "Digite AUTORIZO para confirmar.", erro);
  }
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return new ErroDoSite("rede", "Sem conexão. Confere a internet.", erro);
  }
  return new ErroDoSite("desconhecido", "Algo deu errado. Tenta de novo.", erro);
}

function falhouSe(erro) {
  if (erro) throw traduzirErro(erro);
}

// ---------------------------------------------------------------------
// Configuração pública
// ---------------------------------------------------------------------

// Hora em que o site abre para ela (Date).
export async function obterLiberacao() {
  const { data, error } = await supabase
    .from("configuracao")
    .select("liberar_em")
    .eq("id", 1)
    .single();
  falhouSe(error);
  return new Date(data.liberar_em);
}

// Hora de abrir + diferença entre o relógio do celular e o do servidor.
// Assim a contagem fica certa mesmo se o celular estiver com a hora errada.
// Devolve { liberarEm: Date, agora: () => Date (hora do servidor) }.
export async function obterSituacao() {
  const antes = Date.now();
  const { data, error } = await supabase.rpc("situacao_publica");
  falhouSe(error);
  const depois = Date.now();

  const horaServidor = new Date(data.agora).getTime();
  const meioDoCaminho = antes + (depois - antes) / 2;
  const diferenca = horaServidor - meioDoCaminho;

  return {
    liberarEm: new Date(data.liberar_em),
    agora: () => new Date(Date.now() + diferenca),
  };
}

// ---------------------------------------------------------------------
// Entrar e sair
// ---------------------------------------------------------------------

// Ela entra só com a data: "19052025" (8 números).
export async function entrarComoConvidada(oitoNumeros) {
  const { error } = await supabase.auth.signInWithPassword({
    email: CONFIG.EMAIL_CONVIDADA,
    password: oitoNumeros,
  });
  falhouSe(error);
}

// Tu entras no painel com o teu e-mail e senha.
export async function entrarComoAdmin(email, senha) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  falhouSe(error);
}

export async function sair() {
  const { error } = await supabase.auth.signOut();
  falhouSe(error);
}

// "admin", "convidada" ou null (ninguém logado / sem papel).
export async function meuPapel() {
  const { data: sessao } = await supabase.auth.getSession();
  if (!sessao.session) return null;
  const { data, error } = await supabase.rpc("meu_papel");
  falhouSe(error);
  return data == null ? null : data;
}

// ---------------------------------------------------------------------
// Conteúdo
// ---------------------------------------------------------------------

// Site dela: conteúdo publicado.
export async function obterConteudo() {
  const { data, error } = await supabase.rpc("obter_conteudo");
  falhouSe(error);
  return data || {};
}

// Site dela: abre a caixa do presente.
export async function abrirPresente() {
  const { data, error } = await supabase.rpc("abrir_presente");
  falhouSe(error);
  return data || {};
}

// ---------------------------------------------------------------------
// Arquivos (fotos e áudios ficam privados; o site pede um link temporário)
// ---------------------------------------------------------------------

// Um link que vale por algumas horas para mostrar uma foto ou tocar um áudio.
export async function linkDoArquivo(balde, caminho, segundos = 60 * 60 * 6) {
  if (!caminho) return null;
  const { data, error } = await supabase.storage.from(balde).createSignedUrl(caminho, segundos);
  falhouSe(error);
  return data.signedUrl;
}

// Vários links de uma vez (bem mais rápido do que um por um).
// Devolve um objeto { caminho: link }.
export async function linksDosArquivos(balde, caminhos, segundos = 60 * 60 * 6) {
  const lista = [...new Set((caminhos || []).filter(Boolean))];
  if (lista.length === 0) return {};
  const { data, error } = await supabase.storage.from(balde).createSignedUrls(lista, segundos);
  falhouSe(error);
  const mapa = {};
  for (const item of data) {
    if (item.signedUrl) mapa[item.path] = item.signedUrl;
  }
  return mapa;
}

// Envia um arquivo (foto ou áudio) e devolve o caminho onde ficou guardado.
export async function enviarArquivo(balde, caminho, arquivo, tipo) {
  const { data, error } = await supabase.storage.from(balde).upload(caminho, arquivo, {
    contentType: tipo || arquivo.type || "application/octet-stream",
    cacheControl: "31536000",
    upsert: false,
  });
  falhouSe(error);
  return data.path || caminho;
}

// ---------------------------------------------------------------------
// Painel (só funciona para o admin)
// ---------------------------------------------------------------------

// Lê o rascunho e o publicado do conteúdo e do presente.
export async function carregarPainel() {
  const [conteudo, presente] = await Promise.all([
    supabase.from("conteudo").select("rascunho, publicado, publicado_em").eq("id", 1).single(),
    supabase.from("presente").select("rascunho, publicado, aberto_em").eq("id", 1).single(),
  ]);
  falhouSe(conteudo.error);
  falhouSe(presente.error);
  return { conteudo: conteudo.data, presente: presente.data };
}

// Guarda o rascunho (o site dela não muda).
export async function salvarRascunho(dados, presenteDados) {
  const { error } = await supabase.rpc("salvar_rascunho", {
    dados,
    presente_dados: presenteDados,
  });
  falhouSe(error);
}

// Publica o rascunho para ela ver. Só funciona com a palavra AUTORIZO.
export async function publicarRascunho(confirmacao) {
  const { data, error } = await supabase.rpc("publicar", { confirmacao });
  falhouSe(error);
  return data;
}

// Site em modo pré-visualização: o admin vê o rascunho.
export async function obterPrevia() {
  const { data, error } = await supabase.rpc("obter_previa");
  falhouSe(error);
  return data || {};
}
