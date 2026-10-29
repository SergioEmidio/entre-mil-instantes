// =====================================================================
// Entre Mil Instantes · painel/campo-audio.js
// Campo para enviar um áudio ou gravar a voz, e ouvir o resultado.
// =====================================================================

import { h, novoId, avisar } from "./ui.js";
import { enviarArquivo } from "../supabase.js";
import { novoIdentificador } from "./estado.js";
import { linkDe, linkGuardado, guardarLink } from "./midia.js";
import {
  prepararAudio,
  converterParaWav,
  comecarGravacao,
  podeGravar,
  mensagemDeErroDoAudio,
  MAX_GRAVACAO_SEG,
  LIMITE_MB,
} from "./audio.js";

const minSeg = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

// campoAudio({ rotulo, caminho, duracao, pasta, gravar, aoMudar(caminho, duracao) })
export function campoAudio(opcoes) {
  const { rotulo, pasta = "audio", gravar = true, aoMudar, dica } = opcoes;
  let caminho = opcoes.caminho || null;
  let duracao = opcoes.duracao || null;
  let estado = "parado";        // parado | gravando | preparando | enviando
  let gravacao = null;
  let relogio = null;
  let inicioGravacao = 0;

  const idArquivo = novoId("audio");
  const entrada = h("input", {
    type: "file",
    accept: "audio/*,video/mp4,video/quicktime,.mp3,.m4a,.aac,.wav,.ogg,.opus,.mp4,.mov,.m4v",
    id: idArquivo,
    class: "sr-only",
    onChange: aoEscolherArquivo,
  });

  const tocador = h("audio", { class: "audio-tocador", controls: true, preload: "none" });
  const situacao = h("p", { class: "audio-situacao", "aria-live": "polite" });
  const botaoArquivo = h("label", { class: "botao-pequeno", for: idArquivo, tabindex: "0", role: "button" }, h("span"));
  const botaoGravar = gravar && podeGravar()
    ? h("button", { class: "botao-pequeno botao-gravar", type: "button", onClick: alternarGravacao })
    : null;
  const botaoTirar = h("button", { class: "botao-pequeno botao-pequeno--perigo", type: "button", onClick: tirar }, "Tirar áudio");

  botaoArquivo.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      entrada.click();
    }
  });

  function desenhar() {
    const ocupado = estado !== "parado" && estado !== "gravando";
    botaoArquivo.querySelector("span").textContent = caminho ? "Trocar arquivo" : "Enviar arquivo";
    botaoArquivo.classList.toggle("botao-pequeno--desligado", estado !== "parado");
    if (botaoGravar) {
      botaoGravar.textContent = estado === "gravando" ? "Parar gravação" : caminho ? "Gravar de novo" : "Gravar voz";
      botaoGravar.classList.toggle("botao-gravar--ligado", estado === "gravando");
      botaoGravar.disabled = ocupado;
    }
    botaoTirar.hidden = !caminho || estado !== "parado";

    if (estado === "gravando") {
      const seg = (Date.now() - inicioGravacao) / 1000;
      situacao.textContent = `Gravando · ${minSeg(seg)} de ${minSeg(MAX_GRAVACAO_SEG)}`;
      situacao.dataset.tipo = "gravando";
    } else if (estado === "preparando") {
      situacao.textContent = "Preparando o áudio…";
      situacao.dataset.tipo = "";
    } else if (estado === "enviando") {
      situacao.textContent = "Enviando…";
      situacao.dataset.tipo = "";
    } else if (caminho) {
      situacao.textContent = duracao ? `Áudio pronto · ${minSeg(duracao)}` : "Áudio pronto";
      situacao.dataset.tipo = "pronto";
    } else {
      situacao.textContent = "Sem áudio ainda";
      situacao.dataset.tipo = "";
    }

    tocador.hidden = !caminho || estado !== "parado";
    if (caminho && estado === "parado") {
      const link = linkGuardado("midia", caminho);
      if (link) {
        if (tocador.getAttribute("src") !== link) tocador.setAttribute("src", link);
      } else {
        linkDe("midia", caminho).then((l) => {
          if (l && linkGuardado("midia", caminho)) desenhar();
        });
      }
    }
  }

  async function enviar(preparado) {
    estado = "enviando";
    desenhar();
    const novo = `${pasta}/${novoIdentificador()}.${preparado.extensao}`;
    const guardado = await enviarArquivo("midia", novo, preparado.blob, preparado.tipo);
    guardarLink("midia", guardado, URL.createObjectURL(preparado.blob));
    caminho = guardado;
    duracao = preparado.duracao || null;
    aoMudar(caminho, duracao);
  }

  async function aoEscolherArquivo() {
    const arquivo = entrada.files && entrada.files[0];
    entrada.value = "";
    if (!arquivo || estado !== "parado") return;
    try {
      estado = "preparando";
      desenhar();
      const preparado = await prepararAudio(arquivo);
      await enviar(preparado);
      avisar("Áudio enviado.", "ok");
    } catch (e) {
      if (!e || !e.codigo || e.original) console.error((e && e.original) || e);
      avisar(mensagemDeErroDoAudio(e), "erro", 6000);
    } finally {
      estado = "parado";
      desenhar();
    }
  }

  async function alternarGravacao() {
    if (estado === "gravando") {
      await pararGravacao();
      return;
    }
    if (estado !== "parado") return;
    try {
      gravacao = await comecarGravacao();
    } catch (e) {
      avisar(mensagemDeErroDoAudio(e), "erro", 6000);
      return;
    }
    estado = "gravando";
    inicioGravacao = Date.now();
    relogio = setInterval(() => {
      if ((Date.now() - inicioGravacao) / 1000 >= MAX_GRAVACAO_SEG) pararGravacao();
      else desenhar();
    }, 250);
    desenhar();
  }

  async function pararGravacao() {
    if (estado !== "gravando" || !gravacao) return;
    clearInterval(relogio);
    estado = "preparando";
    desenhar();
    try {
      const bruto = await gravacao.parar();
      gravacao = null;
      const { blob, duracao: d } = await converterParaWav(bruto);
      if (d < 1) throw Object.assign(new Error("audio_vazio"), { codigo: "audio_vazio" });
      if (blob.size > LIMITE_MB * 1024 * 1024) throw Object.assign(new Error("muito_grande"), { codigo: "muito_grande" });
      await enviar({ blob, tipo: "audio/wav", extensao: "wav", duracao: d });
      avisar("Gravação enviada.", "ok");
    } catch (e) {
      if (!e || !e.codigo || e.original) console.error((e && e.original) || e);
      avisar(mensagemDeErroDoAudio(e), "erro", 6000);
    } finally {
      estado = "parado";
      desenhar();
    }
  }

  function tirar() {
    tocador.pause();
    tocador.removeAttribute("src");
    caminho = null;
    duracao = null;
    aoMudar(null, null);
    desenhar();
  }

  desenhar();

  return h(
    "div",
    { class: "audio" },
    h("span", { class: "foto-rotulo" }, rotulo),
    dica ? h("p", { class: "bloco-dica" }, dica) : null,
    situacao,
    tocador,
    h("div", { class: "item-acoes" }, botaoGravar, entrada, botaoArquivo, h("span", { class: "espaco" }), botaoTirar)
  );
}
