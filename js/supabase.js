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
  if (texto.includes("muitos_recados")) {
    return new ErroDoSite("muitos_recados", "Muitos recados hoje. Tenta amanhã.", erro);
  }
  if (texto.includes("recado_invalido")) {
    return new ErroDoSite("recado_invalido", "Recado inválido.", erro);
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

// Ela entra só com a data que ela digita (8 números, sem as barras).
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

// Pré-visualização: o presente do rascunho (só admin; não marca como aberto).
export async function previaPresente() {
  const { data, error } = await supabase.rpc("previa_presente");
  falhouSe(error);
  return data || {};
}

// ---------------------------------------------------------------------
// Lista dos próximos 365 dias (os dois leem, adicionam, marcam e apagam)
// ---------------------------------------------------------------------
const CAMPOS_LISTA = "id, texto, feito, feito_em, autor, criado_em";

export async function lerLista() {
  const { data, error } = await supabase
    .from("lista_365")
    .select(CAMPOS_LISTA)
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false });
  falhouSe(error);
  return data || [];
}

export async function adicionarNaLista(textoItem) {
  const { data, error } = await supabase
    .from("lista_365")
    .insert({ texto: textoItem })
    .select(CAMPOS_LISTA)
    .single();
  falhouSe(error);
  return data;
}

export async function marcarNaLista(id, feito) {
  const { data, error } = await supabase
    .from("lista_365")
    .update({ feito })
    .eq("id", id)
    .select(CAMPOS_LISTA)
    .single();
  falhouSe(error);
  return data;
}

export async function apagarDaLista(id) {
  const { error } = await supabase.from("lista_365").delete().eq("id", id);
  falhouSe(error);
}

// ---------------------------------------------------------------------
// Recados (ela envia; só tu lês no painel)
// ---------------------------------------------------------------------
export async function enviarRecado({ tipo, texto = null, audio = null, duracao = null }) {
  const { error } = await supabase.rpc("enviar_recado", {
    p_tipo: tipo,
    p_texto: texto,
    p_audio: audio,
    p_duracao: duracao == null ? null : Math.round(duracao),
  });
  falhouSe(error);
}

// Ela abriu uma carta (só conta quando é ela; tu testando não conta).
export async function registrarCarta(id, titulo) {
  const { error } = await supabase.rpc("registrar_carta", { p_id: String(id), p_titulo: titulo || null });
  falhouSe(error);
}

// Painel: quando ela abriu cada carta (mais recentes primeiro).
export async function lerCartasAbertas() {
  const { data, error } = await supabase
    .from("cartas_abertas")
    .select("id, carta_id, titulo, aberta_em")
    .order("aberta_em", { ascending: false })
    .limit(60);
  falhouSe(error);
  return data || [];
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

// Recados que ela mandou (mais novos primeiro).
export async function lerRecados() {
  const { data, error } = await supabase
    .from("recados")
    .select("id, tipo, texto, audio_path, duracao, lido, criado_em")
    .order("criado_em", { ascending: false });
  falhouSe(error);
  return data || [];
}

export async function marcarRecadosLidos(ids) {
  if (!ids || !ids.length) return;
  const { error } = await supabase.from("recados").update({ lido: true }).in("id", ids);
  falhouSe(error);
}

export async function apagarRecado(recado) {
  if (recado.audio_path) {
    const { error: erroArquivo } = await supabase.storage.from("recados").remove([recado.audio_path]);
    if (erroArquivo) console.error(erroArquivo);
  }
  const { error } = await supabase.from("recados").delete().eq("id", recado.id);
  falhouSe(error);
}

// Volta o presente para "fechado" (para testar de novo).
export async function fecharPresente() {
  const { error } = await supabase.rpc("fechar_presente");
  falhouSe(error);
}
