// =====================================================================
// Entre Mil Instantes · site/app.js
// O "maestro" do site dela: decide qual tela mostrar e em que ordem.
//
//   antes do dia 3  → contagem → (zera) → senha
//   depois do dia 3 → senha → carregamento → abertura…
//   se ela já entrou antes neste celular → direto para a abertura
// =====================================================================

import { desenharCeu, mostrarTela } from "./telas.js";
import { iniciarContagem } from "./contagem.js";
import { iniciarSenha } from "./senha.js";
import { rodarCarregamento } from "./carregamento.js";
import { prepararFotos, linkDaFoto } from "./fotos.js";
import { prepararMusica, destravarSom, alternarSom, atualizarBotao, haMusica } from "./som.js";
import { montarRadio, destravarRadio, tocarRadio, pararRadio } from "./radio.js";
import { montarAbertura } from "./abertura.js";
import { montarListaDeStories, tocarStories } from "./stories.js";
import { temAntesAgora, tocarAntesAgora } from "./antes-agora.js";
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
  const papel = await meuPapel().catch(() => null);
  if (papel !== "admin") return false;
  conteudo = await obterPrevia();
  window.__siteComecou = true;
  document.getElementById("faixa-previa").hidden = false;
  await mostrarTela("tela-carregamento");
  await rodarCarregamento(conteudo, prepararSite());
  abrirSite();
  return true;
}

// Ela já acertou a senha antes neste celular? (a sessão fica guardada)
async function jaEntrouAntes() {
  try {
    const papel = await meuPapel();
    if (!papel) return false;
    conteudo = await obterConteudo();
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
  document.getElementById("continua-radio").hidden = !temRadio;
  document.getElementById("abertura-dica").textContent =
    haMusica() || temRadio ? "Liga o som e, se puder, usa fone." : "Toca na tela para avançar os stories.";

  montarAbertura(conteudo, () => {
    // Precisa ser aqui, no toque: é o que libera o som no celular.
    destravarSom();
    destravarRadio();
    irParaStories(0);
  });
  await mostrarTela("tela-abertura");
}

// Baixa as fotos enquanto o carregamento anima (uma vez só).
let preparo = null;
function prepararSite() {
  if (!preparo) preparo = prepararFotos(conteudo);
  return preparo;
}

// ---------------------------------------------------------------------
// O caminho: abertura → stories → antes e agora → (fase 4: rádio)
// ---------------------------------------------------------------------
async function irParaStories(comecarEm) {
  const lista = montarListaDeStories(conteudo);
  if (!lista.length) {
    // Sem stories: "voltar" leva à abertura; "seguir" pula para o próximo.
    if (comecarEm < 0) await mostrarTela("tela-abertura");
    else await irParaAntesAgora();
    return;
  }
  await mostrarTela("tela-stories");
  await tocarStories(lista, comecarEm);
  await irParaAntesAgora();
}

async function irParaAntesAgora() {
  if (!temAntesAgora(conteudo)) {
    await irParaRadio();
    return;
  }
  await mostrarTela("tela-antes-agora");
  const escolha = await tocarAntesAgora(conteudo);
  if (escolha === "voltar") await irParaStories(-1);
  else await irParaRadio();
}

async function irParaRadio() {
  if (!temRadio) {
    await irParaContinua();
    return;
  }
  await tocarRadio();
  await irParaContinua();
}

async function irParaContinua() {
  await mostrarTela("tela-continua");
}

document.getElementById("continua-de-novo").addEventListener("click", () => {
  pararRadio();
  irParaStories(0);
});
document.getElementById("continua-radio").addEventListener("click", () => irParaRadio());
document.getElementById("stories-som").addEventListener("click", alternarSom);
atualizarBotao();

// ---------------------------------------------------------------------
// Senha
// ---------------------------------------------------------------------
async function tentarEntrar(numeros) {
  try {
    await entrarComoConvidada(numeros);
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

comecar();
