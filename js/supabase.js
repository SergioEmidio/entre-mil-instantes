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
  return data ?? null;
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
