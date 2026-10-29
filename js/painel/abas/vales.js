// =====================================================================
// Entre Mil Instantes · aba Vales (raspadinha)
// =====================================================================

import { h, icone, novoId, avisar } from "../ui.js";
import { rascunho, alterar, novoIdentificador } from "../estado.js";

const MAXIMO = 4;
const SUGESTOES = ["Um cinema com pipoca grande", "Um dia inteiro de mimos", "Um jantar onde tu escolheres"];

export function desenharVales(area, redesenhar) {
  const lista = rascunho().vales;

  area.append(
    h("div", { class: "area-titulo" }, h("h2", null, "Vales da raspadinha"), h("p", null, `${lista.length} de ${MAXIMO}`)),
    h("p", { class: "area-intro" }, "Cada vale vira um cartão que ela raspa com o dedo. Vales sem texto não aparecem.")
  );

  if (!lista.length) {
    area.append(
      h(
        "button",
        {
          class: "botao-adicionar",
          type: "button",
          onClick: () => {
            alterar((r) => {
              r.vales = SUGESTOES.map((texto) => ({ id: novoIdentificador(), texto }));
            });
            redesenhar();
            avisar("3 vales criados. Pode mudar o texto de cada um.");
          },
        },
        "Começar com as 3 sugestões do protótipo"
      )
    );
  }

  const caixa = h("div", { class: "bloco" });
  lista.forEach((vale, indice) => {
    const id = novoId("vale");
    caixa.append(
      h(
        "div",
        { class: "vale" },
        h("label", { class: "vale-numero", for: id }, `0${indice + 1}`),
        h("input", {
          class: "campo",
          id,
          type: "text",
          maxlength: 60,
          value: vale.texto,
          placeholder: "Ex.: um piquenique no parque",
          onInput: (evento) =>
            alterar((r) => {
              const alvo = r.vales.find((v) => v.id === vale.id);
              if (alvo) alvo.texto = evento.target.value;
            }),
        }),
        h(
          "button",
          {
            class: "botao-pequeno botao-pequeno--perigo",
            type: "button",
            "aria-label": `Excluir vale ${indice + 1}`,
            onClick: () => {
              alterar((r) => {
                r.vales = r.vales.filter((v) => v.id !== vale.id);
              });
              redesenhar();
            },
          },
          icone("lixo", 16)
        )
      )
    );
  });
  if (lista.length) area.append(caixa);

  area.append(
    h(
      "button",
      {
        class: "botao-adicionar",
        type: "button",
        disabled: lista.length >= MAXIMO,
        onClick: () => {
          alterar((r) => {
            r.vales.push({ id: novoIdentificador(), texto: "" });
          });
          redesenhar();
          const campos = area.querySelectorAll(".vale .campo");
          if (campos.length) campos[campos.length - 1].focus();
        },
      },
      icone("mais"),
      "Adicionar vale"
    )
  );
}
