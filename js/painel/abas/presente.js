// =====================================================================
// Entre Mil Instantes · aba Presente
// O presente fica guardado separado: só chega no celular dela depois
// que ela toca na caixa.
// =====================================================================

import { h, campo, bloco, avisar, confirmar, dataHora } from "../ui.js";
import { campoFoto } from "../campo-foto.js";
import { rascunho, presente, alterar, presenteAbertoEm, marcarPresenteFechado } from "../estado.js";
import { fecharPresente } from "../../supabase.js";

export function desenharPresente(area, redesenhar) {
  const r = rascunho();
  const p = presente();

  const marcar = h(
    "label",
    { class: "marcar" },
    h("input", {
      type: "checkbox",
      checked: p.esconder_foto,
      onChange: (evento) =>
        alterar((_, pp) => {
          pp.esconder_foto = evento.target.checked;
        }),
    }),
    "Não mostrar a foto, só a frase (para manter o mistério)"
  );

  area.append(
    h("div", { class: "area-titulo" }, h("h2", null, "Presente")),
    h(
      "p",
      { class: "area-intro" },
      "O presente só é enviado para o celular dela depois que ela toca na caixa. Antes disso, nem olhando o código dá para descobrir."
    ),

    bloco(
      "Antes de abrir",
      null,
      campo({
        rotulo: "Frase acima da caixa",
        valor: r.presente.frase_caixa,
        multilinha: true,
        linhas: 2,
        max: 100,
        aoMudar: (v) => alterar((d) => { d.presente.frase_caixa = v; }),
      })
    ),

    bloco(
      "Quando a caixa abre",
      null,
      campoFoto({
        rotulo: "Foto do presente",
        caminho: p.foto,
        balde: "presente",
        pasta: "foto",
        aoMudar: (c) =>
          alterar((_, pp) => {
            pp.foto = c;
          }),
      }),
      marcar,
      campo({
        rotulo: "Nome do presente",
        valor: p.nome,
        max: 60,
        aoMudar: (v) =>
          alterar((_, pp) => {
            pp.nome = v;
          }),
      }),
      campo({
        rotulo: "Onde ele está / frase final",
        valor: p.frase,
        multilinha: true,
        linhas: 3,
        max: 240,
        placeholder: "Ex.: Procura embaixo do travesseiro. Feliz aniversário, meu amor.",
        aoMudar: (v) =>
          alterar((_, pp) => {
            pp.frase = v;
          }),
      })
    ),

    situacaoDaCaixa(redesenhar),

    bloco(
      "Cartão para o story",
      "A foto que aparece no cartão que ela baixa no fim. Se ficar sem foto, usa a do primeiro story.",
      campoFoto({
        rotulo: "Foto do cartão",
        caminho: r.cartao.foto,
        pasta: "cartao",
        aoMudar: (c) =>
          alterar((d) => {
            d.cartao.foto = c;
          }),
      })
    ),

    bloco(
      "Cartão com QR code (para imprimir)",
      "Vai junto do presente: ela aponta a câmera e o site abre. Dá para mudar os textos antes de imprimir.",
      h("a", { class: "botao-pequeno", href: "cartao-qr.html", target: "_blank", rel: "noopener" }, "Abrir o cartão para imprimir")
    ),

    bloco(
      "Mensagem secreta",
      "Aparece quando ela toca 5 vezes no nome dela, na abertura.",
      campo({
        rotulo: "Mensagem secreta",
        valor: r.abertura.segredo,
        multilinha: true,
        linhas: 3,
        max: 300,
        aoMudar: (v) => alterar((d) => { d.abertura.segredo = v; }),
      })
    )
  );
}

// Mostra se ela já abriu a caixa (e deixa fechar de novo para testar).
function situacaoDaCaixa(redesenhar) {
  const aberto = presenteAbertoEm();
  if (!aberto) {
    return bloco(null, null, h("p", { class: "bloco-dica" }, "A caixa ainda está fechada: ela não abriu o presente."));
  }
  return bloco(
    null,
    null,
    h("p", { class: "bloco-dica" }, `Ela abriu o presente em ${dataHora(aberto)}.`),
    h(
      "div",
      { class: "item-acoes" },
      h(
        "button",
        {
          class: "botao-pequeno",
          type: "button",
          onClick: async () => {
            const sim = await confirmar(
              "Use só se foste tu que abriste testando com a conta dela. A foto do presente volta a ficar escondida até ela tocar na caixa.",
              { titulo: "Fechar a caixa de novo?", botao: "Fechar a caixa" }
            );
            if (!sim) return;
            try {
              await fecharPresente();
              marcarPresenteFechado();
              avisar("Caixa fechada de novo.", "ok");
              redesenhar();
            } catch (erro) {
              console.error(erro.original || erro);
              avisar("Não consegui fechar. Tenta de novo.", "erro");
            }
          },
        },
        "Fechar a caixa de novo"
      )
    )
  );
}
