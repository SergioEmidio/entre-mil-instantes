// =====================================================================
// Entre Mil Instantes · painel/campo-foto.js
// Campo para escolher, trocar ou tirar uma foto.
// =====================================================================

import { h, icone, novoId, avisar } from "./ui.js";
import { enviarFoto, linkDe, linkGuardado, mensagemDeErroDaFoto } from "./midia.js";

// campoFoto({ rotulo, caminho, balde, pasta, aoMudar(caminho|null), alta, removivel })
export function campoFoto(opcoes) {
  const { rotulo, balde = "midia", pasta, aoMudar, alta = false, removivel = true } = opcoes;
  let caminho = opcoes.caminho || null;
  let enviando = false;

  const idEntrada = novoId("foto");
  const previa = h("div", {
    class: `foto-previa${alta ? " foto-previa--alta" : ""}`,
    "data-enviando": "false",
  });
  const entrada = h("input", {
    type: "file",
    accept: "image/*",
    id: idEntrada,
    class: "sr-only",
    onChange: aoEscolher,
  });
  const botaoEscolher = h("label", { class: "botao-pequeno", for: idEntrada }, icone("foto", 16), h("span"));
  const botaoTirar = removivel
    ? h("button", { class: "botao-pequeno botao-pequeno--perigo", type: "button", onClick: tirar }, "Tirar foto")
    : null;

  // Teclado: Enter/Espaço no rótulo abre a escolha de arquivo.
  botaoEscolher.tabIndex = 0;
  botaoEscolher.setAttribute("role", "button");
  botaoEscolher.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      entrada.click();
    }
  });

  function desenhar() {
    previa.dataset.enviando = String(enviando);
    previa.replaceChildren();
    const link = linkGuardado(balde, caminho);
    if (caminho && link) {
      previa.append(h("img", { src: link, alt: "" }));
    } else if (caminho) {
      previa.append(document.createTextNode("…"));
      linkDe(balde, caminho).then(() => {
        if (linkGuardado(balde, caminho)) desenhar();
      });
    } else {
      previa.append(document.createTextNode("Sem foto"));
    }
    botaoEscolher.querySelector("span").textContent = caminho ? "Trocar foto" : "Escolher foto";
    botaoEscolher.classList.toggle("botao-pequeno--desligado", enviando);
    if (botaoTirar) botaoTirar.hidden = !caminho || enviando;
  }

  async function aoEscolher() {
    const arquivo = entrada.files && entrada.files[0];
    entrada.value = "";
    if (!arquivo || enviando) return;
    enviando = true;
    desenhar();
    try {
      const novo = await enviarFoto(arquivo, balde, pasta);
      caminho = novo;
      aoMudar(novo);
    } catch (erro) {
      console.error(erro.original || erro);
      avisar(mensagemDeErroDaFoto(erro), "erro", 5000);
    } finally {
      enviando = false;
      desenhar();
    }
  }

  function tirar() {
    caminho = null;
    aoMudar(null);
    desenhar();
  }

  desenhar();

  return h(
    "div",
    { class: "foto" },
    previa,
    h("div", { class: "foto-acoes" }, h("span", { class: "foto-rotulo" }, rotulo), entrada, botaoEscolher, botaoTirar)
  );
}
