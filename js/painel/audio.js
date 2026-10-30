// =====================================================================
// Entre Mil Instantes · painel/audio.js
// Áudios: gravar a tua voz e preparar arquivos para tocarem em
// QUALQUER celular (iPhone e Android).
//
//  · MP3, M4A, AAC e WAV já tocam em todo lugar → vão como estão.
//  · Gravação do microfone e formatos como OGG/OPUS (áudio do WhatsApp)
//    são convertidos para WAV aqui mesmo, antes de enviar.
// =====================================================================

const TAXA_MINIMA = 22050;            // qualidade boa para voz, arquivo leve
const TAXAS = [44100, 32000, 22050];  // tenta a melhor que caiba no limite
export const LIMITE_MB = 15;          // limite do armazenamento por arquivo
export const MAX_GRAVACAO_SEG = 180;  // 3 minutos por gravação

const UNIVERSAIS = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/x-aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

const EXTENSOES = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav" };

// Vídeos (.mp4/.mov): o <audio> toca o som deles direto.
const VIDEOS = ["video/mp4", "video/quicktime", "video/x-m4v"];
const EXTENSOES_VIDEO = ["mp4", "mov", "m4v"];

function erro(codigo) {
  const e = new Error(codigo);
  e.codigo = codigo;
  return e;
}

function extensaoDoNome(nome) {
  const m = /\.([a-z0-9]+)$/i.exec(nome || "");
  return m ? m[1].toLowerCase() : "";
}

// Duração (segundos) lendo o arquivo num <audio>. Pode devolver null.
export function duracaoDe(arquivo) {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(arquivo);
    const audio = new Audio();
    let terminou = false;
    const fim = (valor) => {
      if (terminou) return;
      terminou = true;
      URL.revokeObjectURL(url);
      resolver(valor);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => fim(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => fim(null);
    setTimeout(() => fim(null), 6000);
    audio.src = url;
  });
}

// ---------------------------------------------------------------------
// Converter para WAV (mono, 22 kHz, 16 bits)
// ---------------------------------------------------------------------
function criarContexto() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) throw erro("sem_suporte_audio");
  return new Contexto();
}

function decodificar(contexto, dados) {
  return new Promise((resolver, rejeitar) => {
    // Safari antigo só aceita o jeito com callbacks.
    const promessa = contexto.decodeAudioData(dados, resolver, () => rejeitar(erro("formato_nao_suportado")));
    if (promessa && typeof promessa.then === "function") promessa.then(resolver, () => rejeitar(erro("formato_nao_suportado")));
  });
}

// Escolhe a melhor qualidade em que o arquivo ainda cabe no limite.
function escolherTaxa(duracao, taxaMaxima = TAXAS[0]) {
  const maximo = LIMITE_MB * 1024 * 1024 - 1024;
  for (const taxa of TAXAS) if (taxa <= taxaMaxima && duracao * taxa * 2 <= maximo) return taxa;
  return TAXA_MINIMA;
}

async function paraMono(buffer, taxa) {
  const duracao = Math.min(buffer.duration, 60 * 10);
  const amostras = Math.max(1, Math.ceil(duracao * taxa));
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offline = new Offline(1, amostras, taxa);
  const fonte = offline.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(offline.destination);
  fonte.start(0);
  const pronto = await offline.startRendering();
  return pronto.getChannelData(0);
}

function montarWav(amostras, taxa) {
  const bytes = amostras.length * 2;
  const vista = new DataView(new ArrayBuffer(44 + bytes));
  const escrever = (pos, texto) => {
    for (let i = 0; i < texto.length; i++) vista.setUint8(pos + i, texto.charCodeAt(i));
  };
  escrever(0, "RIFF");
  vista.setUint32(4, 36 + bytes, true);
  escrever(8, "WAVE");
  escrever(12, "fmt ");
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);            // PCM
  vista.setUint16(22, 1, true);            // mono
  vista.setUint32(24, taxa, true);
  vista.setUint32(28, taxa * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  escrever(36, "data");
  vista.setUint32(40, bytes, true);

  // Ajusta o volume: a parte mais alta fica em ~90% (gravação baixa fica audível).
  let pico = 0;
  for (let i = 0; i < amostras.length; i++) pico = Math.max(pico, Math.abs(amostras[i]));
  const ganho = pico > 0.02 ? Math.min(4, 0.9 / pico) : 1;

  let pos = 44;
  for (let i = 0; i < amostras.length; i++) {
    const v = Math.max(-1, Math.min(1, amostras[i] * ganho));
    vista.setInt16(pos, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    pos += 2;
  }
  return new Blob([vista], { type: "audio/wav" });
}

// voz: true → qualidade de voz (arquivo bem mais leve). Música usa a melhor que couber.
export async function converterParaWav(arquivo, { voz = false } = {}) {
  const contexto = criarContexto();
  try {
    const dados = await arquivo.arrayBuffer();
    const buffer = await decodificar(contexto, dados);
    if (!buffer || !buffer.duration) throw erro("audio_vazio");
    const taxa = escolherTaxa(Math.min(buffer.duration, 60 * 10), voz ? TAXA_MINIMA : TAXAS[0]);
    const amostras = await paraMono(buffer, taxa);
    return { blob: montarWav(amostras, taxa), duracao: Math.round(amostras.length / taxa) };
  } finally {
    if (typeof contexto.close === "function") contexto.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------
// Preparar qualquer áudio para enviar
// Devolve { blob, tipo, extensao, duracao }
// ---------------------------------------------------------------------
export async function prepararAudio(arquivo) {
  if (!arquivo || !arquivo.size) throw erro("audio_vazio");

  const extensao = extensaoDoNome(arquivo.name);
  let tipo = (arquivo.type || "").split(";")[0].toLowerCase();
  if (!UNIVERSAIS[tipo] && EXTENSOES[extensao]) tipo = EXTENSOES[extensao];

  if (UNIVERSAIS[tipo]) {
    if (arquivo.size > LIMITE_MB * 1024 * 1024) throw erro("muito_grande");
    return { blob: arquivo, tipo, extensao: UNIVERSAIS[tipo], duracao: await duracaoDe(arquivo) };
  }

  // Vídeo .mp4/.mov: se couber, vai como está (mantém a qualidade do som).
  const ehVideo = VIDEOS.indexOf(tipo) >= 0 || EXTENSOES_VIDEO.indexOf(extensao) >= 0;
  if (ehVideo && arquivo.size <= LIMITE_MB * 1024 * 1024) {
    const duracao = await duracaoDe(arquivo);
    if (duracao) return { blob: arquivo, tipo: "audio/mp4", extensao: "m4a", duracao };
  }

  if (!tipo.startsWith("audio/") && !tipo.startsWith("video/") && !ehVideo && !["ogg", "opus", "oga", "webm", "weba", "amr", "3gp", "flac"].includes(extensao)) {
    throw erro("nao_e_audio");
  }

  const { blob, duracao } = await converterParaWav(arquivo);
  if (blob.size > LIMITE_MB * 1024 * 1024) throw erro("muito_grande");
  return { blob, tipo: "audio/wav", extensao: "wav", duracao };
}

// ---------------------------------------------------------------------
// Gravar pelo microfone
// ---------------------------------------------------------------------
export function podeGravar() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

function melhorFormatoDeGravacao() {
  const opcoes = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const tipo of opcoes) {
    try {
      if (MediaRecorder.isTypeSupported(tipo)) return tipo;
    } catch {
      /* segue */
    }
  }
  return "";
}

// Começa a gravar. Devolve { parar(): Promise<Blob>, cancelar() }.
export async function comecarGravacao() {
  if (!podeGravar()) throw erro("sem_microfone");
  let fluxo;
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    throw erro(e && e.name === "NotAllowedError" ? "microfone_negado" : "sem_microfone");
  }

  const tipo = melhorFormatoDeGravacao();
  const gravador = tipo ? new MediaRecorder(fluxo, { mimeType: tipo }) : new MediaRecorder(fluxo);
  const pedacos = [];
  gravador.ondataavailable = (evento) => {
    if (evento.data && evento.data.size) pedacos.push(evento.data);
  };

  const desligar = () => fluxo.getTracks().forEach((t) => t.stop());
  const terminou = new Promise((resolver) => {
    gravador.onstop = () => {
      desligar();
      resolver(new Blob(pedacos, { type: gravador.mimeType || tipo || "audio/webm" }));
    };
  });

  gravador.start(250);

  return {
    parar() {
      if (gravador.state !== "inactive") gravador.stop();
      return terminou;
    },
    cancelar() {
      try {
        if (gravador.state !== "inactive") gravador.stop();
      } catch {
        /* ok */
      }
      desligar();
    },
  };
}

// Mensagens amigáveis
export function mensagemDeErroDoAudio(e) {
  const codigo = (e && (e.codigo || e.message)) || "";
  if (codigo === "nao_e_audio") return "Esse arquivo não é um áudio.";
  if (codigo === "muito_grande") return `Áudio grande demais (máximo ${LIMITE_MB} MB). Corta um trecho menor.`;
  if (codigo === "formato_nao_suportado") return "Este navegador não abre esse formato. Converte para MP3 e envia de novo.";
  if (codigo === "audio_vazio") return "O áudio está vazio.";
  if (codigo === "microfone_negado") return "O microfone foi bloqueado. Libera nas permissões do navegador e tenta de novo.";
  if (codigo === "sem_microfone") return "Não encontrei um microfone neste aparelho.";
  if (codigo === "sem_suporte_audio") return "Este navegador não consegue preparar o áudio. Tenta pelo Chrome ou Safari.";
  if (codigo === "rede") return "Sem conexão. O áudio não foi enviado.";
  return "Não consegui enviar o áudio. Tenta de novo.";
}
