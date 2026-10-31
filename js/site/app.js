// =====================================================================
// Entre Mil Instantes · site/app.js
// O "maestro" do site dela: decide qual tela mostrar e em que ordem.
//
//   antes do dia 3  → contagem → (zera) → senha
//   depois do dia 3 → senha → carregamento → abertura…
//   se ela já entrou antes neste celular → direto para a abertura
//
// O caminho: abertura → stories → antes e agora → rádio → presente →
// vales → cartas → lista 365 → recado → cartão → nosso cantinho
// =====================================================================

import { desenharCeu, mostrarTela } from "./telas.js";
import { iniciarContagem } from "./contagem.js";
import { iniciarSenha } from "./senha.js";
import { rodarCarregamento } from "./carregamento.js";
import { prepararFotos, linkDaFoto } from "./fotos.js";
import { prepararMusica, destravarSom, alternarSom, atualizarBotao, haMusica, avisarQueTemVideo } from "./som.js";
import { montarRadio, destravarRadio, tocarRadio, pararRadio } from "./radio.js";
import { montarAbertura } from "./abertura.js";
import { montarListaDeStories, tocarStories } from "./stories.js";
import { temAntesAgora, tocarAntesAgora } from "./antes-agora.js";
import { temPresente, tocarPresente } from "./presente.js";
import { temVales, tocarVales } from "./vales.js";
import { temCartas, tocarCartas } from "./cartas.js";
import { tocarLista } from "./lista.js";
import { tocarRecado } from "./recado.js";
import { tocarCartao } from "./cartao.js";
import { tocarCantinho } from "./cantinho.js";
import { definirPrevia, ehPrevia, lerMemoria, guardarMemoria } from "./memoria.js";
import { prepararApp, atualizarConvite, precisaInstalarPrimeiro, tocarTelaInstalar } from "./instalar.js";
import {
  obterSituacao,
  entrarComoConvidada,
  meuPapel,
  obterConteudo,
  obterPrevia,
  sair,
} from "../supabase.js";

let conteudo = null;
let situacao = null;
let pararContagem = null;
let papel = "convidada";

const senha = iniciarSenha({ tentarEntrar, aoAcertar: abrirCarregamento });

// ---------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------
// Se o banco não responder em alguns segundos, para de esperar.
function comLimite(promessa, ms = 12000) {
  return Promise.race([
    promessa,
    new Promise((_, falhar) =>
      setTimeout(() => falhar(Object.assign(new Error("Demorou demais"), { codigo: "rede" })), ms)
    ),
  ]);
}

async function comecar() {
  desenharCeu();

  // Pré-visualização (só para o admin, aberta pelo painel).
  if (new URLSearchParams(window.location.search).get("previa") === "1") {
    const abriu = await comLimite(abrirPrevia(), 12000).catch(() => false);
    if (abriu) return;
  }

  // Celular pelo navegador (veio do QR code): primeiro instala o app.
  if (precisaInstalarPrimeiro()) {
    window.__siteComecou = true;
    await tocarTelaInstalar();
  }

  try {
    situacao = await comLimite(obterSituacao());
  } catch (erro) {
    window.__siteComecou = true;
    mostrarErro(erro);
    return;
  }

  if (situacao.agora() < situacao.liberarEm) {
    window.__siteComecou = true;
    irParaContagem();
    return;
  }

  const entrou = await comLimite(jaEntrouAntes(), 8000).catch(() => false);
  window.__siteComecou = true;
  if (entrou) {
    abrirSite();
    return;
  }

  irParaSenha();
}

// Mostra o RASCUNHO, pulando contagem e senha. Só funciona logado como admin.
async function abrirPrevia() {
  const quem = await meuPapel().catch(() => null);
  if (quem !== "admin") return false;
  conteudo = await obterPrevia();
  papel = "admin";
  definirPrevia(true);
  window.__siteComecou = true;
  document.getElementById("faixa-previa").hidden = false;
  document.documentElement.classList.add("modo-previa");
  await mostrarTela("tela-carregamento");
  await rodarCarregamento(conteudo, prepararSite());
  abrirSite();
  return true;
}

// Ela já acertou a senha antes neste celular? (a sessão fica guardada)
async function jaEntrouAntes() {
  try {
    const quem = await meuPapel();
    if (!quem) return false;
    conteudo = await obterConteudo();
    papel = quem;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------
async function irParaContagem() {
  if (pararContagem) pararContagem();
  await mostrarTela("tela-contagem");
  pararContagem = iniciarContagem(situacao.liberarEm, irParaSenha, situacao.agora);
}

async function irParaSenha() {
  await mostrarTela("tela-senha");
  senha.focar();
}

async function abrirCarregamento() {
  await mostrarTela("tela-carregamento");
  await rodarCarregamento(conteudo, prepararSite());
  abrirSite();
}

// Abertura (quem volta ao site depois cai direto aqui, com as fotos prontas).
let temRadio = false;

async function abrirSite() {
  await prepararSite();

  // Música do story (opção A) e Rádio
  const musica = (conteudo && conteudo.retrospectiva && conteudo.retrospectiva.musica) || {};
  prepararMusica(musica.audio ? linkDaFoto(musica.audio) : null, musica.inicio);
  temRadio = montarRadio(conteudo);
  const temVideo = (Array.isArray(conteudo && conteudo.stories) ? conteudo.stories : []).some(
    (s) => s && s.video && linkDaFoto(s.video)
  );
  avisarQueTemVideo(temVideo);
  document.getElementById("abertura-dica").textContent =
    haMusica() || temRadio || temVideo ? "Liga o som e, se puder, usa fone." : "Toca na tela para avançar os stories.";

  // Quem já viu tudo (ou já abriu o presente) pode ir direto pro cantinho.
  const voltou = ehPrevia() || lerMemoria("viu-tudo", false) || Boolean(conteudo && conteudo.presente_aberto);
  document.getElementById("abertura-cantinho").hidden = !voltou;

  montarAbertura(conteudo, () => {
    // Precisa ser aqui, no toque: é o que libera o som no celular.
    destravarSom();
    destravarRadio();
    caminhoCompleto();
  });
  await mostrarTela("tela-abertura");
}

document.getElementById("abertura-cantinho").addEventListener("click", () => {
  destravarSom();
  destravarRadio();
  irParaCantinho();
});

// Baixa as fotos enquanto o carregamento anima (uma vez só).
let preparo = null;
function prepararSite() {
  if (!preparo) preparo = prepararFotos(conteudo);
  return preparo;
}

// ---------------------------------------------------------------------
// As partes do final (cada uma só aparece se tiver conteúdo)
// ---------------------------------------------------------------------
const ETAPAS = [
  { id: "presente", titulo: "O presente", sub: "A caixa da surpresa", tem: temPresente, tocar: tocarPresente },
  { id: "vales", titulo: "Vales", sub: "A raspadinha", tem: temVales, tocar: tocarVales },
  { id: "cartas", titulo: "Cartas «Abre quando…»", sub: "Pra quando tu precisares", tem: temCartas, tocar: etapaDasCartas },
  {
    id: "lista",
    titulo: "Nossos próximos 365 dias",
    sub: "A nossa lista",
    tem: () => true,
    tocar: (c, opcoes) => tocarLista(c, { ...opcoes, papel }),
  },
  { id: "recado", titulo: "Deixar um recado", sub: "Escrito ou gravado", tem: () => true, tocar: tocarRecado },
];

// Cartas: o "Responder" leva ao recado e depois volta para as cartas.
async function etapaDasCartas(c, opcoes) {
  for (;;) {
    const resultado = await tocarCartas(c, opcoes);
    if (resultado && resultado.responder) {
      await tocarRecado(c, { resposta: resultado.responder });
      continue;
    }
    return resultado;
  }
}

// ---------------------------------------------------------------------
// O caminho completo
// ---------------------------------------------------------------------
async function caminhoCompleto() {
  pararRadio();
  const resultado = await blocoDaHistoria(0);
  if (resultado === "abertura") {
    await mostrarTela("tela-abertura");
    return;
  }

  if (temRadio) {
    document.getElementById("radio-continuar").textContent = "Continuar";
    await tocarRadio();
  }

  for (const etapa of ETAPAS) {
    if (etapa.tem(conteudo)) await etapa.tocar(conteudo, {});
  }

  await tocarCartao(conteudo);
  if (!ehPrevia()) guardarMemoria("viu-tudo", true);
  document.getElementById("abertura-cantinho").hidden = false;
  await irParaCantinho();
}

// Stories e "antes e agora" (com o "voltar" entre eles).
// Devolve "abertura" quando ela volta e não há stories para mostrar.
async function blocoDaHistoria(comecarEm) {
  let inicio = comecarEm;
  for (;;) {
    const lista = montarListaDeStories(conteudo);
    if (lista.length) {
      await mostrarTela("tela-stories");
      await tocarStories(lista, inicio);
    }
    if (!temAntesAgora(conteudo)) return "ok";
    await mostrarTela("tela-antes-agora");
    const escolha = await tocarAntesAgora(conteudo);
    if (escolha !== "voltar") return "ok";
    if (!lista.length) return "abertura";
    inicio = -1;
  }
}

// ---------------------------------------------------------------------
// Nosso cantinho (menu para voltar a qualquer parte)
// ---------------------------------------------------------------------
function itensDoCantinho() {
  const itens = [];
  if (montarListaDeStories(conteudo).length || temAntesAgora(conteudo)) {
    itens.push({ id: "stories", titulo: "Nossa retrospectiva", sub: "Os stories de novo" });
  }
  if (temRadio) itens.push({ id: "radio", titulo: "A Rádio", sub: "As nossas faixas" });
  for (const etapa of ETAPAS) {
    if (etapa.tem(conteudo)) itens.push({ id: etapa.id, titulo: etapa.titulo, sub: etapa.sub });
  }
  itens.push({ id: "cartao", titulo: "Cartão para o story", sub: "Baixar a imagem" });
  return itens;
}

async function irParaCantinho() {
  for (;;) {
    atualizarConvite();
    const escolha = await tocarCantinho(itensDoCantinho());
    if (escolha === "inicio") {
      caminhoCompleto();
      return;
    }
    await abrirParte(escolha);
  }
}

async function abrirParte(id) {
  if (id === "stories") {
    await blocoDaHistoria(0);
    return;
  }
  if (id === "radio") {
    document.getElementById("radio-continuar").textContent = "Voltar ao cantinho";
    await tocarRadio();
    return;
  }
  if (id === "cartao") {
    await tocarCartao(conteudo);
    return;
  }
  const etapa = ETAPAS.find((e) => e.id === id);
  if (etapa) await etapa.tocar(conteudo, { deCantinho: true });
}

document.getElementById("stories-som").addEventListener("click", alternarSom);
atualizarBotao();

// ---------------------------------------------------------------------
// Senha
// ---------------------------------------------------------------------
async function tentarEntrar(numeros) {
  try {
    await entrarComoConvidada(numeros);
    papel = "convidada";
  } catch (erro) {
    if (erro.codigo === "senha_errada") return "errado";
    if (erro.codigo === "muitas_tentativas") return "muitas_tentativas";
    if (erro.codigo === "rede") return "rede";
    console.error(erro.original || erro);
    return "erro";
  }

  try {
    conteudo = await obterConteudo();
    return "certo";
  } catch (erro) {
    if (erro.codigo === "sem_acesso") {
      // Senha certa, mas ainda não é a hora (celular adiantado).
      await sair().catch(() => {});
      try {
        situacao = await obterSituacao();
      } catch {
        return "rede";
      }
      if (situacao.agora() < situacao.liberarEm) {
        irParaContagem();
        return "parado";
      }
      // Já é a hora, mas o banco recusou: a conta dela está sem o papel
      // "convidada" (problema de configuração, não de senha).
      console.error(
        "[Entre Mil Instantes] Senha certa, mas a conta não tem o papel 'convidada' na tabela papeis."
      );
      return "erro";
    }
    if (erro.codigo === "rede") return "rede";
    console.error(erro.original || erro);
    return "erro";
  }
}

// ---------------------------------------------------------------------
// Erro ao abrir
// ---------------------------------------------------------------------
function mostrarErro(erro) {
  console.error((erro && erro.original) || erro);
  const texto = document.getElementById("erro-texto");
  if (!erro || erro.codigo !== "rede") {
    texto.textContent = "Tenta de novo em instantes.";
  }
  mostrarTela("tela-erro");
}

document.getElementById("erro-tentar").addEventListener("click", () => {
  window.location.reload();
});

prepararApp();
comecar();
