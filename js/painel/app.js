// =====================================================================
// Entre Mil Instantes · painel/app.js
// Login, abas, selo de situação, pré-visualizar e publicar.
// =====================================================================

import { supabase, entrarComoAdmin, meuPapel, sair, publicarRascunho, obterSituacao } from "../supabase.js";
import { carregar, aoMudarSituacao, situacao, salvarAgora, marcarPublicado, rascunho, presente } from "./estado.js";
import { prepararLinks } from "./midia.js";
import { h, avisar, dataHora } from "./ui.js";
import { desenharRetrospectiva } from "./abas/retrospectiva.js";
import { desenharStories } from "./abas/stories.js";
import { desenharCartas } from "./abas/cartas.js";
import { desenharVales } from "./abas/vales.js";
import { desenharPresente } from "./abas/presente.js";
import { desenharRecados, contarNovos } from "./abas/recados.js";
import { desenharRadio } from "./abas/radio.js";

const ABAS = [
  { id: "retrospectiva", nome: "Retrospectiva", desenhar: desenharRetrospectiva },
  { id: "stories", nome: "Stories", desenhar: desenharStories },
  { id: "radio", nome: "Rádio", desenhar: desenharRadio },
  { id: "cartas", nome: "Cartas", desenhar: desenharCartas },
  { id: "vales", nome: "Vales", desenhar: desenharVales },
  { id: "recados", nome: "Recados", desenhar: desenharRecados },
  { id: "presente", nome: "Presente", desenhar: desenharPresente },
];

const el = {
  carregando: document.getElementById("vista-carregando"),
  login: document.getElementById("vista-login"),
  painel: document.getElementById("vista-painel"),
  abas: document.getElementById("abas"),
  area: document.getElementById("area"),
  estado: document.getElementById("estado"),
  sub: document.getElementById("topo-sub"),
  previa: document.getElementById("botao-previa"),
  publicar: document.getElementById("botao-publicar"),
};

let abaAtual = lerAbaGuardada();
let novosRecados = 0;
let liberarEm = null;

// ---------------------------------------------------------------------
// Vistas
// ---------------------------------------------------------------------
function mostrarVista(qual) {
  el.carregando.hidden = qual !== "carregando";
  el.login.hidden = qual !== "login";
  el.painel.hidden = qual !== "painel";
}

// ---------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------
async function comecar() {
  mostrarVista("carregando");
  let papel = null;
  try {
    papel = await meuPapel();
  } catch (erro) {
    console.error(erro.original || erro);
  }

  if (papel === "admin") {
    await abrirPainel();
    return;
  }
  if (papel === "convidada") {
    // Este navegador estava logado como ela (em teste). Sai para entrar como admin.
    await sair().catch(() => {});
  }
  mostrarVista("login");
  document.getElementById("login-email").focus();
}

// ---------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------
const formLogin = document.getElementById("login-form");
const campoEmail = document.getElementById("login-email");
const campoSenha = document.getElementById("login-senha");
const botaoLogin = document.getElementById("login-botao");
const erroLogin = document.getElementById("login-erro");

function atualizarBotaoLogin() {
  botaoLogin.disabled = !(campoEmail.value.trim() && campoSenha.value);
}
campoEmail.addEventListener("input", atualizarBotaoLogin);
campoSenha.addEventListener("input", atualizarBotaoLogin);

document.getElementById("login-mostrar").addEventListener("change", (evento) => {
  campoSenha.type = evento.target.checked ? "text" : "password";
});

formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (botaoLogin.disabled) return;
  erroLogin.textContent = "";
  botaoLogin.disabled = true;
  botaoLogin.textContent = "Entrando…";

  try {
    await entrarComoAdmin(campoEmail.value.trim(), campoSenha.value);
    const papel = await meuPapel();
    if (papel !== "admin") {
      await sair().catch(() => {});
      erroLogin.textContent = "Esta conta não tem acesso ao painel.";
      return;
    }
    campoSenha.value = "";
    await abrirPainel();
  } catch (erro) {
    if (erro.codigo === "senha_errada") erroLogin.textContent = "E-mail ou senha errados.";
    else if (erro.codigo === "muitas_tentativas") erroLogin.textContent = "Muitas tentativas. Espera alguns minutos.";
    else if (erro.codigo === "rede") erroLogin.textContent = "Sem conexão. Confere a internet.";
    else {
      console.error(erro.original || erro);
      erroLogin.textContent = "Não consegui entrar. Tenta de novo.";
    }
  } finally {
    botaoLogin.textContent = "Entrar";
    atualizarBotaoLogin();
  }
});

document.getElementById("botao-sair").addEventListener("click", async () => {
  try {
    await salvarAgora();
  } catch {
    avisar("Ainda não consegui salvar. Espera um pouco antes de sair.", "erro", 5000);
    return;
  }
  await sair().catch(() => {});
  window.location.reload();
});

// ---------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------
async function abrirPainel() {
  mostrarVista("carregando");
  try {
    await carregar();
  } catch (erro) {
    console.error(erro.original || erro);
    mostrarVista("login");
    erroLogin.textContent = "Não consegui carregar o rascunho. Recarrega a página.";
    return;
  }

  obterSituacao()
    .then((s) => {
      liberarEm = s.liberarEm;
      atualizarSelo(situacao());
    })
    .catch(() => {});

  // Busca de uma vez os links das fotos que já existem.
  await Promise.all([prepararLinks("midia", caminhosDasFotos()), prepararLinks("presente", [presente().foto])]);

  desenharAbas();
  desenharAba();
  aoMudarSituacao(atualizarSelo);

  // Quantos recados novos ela mandou (aparece na aba).
  contarNovos()
    .then((n) => {
      novosRecados = n;
      desenharAbas();
    })
    .catch(() => {});
  window.addEventListener("eni-recados-lidos", () => {
    novosRecados = 0;
    desenharAbas();
  });
  atualizarSelo(situacao());
  mostrarVista("painel");
}

function caminhosDasFotos() {
  const r = rascunho();
  return [
    r.retrospectiva.musica.capa,
    r.retrospectiva.musica.audio,
    r.antes_agora.antes,
    r.antes_agora.agora,
    ...r.stories.map((s) => s.foto),
    ...r.radio.faixas.map((f) => f.capa),
    ...r.radio.faixas.map((f) => f.audio),
    r.cartao.foto,
    r.radio.capa,
  ].filter(Boolean);
}

function desenharAbas() {
  el.abas.replaceChildren(
    ...ABAS.map((aba) =>
      h(
        "button",
        {
          class: "aba",
          type: "button",
          role: "tab",
          id: `aba-${aba.id}`,
          "aria-selected": String(aba.id === abaAtual),
          "aria-controls": "area",
          onClick: () => trocarAba(aba.id),
        },
        aba.nome,
        aba.marca ? h("span", { class: "aba-marca" }, aba.marca) : null,
        aba.id === "recados" && novosRecados ? h("span", { class: "aba-marca aba-marca--novo" }, String(novosRecados)) : null
      )
    )
  );
  el.area.setAttribute("aria-labelledby", `aba-${abaAtual}`);
}

function trocarAba(id) {
  if (id === abaAtual) return;
  abaAtual = id;
  guardarAba(id);
  desenharAbas();
  desenharAba();
  window.scrollTo(0, 0);
  const botao = document.getElementById(`aba-${id}`);
  if (botao) botao.scrollIntoView({ inline: "nearest", block: "nearest" });
}

function desenharAba() {
  const aba = ABAS.find((a) => a.id === abaAtual) || ABAS[0];

  // Redesenha a mesma aba (depois de adicionar, excluir ou mudar a ordem),
  // mantendo a rolagem no mesmo lugar.
  function redesenhar() {
    const y = window.scrollY;
    el.area.replaceChildren();
    aba.desenhar(el.area, redesenhar);
    window.scrollTo(0, y);
  }

  el.area.replaceChildren();
  aba.desenhar(el.area, redesenhar);
}

// ---------------------------------------------------------------------
// Selo de situação (topo) e botões de baixo
// ---------------------------------------------------------------------
function atualizarSelo(s) {
  const textos = {
    salvando: "Salvando…",
    pendente: "Não publicado",
    publicado: "Tudo publicado",
    erro: "Erro ao salvar",
  };
  el.estado.dataset.tipo = s.tipo;
  el.estado.textContent = textos[s.tipo];

  const partes = [];
  if (s.publicadoEm) partes.push(`Última publicação: ${dataHora(s.publicadoEm)}`);
  else partes.push("Ainda não publicaste nada.");
  if (liberarEm && liberarEm > new Date()) partes.push(`ela vê a partir de ${dataHora(liberarEm)}`);
  el.sub.textContent = partes.join(" · ");

  el.publicar.disabled = !s.temDiferenca && !s.salvandoOuPendente;
  el.publicar.textContent = el.publicar.disabled ? "Tudo publicado" : "Publicar";
}

// ---------------------------------------------------------------------
// Pré-visualizar
// ---------------------------------------------------------------------
el.previa.addEventListener("click", async () => {
  // Abre a aba na hora (o navegador bloqueia se abrir depois de esperar).
  const janela = window.open("", "_blank");
  try {
    await salvarAgora();
  } catch {
    if (janela) janela.close();
    avisar("Ainda não consegui salvar. Tenta de novo em instantes.", "erro");
    return;
  }
  const endereco = new URL("../?previa=1", window.location.href).href;
  if (janela) janela.location.href = endereco;
  else window.location.href = endereco;
});

// ---------------------------------------------------------------------
// Publicar (com AUTORIZO)
// ---------------------------------------------------------------------
const janelaPublicar = document.getElementById("janela-publicar");
const pergunta = document.getElementById("publicar-pergunta");
const ok = document.getElementById("publicar-ok");
const campoAutorizo = document.getElementById("publicar-campo");
const confirmarPublicar = document.getElementById("publicar-confirmar");
const erroPublicar = document.getElementById("publicar-erro");

const digitouAutorizo = () => campoAutorizo.value.trim().toUpperCase() === "AUTORIZO";

el.publicar.addEventListener("click", () => {
  pergunta.hidden = false;
  ok.hidden = true;
  campoAutorizo.value = "";
  erroPublicar.textContent = "";
  confirmarPublicar.disabled = true;
  confirmarPublicar.textContent = "Autorizar";

  const antes = liberarEm && liberarEm > new Date();
  document.getElementById("publicar-texto").textContent = antes
    ? `As alterações do rascunho ficam prontas no site dela. Ela só vai ver a partir de ${dataHora(liberarEm)}.`
    : "As alterações do rascunho vão aparecer no site dela na próxima vez que ela abrir.";

  janelaPublicar.showModal();
  campoAutorizo.focus();
});

campoAutorizo.addEventListener("input", () => {
  confirmarPublicar.disabled = !digitouAutorizo();
});

campoAutorizo.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    if (digitouAutorizo()) confirmarPublicar.click();
  }
});

document.getElementById("publicar-cancelar").addEventListener("click", () => janelaPublicar.close());
document.getElementById("publicar-fechar").addEventListener("click", () => janelaPublicar.close());

confirmarPublicar.addEventListener("click", async () => {
  if (!digitouAutorizo()) return;
  confirmarPublicar.disabled = true;
  confirmarPublicar.textContent = "Publicando…";
  erroPublicar.textContent = "";

  try {
    await salvarAgora();
    const quando = await publicarRascunho("AUTORIZO");
    marcarPublicado(quando);
    pergunta.hidden = true;
    ok.hidden = false;
    document.getElementById("publicar-fechar").focus();
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    erroPublicar.textContent =
      erro && erro.codigo === "rede" ? "Sem conexão. Nada foi publicado." : "Não consegui publicar. Tenta de novo.";
    confirmarPublicar.textContent = "Autorizar";
    confirmarPublicar.disabled = !digitouAutorizo();
  }
});

// ---------------------------------------------------------------------
// Lembra a última aba aberta (só neste navegador)
// ---------------------------------------------------------------------
function lerAbaGuardada() {
  try {
    const salva = localStorage.getItem("eni-painel-aba");
    return ABAS.some((a) => a.id === salva) ? salva : "retrospectiva";
  } catch {
    return "retrospectiva";
  }
}

function guardarAba(id) {
  try {
    localStorage.setItem("eni-painel-aba", id);
  } catch {
    /* navegação anônima pode bloquear: tudo bem */
  }
}

// Se a sessão cair (ex.: saiu em outra aba), volta para o login.
supabase.auth.onAuthStateChange((evento) => {
  if (evento === "SIGNED_OUT" && !el.painel.hidden) {
    window.location.reload();
  }
});

comecar();
