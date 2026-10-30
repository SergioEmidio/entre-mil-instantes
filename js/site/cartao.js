// =====================================================================
// Entre Mil Instantes · site/cartao.js
// Tela 16: um cartão no tamanho do story (1080 × 1920) com a foto de
// vocês e os dias juntos. Ela escolhe o estilo e baixa a imagem.
// =====================================================================

import { texto, esperarClique } from "./dom.js";
import { diasDesde, lerDataISO, hojeEmBrasilia } from "./datas.js";
import { linkDaFoto } from "./fotos.js";
import { mostrarTela } from "./telas.js";

const L = 1080;
const A = 1920;

const ESTILOS = [
  { nome: "Noite", fundo: "#10182b", tinta: "#f2e8d8", destaque: "#e8d3a2", suave: "#b9b2a6", foto: "#1b2540", estrelas: true },
  { nome: "Vinho", fundo: "#462c3a", tinta: "#f2e8d8", destaque: "#e8d3a2", suave: "#d9c9c0", foto: "#5c3a4c", estrelas: true },
  { nome: "Champanhe", fundo: "#e8d3a2", tinta: "#10182b", destaque: "#462c3a", suave: "#5a4a3e", foto: "#d6be88", estrelas: false },
];

const el = {};
let ligado = false;
let estilo = 0;
let imagem = null;          // foto já carregada (ImageBitmap ou <img>)
let caminhoDaImagem = null;
let dados = null;

const dois = (n) => String(n).padStart(2, "0");

function pegar() {
  if (ligado) return;
  ligado = true;
  el.canvas = document.getElementById("cartao-canvas");
  el.baixar = document.getElementById("cartao-baixar");
  el.baixarTexto = document.getElementById("cartao-baixar-texto");
  el.seguir = document.getElementById("cartao-seguir");
  el.estilos = [...document.querySelectorAll(".cartao-estilo")];

  el.estilos.forEach((botao) => {
    const i = Number(botao.dataset.estilo);
    botao.style.background = ESTILOS[i].fundo;
    botao.addEventListener("click", () => escolherEstilo(i));
    botao.addEventListener("keydown", (evento) => {
      if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
        evento.preventDefault();
        const passo = evento.key === "ArrowRight" ? 1 : -1;
        const novo = (estilo + passo + ESTILOS.length) % ESTILOS.length;
        escolherEstilo(novo);
        el.estilos[novo].focus();
      }
    });
  });
  el.baixar.addEventListener("click", baixar);
}

function escolherEstilo(i) {
  estilo = i;
  el.estilos.forEach((b, k) => {
    b.setAttribute("aria-checked", String(k === i));
    b.tabIndex = k === i ? 0 : -1;
  });
  el.baixarTexto.textContent = "Baixar imagem";
  desenhar();
}

// ---------------------------------------------------------------------
// Foto: baixa a imagem como arquivo (assim o cartão pode virar PNG)
// ---------------------------------------------------------------------
function fotoDoCartao(conteudo) {
  const c = conteudo || {};
  if (c.cartao && c.cartao.foto) return c.cartao.foto;
  const stories = Array.isArray(c.stories) ? c.stories : [];
  const comFoto = stories.find((s) => s && s.foto);
  if (comFoto) return comFoto.foto;
  return (c.antes_agora && c.antes_agora.agora) || null;
}

async function carregarFoto(caminho) {
  const link = linkDaFoto(caminho);
  if (!link) return null;
  try {
    const resposta = await fetch(link, { mode: "cors", credentials: "omit" });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const blob = await resposta.blob();
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(blob);
      } catch {
        /* tenta do jeito simples */
      }
    }
    const url = URL.createObjectURL(blob);
    return await new Promise((resolver) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => resolver(null);
      img.src = url;
    });
  } catch (erro) {
    console.error("[Entre Mil Instantes] Não consegui usar a foto no cartão:", erro);
    return null;
  }
}

async function esperarFontes() {
  if (!document.fonts || !document.fonts.load) return;
  const pedidos = [
    '600 120px "Cormorant Garamond"',
    'italic 500 80px "Cormorant Garamond"',
    '500 40px "DM Sans"',
  ].map((f) => document.fonts.load(f).catch(() => null));
  await Promise.race([Promise.all(pedidos), new Promise((r) => setTimeout(r, 2500))]);
}

// ---------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------
function textoEspacado(ctx, frase, x, y, espaco) {
  // letter-spacing feito à mão (funciona em todos os navegadores)
  const larguras = [...frase].map((letra) => ctx.measureText(letra).width);
  const total = larguras.reduce((a, b) => a + b, 0) + espaco * (frase.length - 1);
  let cursor = x - total / 2;
  ctx.textAlign = "left";
  [...frase].forEach((letra, i) => {
    ctx.fillText(letra, cursor, y);
    cursor += larguras[i] + espaco;
  });
  ctx.textAlign = "center";
}

function caberFonte(ctx, frase, fonte, tamanho, larguraMaxima) {
  let t = tamanho;
  ctx.font = fonte(t);
  while (ctx.measureText(frase).width > larguraMaxima && t > 20) {
    t -= 2;
    ctx.font = fonte(t);
  }
  return t;
}

function desenhar() {
  if (!dados) return;
  const e = ESTILOS[estilo];
  const ctx = el.canvas.getContext("2d");
  ctx.save();
  ctx.clearRect(0, 0, L, A);
  ctx.fillStyle = e.fundo;
  ctx.fillRect(0, 0, L, A);

  // estrelinhas
  if (e.estrelas) {
    let semente = 7351297;
    const aleatorio = () => {
      semente = (semente * 16807) % 2147483647;
      return (semente - 1) / 2147483646;
    };
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.2 + aleatorio() * 0.5;
      ctx.fillStyle = e.tinta;
      ctx.beginPath();
      ctx.arc(aleatorio() * L, aleatorio() * A, 2 + aleatorio() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // moldura fina
  ctx.strokeStyle = e.destaque;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  const m = 56;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(m, m, L - m * 2, A - m * 2, 36);
  else ctx.rect(m, m, L - m * 2, A - m * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // data do topo
  ctx.fillStyle = e.destaque;
  ctx.font = '500 40px "DM Sans", system-ui, sans-serif';
  textoEspacado(ctx, dados.dataTopo, L / 2, 210, 11);

  // foto redonda
  const cx = L / 2;
  const cy = 700;
  const r = 330;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = e.foto;
  ctx.fill();
  ctx.clip();
  if (imagem) {
    const lw = imagem.width;
    const lh = imagem.height;
    const escala = Math.max((r * 2) / lw, (r * 2) / lh);
    const w = lw * escala;
    const hgt = lh * escala;
    ctx.drawImage(imagem, cx - w / 2, cy - hgt / 2, w, hgt);
  } else {
    ctx.fillStyle = e.destaque;
    ctx.font = 'italic 500 120px "Cormorant Garamond", Georgia, serif';
    ctx.textBaseline = "middle";
    ctx.fillText(dados.iniciais, cx, cy);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  ctx.strokeStyle = e.destaque;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
  ctx.stroke();

  // número de dias
  ctx.fillStyle = e.destaque;
  const tamanhoNumero = caberFonte(ctx, dados.dias, (t) => `600 ${t}px "Cormorant Garamond", Georgia, serif`, 300, L - 200);
  ctx.font = `600 ${tamanhoNumero}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillText(dados.dias, L / 2, 1420);

  ctx.fillStyle = e.tinta;
  ctx.font = 'italic 500 92px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(dados.legenda, L / 2, 1540);

  // nomes
  ctx.fillStyle = e.suave;
  const tamanhoNomes = caberFonte(ctx, dados.rodape, (t) => `500 ${t}px "DM Sans", system-ui, sans-serif`, 44, L - 220);
  ctx.font = `500 ${tamanhoNomes}px "DM Sans", system-ui, sans-serif`;
  ctx.fillText(dados.rodape, L / 2, 1740);

  ctx.restore();
}

// ---------------------------------------------------------------------
// Baixar
// ---------------------------------------------------------------------
function paraArquivo() {
  return new Promise((resolver) => el.canvas.toBlob(resolver, "image/png"));
}

function toqueNaTela() {
  return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

async function baixar() {
  el.baixar.disabled = true;
  try {
    const blob = await paraArquivo();
    if (!blob) throw new Error("sem_imagem");
    const nome = `entre-mil-instantes-${dados.dias}-dias.png`;

    // No celular, abre o "compartilhar" (dá para salvar na galeria ou postar direto).
    if (toqueNaTela() && navigator.canShare && typeof File === "function") {
      const arquivo = new File([blob], nome, { type: "image/png" });
      if (navigator.canShare({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], title: "Entre Mil Instantes" });
          el.baixarTexto.textContent = "Pronto";
          return;
        } catch (erro) {
          if (erro && erro.name === "AbortError") return;   // ela fechou: tudo bem
        }
      }
    }

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    el.baixarTexto.textContent = "Imagem baixada";
  } catch (erro) {
    console.error("[Entre Mil Instantes] Não consegui criar a imagem:", erro);
    el.baixarTexto.textContent = "Não deu. Tenta de novo";
  } finally {
    el.baixar.disabled = false;
  }
}

// ---------------------------------------------------------------------
export async function tocarCartao(conteudo) {
  pegar();
  const c = conteudo || {};
  const nome = texto(c.nome) || "Nós";
  const autor = texto(c.autor);
  const conhecemos = c.datas && c.datas.conhecemos;
  const inicio = lerDataISO(conhecemos);
  const hoje = hojeEmBrasilia();
  const dias = inicio ? diasDesde(conhecemos) : null;

  dados = {
    dataTopo: `${dois(hoje.dia)} · ${dois(hoje.mes)} · ${hoje.ano}`,
    dias: dias == null ? "∞" : String(dias),
    legenda: dias === 1 ? "dia de nós" : "dias de nós",
    rodape: [autor ? `${nome} & ${autor}` : nome, inicio ? `desde ${dois(inicio.dia)}·${dois(inicio.mes)}·${inicio.ano}` : ""]
      .filter(Boolean)
      .join(" · "),
    iniciais: autor ? `${nome[0]} & ${autor[0]}` : nome[0],
  };

  el.baixarTexto.textContent = "Baixar imagem";
  escolherEstilo(estilo);   // desenha já (sem foto) para não ficar vazio

  const saida = esperarClique([[el.seguir, "cantinho"]]);
  await mostrarTela("tela-cartao");

  const caminho = fotoDoCartao(c);
  await esperarFontes();
  if (caminho !== caminhoDaImagem || !imagem) {
    const nova = caminho ? await carregarFoto(caminho) : null;
    imagem = nova;
    caminhoDaImagem = nova ? caminho : null;
  }
  desenhar();

  return saida;
}
