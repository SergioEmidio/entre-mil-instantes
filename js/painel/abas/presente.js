// =====================================================================
// Entre Mil Instantes · aba Presente
// O presente fica guardado separado: só chega no celular dela depois
// que ela toca na caixa.
// =====================================================================

import { h, campo, bloco } from "../ui.js";
import { campoFoto } from "../campo-foto.js";
import { rascunho, presente, alterar } from "../estado.js";

export function desenharPresente(area) {
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
