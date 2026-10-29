// =====================================================================
// Entre Mil Instantes · painel/ui.js
// Ajudantes para montar a tela do painel com segurança (sem innerHTML).
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
    } else if (nome === "value") {
      el.value = valor;
    } else if (nome === "checked") {
      el.checked = Boolean(valor);
    } else if (nome === "style" && typeof valor === "object") {
      Object.assign(el.style, valor);
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

// Ícones (traço fino, herdam a cor do texto)
const CAMINHOS = {
  mais: "M12 5v14M5 12h14",
  seta: "m6 9 6 6 6-6",
  cima: "m18 15-6-6-6 6",
  baixo: "m6 9 6 6 6-6",
  foto: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M21 16l-5-5-9 8",
  lixo: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
};

export function icone(nome, tamanho = 18) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", tamanho);
  svg.setAttribute("height", tamanho);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", CAMINHOS[nome] || "");
  svg.append(path);
  return svg;
}

// ---------------------------------------------------------------------
// Campos de texto
// ---------------------------------------------------------------------
let contadorIds = 0;
export function novoId(prefixo = "c") {
  contadorIds += 1;
  return `${prefixo}-${contadorIds}`;
}

// campo({ rotulo, valor, aoMudar, tipo, multilinha, linhas, max, dica, placeholder })
export function campo(opcoes) {
  const {
    rotulo,
    valor = "",
    aoMudar,
    tipo = "text",
    multilinha = false,
    linhas = 3,
    max,
    dica,
    placeholder,
    inputmode,
  } = opcoes;

  const id = novoId("campo");
  const idDica = dica ? `${id}-dica` : null;

  const contador = max ? h("span", { class: "contador" }) : null;
  const atualizarContador = (texto) => {
    if (!contador) return;
    contador.textContent = `${texto.length} / ${max}`;
    contador.classList.toggle("contador--cheio", texto.length >= max);
  };

  const comum = {
    class: "campo",
    id,
    placeholder,
    maxlength: max,
    inputmode,
    "aria-describedby": idDica,
    onInput: (evento) => {
      atualizarContador(evento.target.value);
      if (aoMudar) aoMudar(evento.target.value);
    },
  };

  const entrada = multilinha
    ? h("textarea", { ...comum, rows: linhas })
    : h("input", { ...comum, type: tipo });
  entrada.value = valor || "";
  atualizarContador(entrada.value);

  const rodape =
    dica || contador
      ? h("div", { class: "campo-rodape" }, h("span", { id: idDica }, dica || ""), contador)
      : null;

  return h("div", { class: "campo-grupo" }, h("label", { class: "campo-rotulo", for: id }, rotulo), entrada, rodape);
}

export function bloco(titulo, dica, ...filhos) {
  return h(
    "section",
    { class: "bloco" },
    titulo ? h("h3", { class: "bloco-titulo" }, titulo) : null,
    dica ? h("p", { class: "bloco-dica" }, dica) : null,
    ...filhos
  );
}

// ---------------------------------------------------------------------
// Avisos rápidos
// ---------------------------------------------------------------------
export function avisar(texto, tipo = "info", ms = 3200) {
  const caixa = document.getElementById("avisos");
  const aviso = h("div", { class: `aviso aviso--${tipo}`, role: tipo === "erro" ? "alert" : "status" }, texto);
  caixa.append(aviso);
  setTimeout(() => aviso.remove(), ms);
}

// ---------------------------------------------------------------------
// Pergunta de confirmação (devolve true/false)
// ---------------------------------------------------------------------
export function confirmar(texto, { titulo = "Tem certeza?", botao = "Excluir" } = {}) {
  const janela = document.getElementById("janela-confirmar");
  document.getElementById("confirmar-titulo").textContent = titulo;
  document.getElementById("confirmar-texto").textContent = texto;
  const sim = document.getElementById("confirmar-sim");
  const nao = document.getElementById("confirmar-nao");
  sim.textContent = botao;

  return new Promise((resolver) => {
    const terminar = (resposta) => {
      sim.removeEventListener("click", aoSim);
      nao.removeEventListener("click", aoNao);
      janela.removeEventListener("cancel", aoNao);
      if (janela.open) janela.close();
      resolver(resposta);
    };
    const aoSim = () => terminar(true);
    const aoNao = (evento) => {
      if (evento) evento.preventDefault();
      terminar(false);
    };
    sim.addEventListener("click", aoSim);
    nao.addEventListener("click", aoNao);
    janela.addEventListener("cancel", aoNao);
    janela.showModal();
    nao.focus();
  });
}

// Data e hora em português (Brasília)
export function dataHora(texto) {
  if (!texto) return "";
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}
