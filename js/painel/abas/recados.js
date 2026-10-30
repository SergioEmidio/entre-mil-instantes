// =====================================================================
// Entre Mil Instantes · aba Recados (e a lista dos 365 dias)
// Os recados chegam direto do site dela: não precisam ser publicados.
// =====================================================================

import { h, icone, avisar, confirmar, dataHora } from "../ui.js";
import { rascunho } from "../estado.js";
import {
  lerRecados,
  marcarRecadosLidos,
  apagarRecado,
  linksDosArquivos,
  lerLista,
  adicionarNaLista,
  marcarNaLista,
  apagarDaLista,
  lerCartasAbertas,
} from "../../supabase.js";

const minSeg = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export async function contarNovos() {
  const recados = await lerRecados();
  return recados.filter((r) => !r.lido).length;
}

export function desenharRecados(area) {
  const r = rascunho();
  const nome = r.nome || "ela";

  const caixaRecados = h("div", { class: "recados" }, h("p", { class: "carregando-texto" }, "Carregando os recados…"));
  const caixaLista = h("div", { class: "lista365" }, h("p", { class: "carregando-texto" }, "Carregando a lista…"));
  const caixaCartas = h("div", { class: "recados" }, h("p", { class: "carregando-texto" }, "Carregando…"));

  area.append(
    h("div", { class: "area-titulo" }, h("h2", null, `Recados da ${nome}`)),
    h(
      "p",
      { class: "area-intro" },
      "Aqui aparece o que ela escrever ou gravar no fim do site. Chega direto, sem precisar publicar. Ela não consegue ver nem apagar os recados."
    ),
    caixaRecados,
    h("div", { class: "area-titulo area-titulo--separado" }, h("h2", null, "Cartas que ela abriu")),
    h("p", { class: "area-intro" }, "Cada vez que ela abre uma carta «Abre quando…», aparece aqui com dia e hora. Tu testando não conta."),
    caixaCartas,
    h("div", { class: "area-titulo area-titulo--separado" }, h("h2", null, "Nossos próximos 365 dias")),
    h(
      "p",
      { class: "area-intro" },
      "A lista que vocês dois escrevem. O que tu mudares aqui aparece na hora para ela (não precisa publicar)."
    ),
    caixaLista
  );

  carregarRecados(caixaRecados);
  carregarCartasAbertas(caixaCartas);
  carregarLista(caixaLista);
}

// ---------------------------------------------------------------------
// Cartas que ela abriu
// ---------------------------------------------------------------------
async function carregarCartasAbertas(caixa) {
  let aberturas;
  try {
    aberturas = await lerCartasAbertas();
  } catch (erro) {
    console.error(erro.original || erro);
    caixa.replaceChildren(
      h("p", { class: "aviso-erro" }, "Não consegui carregar. (Rodaste o 06_cartas.sql no Supabase?)"),
      h("button", { class: "botao-pequeno", type: "button", onClick: () => carregarCartasAbertas(caixa) }, "Tentar de novo")
    );
    return;
  }
  if (!aberturas.length) {
    caixa.replaceChildren(h("div", { class: "vazio" }, "Ela ainda não abriu nenhuma carta."));
    return;
  }
  caixa.replaceChildren(
    h(
      "ul",
      { class: "aberturas" },
      ...aberturas.map((a) =>
        h(
          "li",
          { class: "abertura-item" },
          h("span", { class: "abertura-titulo" }, `«${a.titulo || "carta"}»`),
          h("span", { class: "abertura-quando" }, dataHora(a.aberta_em))
        )
      )
    )
  );
}

// ---------------------------------------------------------------------
// Recados
// ---------------------------------------------------------------------
async function carregarRecados(caixa) {
  let recados;
  try {
    recados = await lerRecados();
  } catch (erro) {
    console.error(erro.original || erro);
    caixa.replaceChildren(
      h("p", { class: "aviso-erro" }, "Não consegui carregar os recados."),
      h("button", { class: "botao-pequeno", type: "button", onClick: () => carregarRecados(caixa) }, "Tentar de novo")
    );
    return;
  }

  if (!recados.length) {
    caixa.replaceChildren(h("div", { class: "vazio" }, "Nenhum recado ainda. Quando ela mandar, aparece aqui."));
    return;
  }

  // Links dos áudios
  let links = {};
  const audios = recados.filter((x) => x.audio_path).map((x) => x.audio_path);
  if (audios.length) {
    try {
      links = await linksDosArquivos("recados", audios, 60 * 60 * 6);
    } catch (erro) {
      console.error(erro.original || erro);
    }
  }

  const novos = recados.filter((x) => !x.lido).map((x) => x.id);

  caixa.replaceChildren(
    h(
      "p",
      { class: "recados-resumo" },
      `${recados.length} ${recados.length === 1 ? "recado" : "recados"}`,
      novos.length ? h("span", { class: "selo-novo" }, `${novos.length} ${novos.length === 1 ? "novo" : "novos"}`) : null
    ),
    ...recados.map((recado) => cartaoDoRecado(recado, links[recado.audio_path], () => carregarRecados(caixa)))
  );

  // Abriu a aba = leu. Marca como lido (o selo "novo" continua até recarregar).
  if (novos.length) {
    marcarRecadosLidos(novos)
      .then(() => window.dispatchEvent(new Event("eni-recados-lidos")))
      .catch((erro) => console.error(erro.original || erro));
  }
}

function cartaoDoRecado(recado, link, recarregar) {
  const tipo = recado.tipo === "audio" ? "Áudio" : "Escrito";
  const cabeca = h(
    "div",
    { class: "recado-cabeca" },
    h("span", { class: "recado-tipo" }, recado.lido ? tipo : `${tipo} · novo`),
    h("span", null, dataHora(recado.criado_em))
  );

  let corpo;
  if (recado.tipo === "audio") {
    corpo = link
      ? h(
          "div",
          { class: "recado-audio" },
          h("audio", { controls: true, preload: "metadata", src: link }),
          recado.duracao ? h("span", { class: "recado-duracao" }, minSeg(recado.duracao)) : null
        )
      : h("p", { class: "aviso-erro" }, "Não consegui carregar este áudio.");
  } else {
    corpo = h("p", { class: "recado-texto" }, `“${recado.texto}”`);
  }

  const apagar = h(
    "button",
    {
      class: "botao-pequeno botao-pequeno--perigo",
      type: "button",
      onClick: async () => {
        const sim = await confirmar("O recado some para sempre (não tem como recuperar).", {
          titulo: "Apagar este recado?",
          botao: "Apagar",
        });
        if (!sim) return;
        try {
          await apagarRecado(recado);
          avisar("Recado apagado.");
          recarregar();
        } catch (erro) {
          console.error(erro.original || erro);
          avisar("Não consegui apagar. Tenta de novo.", "erro");
        }
      },
    },
    icone("lixo", 16),
    "Apagar"
  );

  return h(
    "article",
    { class: `recado${recado.lido ? "" : " recado--novo"}` },
    cabeca,
    corpo,
    h("div", { class: "item-acoes" }, h("span", { class: "espaco" }), apagar)
  );
}

// ---------------------------------------------------------------------
// Lista dos 365 dias
// ---------------------------------------------------------------------
async function carregarLista(caixa) {
  let itens;
  try {
    itens = await lerLista();
  } catch (erro) {
    console.error(erro.original || erro);
    caixa.replaceChildren(
      h("p", { class: "aviso-erro" }, "Não consegui carregar a lista."),
      h("button", { class: "botao-pequeno", type: "button", onClick: () => carregarLista(caixa) }, "Tentar de novo")
    );
    return;
  }
  desenharLista(caixa, itens);
}

function desenharLista(caixa, itens) {
  const r = rascunho();
  const feitos = itens.filter((i) => i.feito).length;

  const campoNovo = h("input", {
    class: "campo",
    type: "text",
    maxlength: 120,
    placeholder: "Ex.: viajar para a praia",
    "aria-label": "Nova coisa para fazer juntos",
  });

  const adicionar = async (evento) => {
    evento.preventDefault();
    const texto = campoNovo.value.trim().replace(/\s+/g, " ");
    if (!texto) return;
    campoNovo.disabled = true;
    try {
      const novo = await adicionarNaLista(texto);
      desenharLista(caixa, [novo, ...itens]);
      const proximo = caixa.querySelector("input.campo");
      if (proximo) proximo.focus();
    } catch (erro) {
      console.error(erro.original || erro);
      avisar("Não consegui adicionar. Tenta de novo.", "erro");
      campoNovo.disabled = false;
    }
  };

  const ordenados = itens.slice().sort((a, b) => {
    if (a.feito !== b.feito) return a.feito ? 1 : -1;
    return new Date(b.criado_em) - new Date(a.criado_em);
  });

  caixa.replaceChildren(
    h("p", { class: "recados-resumo" }, `${feitos} realizados · ${itens.length - feitos} não realizados`),
    h(
      "form",
      { class: "lista365-nova", onSubmit: adicionar },
      campoNovo,
      h("button", { class: "botao-pequeno", type: "submit" }, icone("mais", 16), "Adicionar")
    ),
    itens.length
      ? h(
          "ul",
          { class: "lista365-itens" },
          ...ordenados.map((item) => {
            const caixaMarcar = h("input", {
              type: "checkbox",
              checked: item.feito,
              "aria-label": `Feito: ${item.texto}`,
              onChange: async () => {
                caixaMarcar.disabled = true;
                try {
                  const salvo = await marcarNaLista(item.id, caixaMarcar.checked);
                  desenharLista(caixa, itens.map((i) => (i.id === item.id ? salvo : i)));
                } catch (erro) {
                  console.error(erro.original || erro);
                  caixaMarcar.checked = !caixaMarcar.checked;
                  caixaMarcar.disabled = false;
                  avisar("Não consegui marcar. Tenta de novo.", "erro");
                }
              },
            });
            return h(
              "li",
              { class: `lista365-item${item.feito ? " lista365-item--feito" : ""}` },
              caixaMarcar,
              h(
                "span",
                { class: "lista365-texto" },
                item.texto,
                h("span", { class: "lista365-autor" }, item.autor === "admin" ? " · tu" : ` · ${r.nome || "ela"}`)
              ),
              h(
                "button",
                {
                  class: "botao-pequeno botao-pequeno--perigo",
                  type: "button",
                  "aria-label": `Apagar ${item.texto}`,
                  onClick: async () => {
                    const sim = await confirmar(`“${item.texto}” sai da lista dos dois.`, {
                      titulo: "Apagar da lista?",
                      botao: "Apagar",
                    });
                    if (!sim) return;
                    try {
                      await apagarDaLista(item.id);
                      desenharLista(caixa, itens.filter((i) => i.id !== item.id));
                    } catch (erro) {
                      console.error(erro.original || erro);
                      avisar("Não consegui apagar. Tenta de novo.", "erro");
                    }
                  },
                },
                icone("lixo", 16)
              )
            );
          })
        )
      : h("div", { class: "vazio" }, "A lista está vazia. Podes começar com uma ideia tua.")
  );
}
