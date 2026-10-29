// =====================================================================
// Entre Mil Instantes · abas que chegam nas próximas fases
// =====================================================================

import { h } from "../ui.js";

export function desenharEmBreve(titulo, fase, texto) {
  return (area) => {
    area.append(
      h("div", { class: "area-titulo" }, h("h2", null, titulo)),
      h("div", { class: "em-breve" }, h("strong", null, `Chega na fase ${fase}`), texto)
    );
  };
}
