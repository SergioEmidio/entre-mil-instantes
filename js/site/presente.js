// =====================================================================
// Entre Mil Instantes · site/presente.js
// Tela 11: a caixa. Só quando ela toca é que o presente sai do banco
// (antes disso, nem olhando o código dá para descobrir).
// =====================================================================

import { texto, vibrar, esperarClique } from "./dom.js";
import { soltarConfete } from "./confete.js";
import { ehPrevia, guardarMemoria } from "./memoria.js";
import { abrirPresente, previaPresente, linkDoArquivo } from "../supabase.js";
import { esperar, mostrarTela } from "./telas.js";

const el = {};
let ligado = false;
let abrindo = false;
let aoAbrir = null;

function pegar() {
  if (ligado) return;
  ligado = true;
  for (const id of ["titulo", "caixa", "dica", "fechado", "aberto", "foto", "nome", "frase", "seguir", "confete"]) {
    el[id] = document.getElementById(`presente-${id}`);
  }
  el.caixa.addEventListener("click", () => {
    if (aoAbrir) aoAbrir();
  });
}

// O presente só aparece se tiver algo preenchido no painel.
export function temPresente(conteudo) {
  return Boolean(conteudo && conteudo.presente_tem);
}

// Carrega a foto antes de mostrar (no máximo 5 s de espera).
function carregarImagem(link) {
  return new Promise((resolver) => {
    const img = new Image();
    img.decoding = "async";
    const fim = (ok) => resolver(ok ? img : null);
    img.onload = () => fim(true);
    img.onerror = () => fim(false);
    setTimeout(() => fim(img.complete && img.naturalWidth > 0), 5000);
    img.src = link;
  });
}

async function buscarPresente() {
  const dados = ehPrevia() ? await previaPresente() : await abrirPresente();
  let imagem = null;
  if (dados.foto && !dados.esconder_foto) {
    try {
      const link = await linkDoArquivo("presente", dados.foto, 60 * 60 * 12);
      if (link) imagem = await carregarImagem(link);
    } catch (erro) {
      console.error("[Entre Mil Instantes] Não consegui pegar a foto do presente:", (erro && erro.original) || erro);
    }
  }
  return { dados, imagem };
}

function mostrarFechado(conteudo) {
  const frase = texto(conteudo && conteudo.presente && conteudo.presente.frase_caixa);
  el.titulo.textContent = frase || "Hoje eu não queria só te dizer. Queria te dar algo.";
  el.fechado.hidden = false;
  el.aberto.hidden = true;
  el.caixa.classList.remove("caixa--abrindo");
  el.caixa.disabled = false;
  el.dica.textContent = "Toca na caixa";
  el.dica.classList.remove("presente-dica--erro");
}

function mostrarAberto({ dados, imagem }) {
  el.nome.textContent = texto(dados.nome) || "Uma surpresa";
  const frase = texto(dados.frase);
  el.frase.textContent = frase;
  el.frase.hidden = !frase;

  el.foto.replaceChildren();
  if (imagem) {
    imagem.alt = texto(dados.nome) || "O teu presente";
    el.foto.append(imagem);
    el.foto.hidden = false;
  } else {
    el.foto.hidden = true;
  }

  el.fechado.hidden = true;
  el.aberto.hidden = false;
  el.aberto.classList.remove("presente-aberto--entrando");
  void el.aberto.offsetWidth;
  el.aberto.classList.add("presente-aberto--entrando");
  el.nome.focus({ preventScroll: true });
}

// Mostra a caixa e espera ela abrir e tocar em "Ainda tem mais".
export async function tocarPresente(conteudo, { deCantinho = false } = {}) {
  pegar();
  mostrarFechado(conteudo);
  el.seguir.textContent = deCantinho ? "Voltar ao cantinho" : "Ainda tem mais";
  await mostrarTela("tela-presente");

  await new Promise((pronto) => {
    aoAbrir = async () => {
      if (abrindo) return;
      abrindo = true;
      el.caixa.disabled = true;
      el.dica.classList.remove("presente-dica--erro");
      el.dica.textContent = "Abrindo…";
      try {
        const [presente] = await Promise.all([buscarPresente(), esperar(250)]);
        el.caixa.classList.add("caixa--abrindo");
        vibrar([40, 60, 80]);
        soltarConfete(el.confete);
        await esperar(750);
        if (!ehPrevia()) guardarMemoria("presente-aberto", true);
        mostrarAberto(presente);
        aoAbrir = null;
        pronto();
      } catch (erro) {
        console.error("[Entre Mil Instantes] Não consegui abrir o presente:", (erro && erro.original) || erro);
        el.dica.textContent =
          erro && erro.codigo === "rede"
            ? "Sem internet agora. Confere a conexão e toca de novo."
            : "Não consegui abrir agora. Toca de novo.";
        el.dica.classList.add("presente-dica--erro");
        el.caixa.disabled = false;
      } finally {
        abrindo = false;
      }
    };
  });

  await esperarClique([[el.seguir, "seguir"]]);
  return "seguir";
}
