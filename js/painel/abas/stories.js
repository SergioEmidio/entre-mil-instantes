// =====================================================================
// Entre Mil Instantes · aba Stories
// Cada story: uma foto em tela cheia + data/lugar + uma frase curta.
// =====================================================================

import { h, campo, icone, confirmar, avisar } from "../ui.js";
import { campoFoto } from "../campo-foto.js";
import { rascunho, alterar, novoIdentificador } from "../estado.js";
import { linkGuardado, linkDe } from "../midia.js";

const MAXIMO = 20;
let abrirId = null;   // story que deve aparecer aberto depois de redesenhar

export function desenharStories(area, redesenhar) {
  const lista = rascunho().stories;

  area.append(
    h(
      "div",
      { class: "area-titulo" },
      h("h2", null, "Stories de memória"),
      h("p", null, `${lista.length} de ${MAXIMO}`)
    ),
    h("p", { class: "area-intro" }, "Aparecem na ordem desta lista. Use as setas para mudar a ordem.")
  );

  const caixa = h("div", { class: "lista" });
  lista.forEach((story, indice) => caixa.append(item(story, indice, lista.length, redesenhar)));
  area.append(caixa);

  area.append(
    h(
      "button",
      {
        class: "botao-adicionar",
        type: "button",
        disabled: lista.length >= MAXIMO,
        onClick: () => {
          const id = novoIdentificador();
          alterar((r) => {
            r.stories.push({ id, foto: null, tag: "", frase: "" });
          });
          abrirId = id;
          redesenhar();
        },
      },
      icone("mais"),
      "Adicionar story"
    )
  );

  if (abrirId) {
    const aberto = area.querySelector(`[data-id="${abrirId}"]`);
    abrirId = null;
    if (aberto) {
      aberto.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function item(story, indice, total, redesenhar) {
  const miniatura = h("div", { class: "item-miniatura" });
  const sobre = h("span", { class: "item-sobre" });
  const principal = h("span", { class: "item-principal" });

  function atualizarResumo() {
    sobre.textContent = story.tag || "Sem data ou lugar";
    principal.textContent = story.frase || "Sem frase ainda";
    principal.classList.toggle("item-principal--vazio", !story.frase);
    miniatura.replaceChildren();
    const link = linkGuardado("midia", story.foto);
    if (link) {
      miniatura.append(h("img", { src: link, alt: "" }));
    } else if (story.foto) {
      linkDe("midia", story.foto).then((l) => {
        if (l) miniatura.replaceChildren(h("img", { src: l, alt: "" }));
      });
    }
  }

  // Muda este story no rascunho (procura pelo id, não pela posição).
  const mudar = (fn) =>
    alterar((r) => {
      const alvo = r.stories.find((s) => s.id === story.id);
      if (alvo) fn(alvo);
    });

  const mover = (passo) => {
    alterar((r) => {
      const de = r.stories.findIndex((s) => s.id === story.id);
      const para = de + passo;
      if (de < 0 || para < 0 || para >= r.stories.length) return;
      const [movido] = r.stories.splice(de, 1);
      r.stories.splice(para, 0, movido);
    });
    abrirId = story.id;
    redesenhar();
  };

  const excluir = async () => {
    const sim = await confirmar("Este story sai do rascunho. Ela só deixa de ver depois que tu publicares.", {
      titulo: "Excluir este story?",
    });
    if (!sim) return;
    alterar((r) => {
      r.stories = r.stories.filter((s) => s.id !== story.id);
    });
    redesenhar();
    avisar("Story excluído.");
  };

  const corpo = h(
    "div",
    { class: "item-corpo" },
    campoFoto({
      rotulo: "Foto (tela cheia, de preferência em pé)",
      caminho: story.foto,
      pasta: "stories",
      alta: true,
      removivel: false,
      aoMudar: (c) => {
        mudar((s) => { s.foto = c; });
        story.foto = c;
        atualizarResumo();
      },
    }),
    campo({
      rotulo: "Data ou lugar (aparece em cima da frase)",
      valor: story.tag,
      max: 40,
      placeholder: "Ex.: Praia de Iracema, jan 2026",
      aoMudar: (v) => {
        mudar((s) => { s.tag = v; });
        story.tag = v;
        atualizarResumo();
      },
    }),
    campo({
      rotulo: "Frase",
      valor: story.frase,
      multilinha: true,
      linhas: 3,
      max: 140,
      aoMudar: (v) => {
        mudar((s) => { s.frase = v; });
        story.frase = v;
        atualizarResumo();
      },
    }),
    h(
      "div",
      { class: "item-acoes" },
      h(
        "button",
        { class: "botao-pequeno", type: "button", disabled: indice === 0, onClick: () => mover(-1), "aria-label": "Subir na ordem" },
        icone("cima", 16),
        "Subir"
      ),
      h(
        "button",
        { class: "botao-pequeno", type: "button", disabled: indice === total - 1, onClick: () => mover(1), "aria-label": "Descer na ordem" },
        icone("baixo", 16),
        "Descer"
      ),
      h("span", { class: "espaco" }),
      h("button", { class: "botao-pequeno botao-pequeno--perigo", type: "button", onClick: excluir }, icone("lixo", 16), "Excluir")
    )
  );

  atualizarResumo();

  return h(
    "details",
    { class: "item", "data-id": story.id, open: story.id === abrirId },
    h(
      "summary",
      { class: "item-resumo" },
      h("span", { class: "item-numero" }, String(indice + 1)),
      miniatura,
      h("span", { class: "item-textos" }, sobre, principal),
      h("span", { class: "item-seta" }, icone("seta", 18))
    ),
    corpo
  );
}
