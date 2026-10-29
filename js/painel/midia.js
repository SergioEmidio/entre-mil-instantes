// =====================================================================
// Entre Mil Instantes · painel/midia.js
// Fotos: diminui no próprio celular/computador antes de enviar
// (fica leve e carrega rápido para ela), envia e mostra no painel.
// =====================================================================

import { enviarArquivo, linksDosArquivos } from "../supabase.js";
import { novoIdentificador } from "./estado.js";

const LADO_MAXIMO = 1600;   // maior lado da foto, em pixels
const QUALIDADE = 0.82;
const LIMITE_ORIGINAL = 40 * 1024 * 1024;  // 40 MB

// ---------------------------------------------------------------------
// Diminuir a foto
// ---------------------------------------------------------------------
function carregarComoImagem(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error("formato_nao_suportado"));
    };
    img.src = url;
  });
}

async function abrirImagem(arquivo) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      /* alguns navegadores não aceitam a opção: tenta do jeito simples */
    }
  }
  return carregarComoImagem(arquivo);
}

function canvasParaArquivo(canvas, tipo, qualidade) {
  return new Promise((resolver) => canvas.toBlob(resolver, tipo, qualidade));
}

export async function diminuirFoto(arquivo, lado = LADO_MAXIMO) {
  if (!arquivo || !arquivo.type || !arquivo.type.startsWith("image/")) {
    throw new Error("nao_e_imagem");
  }
  if (arquivo.size > LIMITE_ORIGINAL) {
    throw new Error("muito_grande");
  }

  const imagem = await abrirImagem(arquivo);
  const largura = imagem.width || imagem.naturalWidth;
  const altura = imagem.height || imagem.naturalHeight;
  if (!largura || !altura) throw new Error("formato_nao_suportado");

  const escala = Math.min(1, lado / Math.max(largura, altura));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  if (typeof imagem.close === "function") imagem.close();

  // WebP é o mais leve; se o navegador não souber criar, usa JPEG.
  let resultado = await canvasParaArquivo(canvas, "image/webp", QUALIDADE);
  if (!resultado || resultado.type !== "image/webp") {
    resultado = await canvasParaArquivo(canvas, "image/jpeg", QUALIDADE);
  }
  if (!resultado) throw new Error("formato_nao_suportado");
  return resultado;
}

// ---------------------------------------------------------------------
// Links para mostrar as fotos (os arquivos são privados)
// ---------------------------------------------------------------------
const links = new Map();   // "balde:caminho" → link

const chave = (balde, caminho) => `${balde}:${caminho}`;

export function linkGuardado(balde, caminho) {
  return caminho ? links.get(chave(balde, caminho)) || null : null;
}

// Busca de uma vez os links de vários arquivos.
export async function prepararLinks(balde, caminhos) {
  const faltando = [...new Set(caminhos.filter((c) => c && !links.has(chave(balde, c))))];
  if (!faltando.length) return;
  try {
    const mapa = await linksDosArquivos(balde, faltando, 60 * 60 * 12);
    for (const [caminho, link] of Object.entries(mapa)) {
      links.set(chave(balde, caminho), link);
    }
  } catch (erro) {
    console.error(erro.original || erro);
  }
}

// Guarda um link já conhecido (ex.: o arquivo que acabou de ser enviado).
export function guardarLink(balde, caminho, link) {
  if (caminho && link) links.set(chave(balde, caminho), link);
}

export async function linkDe(balde, caminho) {
  if (!caminho) return null;
  if (!links.has(chave(balde, caminho))) await prepararLinks(balde, [caminho]);
  return linkGuardado(balde, caminho);
}

// ---------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------
// Diminui, envia e devolve o caminho onde a foto ficou guardada.
export async function enviarFoto(arquivo, balde, pasta) {
  const leve = await diminuirFoto(arquivo);
  const extensao = leve.type === "image/webp" ? "webp" : "jpg";
  const caminho = `${pasta}/${novoIdentificador()}.${extensao}`;
  const guardado = await enviarArquivo(balde, caminho, leve, leve.type);
  // Mostra na hora, sem esperar o link do servidor.
  links.set(chave(balde, guardado), URL.createObjectURL(leve));
  return guardado;
}

// Texto amigável para cada problema.
export function mensagemDeErroDaFoto(erro) {
  const codigo = (erro && (erro.codigo || erro.message)) || "";
  if (codigo === "nao_e_imagem") return "Esse arquivo não é uma foto.";
  if (codigo === "muito_grande") return "Foto grande demais (mais de 40 MB).";
  if (codigo === "formato_nao_suportado") {
    return "Este navegador não abre esse formato de foto. Tenta outra (JPG ou PNG) ou envia pelo celular.";
  }
  if (codigo === "rede") return "Sem conexão. A foto não foi enviada.";
  return "Não consegui enviar a foto. Tenta de novo.";
}
