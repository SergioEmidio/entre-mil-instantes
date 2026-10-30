// =====================================================================
// Entre Mil Instantes · site/dom.js
// Monta pedaços da tela com segurança (o texto nunca vira código).
// =====================================================================

// h("div", { class: "x", onClick: fn }, "texto", outroElemento)
export function h(tag, atributos, ...filhos) {
  const el = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nome.startsWith("on") && typeof valor === "function") {
      el.addEventListener(nome.slice(2).toLowerCase(), valor);
    } else if (nome === "class") {
      el.className = valor;
    } else if (valor === true) {
      el.setAttribute(nome, "");
    } else {
      el.setAttribute(nome, String(valor));
    }
  }
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

// Texto limpo (sem espaços sobrando). Vazio vira "".
export function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

// Espera um toque em um dos botões. Ex.: esperarClique([[botaoA, "a"], [botaoB, "b"]])
// Devolve o valor do botão tocado e solta os ouvintes.
export function esperarClique(pares) {
  return new Promise((resolver) => {
    const ouvintes = pares.map(([botao, valor]) => {
      const fn = () => {
        ouvintes.forEach(([b, f]) => b.removeEventListener("click", f));
        resolver(valor);
      };
      return [botao, fn];
    });
    ouvintes.forEach(([b, f]) => b.addEventListener("click", f));
  });
}

// Vibração curtinha (quando o celular deixa).
export function vibrar(padrao) {
  try {
    if (navigator.vibrate) navigator.vibrate(padrao);
  } catch {
    /* ok */
  }
}

export const menosMovimento = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
