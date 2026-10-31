// =====================================================================
// Entre Mil Instantes · painel/campo-midia.js
// Campo do story: FOTO ou VÍDEO.
//  · foto: diminui e envia (igual ao campo de foto)
//  · vídeo: confere tamanho (até 15 MB), duração (até 60 s) e se toca
//    no navegador; tira um quadro do vídeo para ser a capa; envia os dois.
// =====================================================================

import { h, icone, novoId, avisar } from "./ui.js";
import { enviarFoto, linkDe, linkGuardado, guardarLink, mensagemDeErroDaFoto } from "./midia.js";
import { enviarArquivo } from "../supabase.js";
import { novoIdentificador } from "./estado.js";

export const VIDEO_LIMITE_MB = 15;
export const VIDEO_MAX_SEG = 60;

const TIPOS_VIDEO = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };
const EXT_VIDEO = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4" };

const minSeg = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function erro(codigo) {
  return Object.assign(new Error(codigo), { codigo });
}

function tipoDoVideo(arquivo) {
  const tipo = (arquivo.type || "").split(";")[0].toLowerCase();
  if (TIPOS_VIDEO[tipo]) return { tipo, extensao: TIPOS_VIDEO[tipo] };
  const m = /\.([a-z0-9]+)$/i.exec(arquivo.name || "");
  const ext = m ? m[1].toLowerCase() : "";
  if (EXT_VIDEO[ext]) return { tipo: EXT_VIDEO[ext], extensao: ext };
  return null;
}

// Abre o vídeo, confere se toca e tira um quadro para a capa.
function lerVideo(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let terminou = false;
    const fim = (fn, valor) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(limite);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      fn(valor);
    };
    const limite = setTimeout(() => fim(rejeitar, erro("video_nao_abre")), 15000);
    video.onerror = () => fim(rejeitar, erro("video_nao_abre"));
    video.onloadedmetadata = () => {
      const duracao = video.duration;
      if (!Number.isFinite(duracao) || duracao <= 0) {
        fim(rejeitar, erro("video_nao_abre"));
        return;
      }
      if (!video.videoWidth || !video.videoHeight) {
        fim(rejeitar, erro("video_sem_imagem"));
        return;
      }
      video.currentTime = Math.min(0.6, duracao / 2);
    };
    video.onseeked = () => {
      try {
        const lado = 1080;
        const escala = Math.min(1, lado / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
        canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        const duracao = video.duration;
        canvas.toBlob(
          (capa) => {
            if (!capa) {
              fim(rejeitar, erro("video_nao_abre"));
              return;
            }
            fim(resolver, { duracao, capa });
          },
          "image/jpeg",
          0.84
        );
      } catch (e) {
        fim(rejeitar, erro("video_nao_abre"));
      }
    };
    video.src = url;
  });
}

export function mensagemDeErroDoVideo(e) {
  const codigo = (e && (e.codigo || e.message)) || "";
  if (codigo === "video_grande") {
    return `Vídeo grande demais (máximo ${VIDEO_LIMITE_MB} MB). Corta para uns 30 segundos ou me manda que eu diminuo.`;
  }
  if (codigo === "video_longo") return `Vídeo longo demais (máximo ${VIDEO_MAX_SEG} segundos). Corta um trecho menor.`;
  if (codigo === "video_nao_abre") {
    return "Este vídeo não abre no navegador (pode ser o formato HEVC do iPhone). Tenta enviar em MP4 ou por outro celular.";
  }
  if (codigo === "video_sem_imagem") return "Esse arquivo parece ser só áudio. Para música, usa a aba Rádio.";
  if (codigo === "rede") return "Sem conexão. O vídeo não foi enviado.";
  return "Não consegui enviar o vídeo. Tenta de novo.";
}

// campoMidia({ rotulo, foto, video, duracao, pasta, aoMudar({ foto, video, duracao }) })
export function campoMidia(opcoes) {
  const { rotulo, pasta = "stories", aoMudar } = opcoes;
  let foto = opcoes.foto || null;
  let video = opcoes.video || null;
  let duracao = opcoes.duracao || null;
  let enviando = "";

  const idEntrada = novoId("midia");
  const previa = h("div", { class: "foto-previa foto-previa--alta", "data-enviando": "false" });
  const situacao = h("p", { class: "midia-situacao", "aria-live": "polite" });
  const entrada = h("input", {
    type: "file",
    accept: "image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm",
    id: idEntrada,
    class: "sr-only",
    onChange: aoEscolher,
  });
  const botaoEscolher = h("label", { class: "botao-pequeno", for: idEntrada, tabindex: "0", role: "button" }, icone("foto", 16), h("span"));
  botaoEscolher.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      entrada.click();
    }
  });

  function desenhar() {
    previa.dataset.enviando = String(Boolean(enviando));
    previa.replaceChildren();
    const link = linkGuardado("midia", foto);
    if (foto && link) {
      previa.append(h("img", { src: link, alt: "" }));
      if (video) previa.append(h("span", { class: "midia-selo", "aria-label": `Vídeo de ${minSeg(duracao)}` }, `▶ ${minSeg(duracao)}`));
    } else if (foto) {
      previa.append(document.createTextNode("…"));
      linkDe("midia", foto).then(() => {
        if (linkGuardado("midia", foto)) desenhar();
      });
    } else {
      previa.append(document.createTextNode("Sem foto ou vídeo"));
    }
    botaoEscolher.querySelector("span").textContent = foto ? "Trocar foto ou vídeo" : "Escolher foto ou vídeo";
    botaoEscolher.classList.toggle("botao-pequeno--desligado", Boolean(enviando));
    situacao.textContent = enviando
      ? enviando
      : video
        ? `Vídeo com som · ${minSeg(duracao)}. Ele toca inteiro no story.`
        : "Foto ou vídeo curto (até 60 s e 15 MB).";
  }

  async function enviarVideo(arquivo, info) {
    if (arquivo.size > VIDEO_LIMITE_MB * 1024 * 1024) throw erro("video_grande");
    enviando = "Conferindo o vídeo…";
    desenhar();
    const { duracao: d, capa } = await lerVideo(arquivo);
    if (d > VIDEO_MAX_SEG + 0.5) throw erro("video_longo");

    enviando = "Enviando o vídeo…";
    desenhar();
    const nome = novoIdentificador();
    const caminhoCapa = await enviarArquivo("midia", `${pasta}/${nome}-capa.jpg`, capa, "image/jpeg");
    guardarLink("midia", caminhoCapa, URL.createObjectURL(capa));
    const caminhoVideo = await enviarArquivo("midia", `${pasta}/${nome}.${info.extensao}`, arquivo, info.tipo);
    guardarLink("midia", caminhoVideo, URL.createObjectURL(arquivo));
    return { foto: caminhoCapa, video: caminhoVideo, duracao: Math.round(d) };
  }

  async function aoEscolher() {
    const arquivo = entrada.files && entrada.files[0];
    entrada.value = "";
    if (!arquivo || enviando) return;
    const info = tipoDoVideo(arquivo);
    try {
      if (info) {
        const novo = await enviarVideo(arquivo, info);
        foto = novo.foto;
        video = novo.video;
        duracao = novo.duracao;
        avisar("Vídeo enviado.", "ok");
      } else {
        enviando = "Enviando a foto…";
        desenhar();
        foto = await enviarFoto(arquivo, "midia", pasta);
        video = null;
        duracao = null;
      }
      aoMudar({ foto, video, duracao });
    } catch (e) {
      if (!e || !e.codigo) console.error((e && e.original) || e);
      avisar(info ? mensagemDeErroDoVideo(e) : mensagemDeErroDaFoto(e), "erro", 7000);
    } finally {
      enviando = "";
      desenhar();
    }
  }

  desenhar();

  return h(
    "div",
    { class: "foto" },
    previa,
    h("div", { class: "foto-acoes" }, h("span", { class: "foto-rotulo" }, rotulo), situacao, entrada, botaoEscolher)
  );
}
