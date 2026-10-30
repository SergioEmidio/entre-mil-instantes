// =====================================================================
// Entre Mil Instantes · site/recado.js
// Tela 15: ela deixa um recado escrito ou gravado. Só tu lês/ouves,
// no painel. Na pré-visualização nada é enviado.
// =====================================================================

import { texto, esperarClique } from "./dom.js";
import { ehPrevia } from "./memoria.js";
import { mostrarTela } from "./telas.js";
import { enviarArquivo, enviarRecado } from "../supabase.js";
import {
  podeGravar,
  comecarGravacao,
  converterParaWav,
  mensagemDeErroDoAudio,
  MAX_GRAVACAO_SEG,
  LIMITE_MB,
} from "../painel/audio.js";

const el = {};
let ligado = false;

let modo = "texto";            // texto | voz
let estadoVoz = "parado";      // parado | gravando | preparando | pronto
let gravacao = null;
let relogio = null;
let inicioGravacao = 0;
let audioPronto = null;        // { blob, duracao }
let linkOuvir = null;
let enviando = false;

const minSeg = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function pegar() {
  if (ligado) return;
  ligado = true;
  const ids = {
    escrever: "recado-escrever",
    enviado: "recado-enviado",
    modoTexto: "recado-modo-texto",
    modoVoz: "recado-modo-voz",
    areaTexto: "recado-texto-area",
    areaVoz: "recado-voz-area",
    campo: "recado-campo",
    gravar: "recado-gravar",
    vozTexto: "recado-voz-texto",
    ouvir: "recado-ouvir",
    erro: "recado-erro",
    enviar: "recado-enviar",
    pular: "recado-pular",
    okTitulo: "recado-ok-titulo",
    okTexto: "recado-ok-texto",
    seguir: "recado-seguir",
    outro: "recado-outro",
  };
  for (const [nome, id] of Object.entries(ids)) el[nome] = document.getElementById(id);

  el.modoTexto.addEventListener("click", () => trocarModo("texto"));
  el.modoVoz.addEventListener("click", () => trocarModo("voz"));
  el.campo.addEventListener("input", atualizar);
  el.gravar.addEventListener("click", alternarGravacao);
  el.enviar.addEventListener("click", enviar);
  el.outro.addEventListener("click", () => {
    limpar();
    mostrarFormulario();
    el.campo.focus();
  });

  // Setas trocam a aba (padrão de abas acessíveis).
  for (const aba of [el.modoTexto, el.modoVoz]) {
    aba.addEventListener("keydown", (evento) => {
      if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
        evento.preventDefault();
        trocarModo(modo === "texto" ? "voz" : "texto");
        (modo === "texto" ? el.modoTexto : el.modoVoz).focus();
      }
    });
  }
}

// ---------------------------------------------------------------------
function trocarModo(novo) {
  if (novo === "voz" && !podeGravar()) return;
  if (estadoVoz === "gravando" || estadoVoz === "preparando") return;
  modo = novo;
  el.erro.textContent = "";
  atualizar();
}

function atualizar() {
  const ehTexto = modo === "texto";
  el.modoTexto.setAttribute("aria-selected", String(ehTexto));
  el.modoVoz.setAttribute("aria-selected", String(!ehTexto));
  el.modoTexto.tabIndex = ehTexto ? 0 : -1;
  el.modoVoz.tabIndex = ehTexto ? -1 : 0;
  el.areaTexto.hidden = !ehTexto;
  el.areaVoz.hidden = ehTexto;

  // Gravação
  el.gravar.classList.toggle("recado-gravar--ligado", estadoVoz === "gravando");
  el.gravar.disabled = estadoVoz === "preparando" || enviando;
  el.gravar.setAttribute("aria-label", estadoVoz === "gravando" ? "Parar gravação" : "Gravar");
  if (estadoVoz === "gravando") {
    el.vozTexto.textContent = `Gravando · ${minSeg((Date.now() - inicioGravacao) / 1000)} · toca para parar`;
  } else if (estadoVoz === "preparando") {
    el.vozTexto.textContent = "Preparando o áudio…";
  } else if (estadoVoz === "pronto" && audioPronto) {
    el.vozTexto.textContent = `Gravado (${minSeg(audioPronto.duracao)}). Toca para gravar de novo.`;
  } else {
    el.vozTexto.textContent = `Toca para gravar (até ${minSeg(MAX_GRAVACAO_SEG)})`;
  }
  el.ouvir.hidden = !(estadoVoz === "pronto" && audioPronto);

  const pronto = ehTexto ? Boolean(texto(el.campo.value)) : estadoVoz === "pronto" && Boolean(audioPronto);
  el.enviar.disabled = !pronto || enviando;
  el.enviar.textContent = enviando ? "Enviando…" : "Enviar pra ele";
  el.pular.disabled = enviando;
}

// ---------------------------------------------------------------------
// Gravar
// ---------------------------------------------------------------------
async function alternarGravacao() {
  if (estadoVoz === "gravando") {
    await pararGravacao();
    return;
  }
  if (estadoVoz === "preparando" || enviando) return;
  el.erro.textContent = "";
  try {
    gravacao = await comecarGravacao();
  } catch (erro) {
    el.erro.textContent = mensagemDeErroDoAudio(erro);
    return;
  }
  el.ouvir.pause();
  estadoVoz = "gravando";
  inicioGravacao = Date.now();
  relogio = setInterval(() => {
    if ((Date.now() - inicioGravacao) / 1000 >= MAX_GRAVACAO_SEG) pararGravacao();
    else atualizar();
  }, 250);
  atualizar();
}

async function pararGravacao() {
  if (estadoVoz !== "gravando" || !gravacao) return;
  clearInterval(relogio);
  estadoVoz = "preparando";
  atualizar();
  try {
    const bruto = await gravacao.parar();
    gravacao = null;
    const { blob, duracao } = await converterParaWav(bruto, { voz: true });
    if (duracao < 1) throw Object.assign(new Error("audio_vazio"), { codigo: "audio_vazio" });
    if (blob.size > LIMITE_MB * 1024 * 1024) throw Object.assign(new Error("muito_grande"), { codigo: "muito_grande" });
    audioPronto = { blob, duracao };
    if (linkOuvir) URL.revokeObjectURL(linkOuvir);
    linkOuvir = URL.createObjectURL(blob);
    el.ouvir.src = linkOuvir;
    estadoVoz = "pronto";
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    el.erro.textContent = mensagemDeErroDoAudio(erro);
    estadoVoz = audioPronto ? "pronto" : "parado";
  }
  atualizar();
}

function cancelarGravacao() {
  clearInterval(relogio);
  if (gravacao) {
    gravacao.cancelar();
    gravacao = null;
  }
  if (estadoVoz === "gravando") estadoVoz = audioPronto ? "pronto" : "parado";
}

// ---------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------
function novoNome() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mensagemDeErro(erro) {
  const codigo = erro && erro.codigo;
  if (codigo === "rede") return "Sem internet agora. Teu recado não foi enviado. Tenta de novo.";
  if (codigo === "muitos_recados") return "Muitos recados hoje. Tenta de novo amanhã.";
  if (codigo === "sem_acesso") return "Não consegui enviar. Recarrega a página e tenta de novo.";
  return "Não consegui enviar. Tenta de novo.";
}

async function enviar() {
  if (enviando || el.enviar.disabled) return;
  enviando = true;
  el.erro.textContent = "";
  atualizar();

  try {
    if (!ehPrevia()) {
      if (modo === "texto") {
        await enviarRecado({ tipo: "texto", texto: texto(el.campo.value) });
      } else {
        const caminho = `recado/${novoNome()}.wav`;
        await enviarArquivo("recados", caminho, audioPronto.blob, "audio/wav");
        await enviarRecado({ tipo: "audio", audio: caminho, duracao: audioPronto.duracao });
      }
    }
    mostrarEnviado();
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    el.erro.textContent = mensagemDeErro(erro);
  } finally {
    enviando = false;
    atualizar();
  }
}

function limpar() {
  el.campo.value = "";
  audioPronto = null;
  estadoVoz = "parado";
  el.ouvir.pause();
  el.ouvir.removeAttribute("src");
  if (linkOuvir) {
    URL.revokeObjectURL(linkOuvir);
    linkOuvir = null;
  }
  el.erro.textContent = "";
}

function mostrarFormulario() {
  el.escrever.hidden = false;
  el.enviado.hidden = true;
  atualizar();
}

function mostrarEnviado() {
  el.okTexto.textContent = ehPrevia()
    ? "Prévia: nada foi enviado. É isso que ela vai ver depois de mandar."
    : "Vou guardar pra sempre. Falta só uma coisinha.";
  limpar();
  el.escrever.hidden = true;
  el.enviado.hidden = false;
  el.okTitulo.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------
export async function tocarRecado(conteudo, { deCantinho = false } = {}) {
  pegar();
  el.modoVoz.hidden = !podeGravar();
  if (!podeGravar()) modo = "texto";
  el.seguir.textContent = deCantinho ? "Voltar ao cantinho" : "Continuar";
  el.pular.textContent = deCantinho ? "Voltar ao cantinho" : "Agora não";
  mostrarFormulario();

  await mostrarTela("tela-recado");
  const saida = await esperarClique([[el.seguir, "seguir"], [el.pular, "pular"]]);
  cancelarGravacao();
  el.ouvir.pause();
  atualizar();
  return saida;
}
