// =====================================================================
// Nós, em Todos os Instantes · site/fio.js
// A barra de rolagem do site: um "fio" fininho no lugar da barra cinza.
//  · Só aparece enquanto ela rola (ou passa o mouse na beirada) e some.
//  · A cor vem da tela: dourado no céu, tinta vinho no papel da carta
//    (variável CSS --fio-cor de cada tela).
//  · Dá para arrastar (computador) e tocar no trilho para pular.
//  · A rolagem continua sendo a do navegador (dedo, roda, teclado).
// =====================================================================

const SOME_DEPOIS = 1100;
const MINIMO = 28;

// fioEm(rolador, { onde, pagina })
//  rolador: o elemento que rola (ou document.scrollingElement)
//  onde: onde o trilho é colocado (para a página: o body)
export function fioEm(rolador, { onde, pagina = false } = {}) {
  const trilho = document.createElement("div");
  trilho.className = pagina ? "fio fio--pagina" : "fio";
  trilho.setAttribute("aria-hidden", "true");
  const polegar = document.createElement("div");
  polegar.className = "fio-polegar";
  trilho.append(polegar);
  (onde || rolador.parentElement).append(trilho);

  let timer = null;
  let arrastando = null;
  let quadro = 0;

  const alturaVisivel = () => (pagina ? window.innerHeight : rolador.clientHeight);
  const topo = () => (pagina ? window.scrollY || document.documentElement.scrollTop : rolador.scrollTop);
  const irPara = (y, suave) => {
    if (pagina) window.scrollTo({ top: y, behavior: suave ? "smooth" : "auto" });
    else if (suave && rolador.scrollTo) rolador.scrollTo({ top: y, behavior: "smooth" });
    else rolador.scrollTop = y;
  };

  function medidas() {
    const total = rolador.scrollHeight;
    const visivel = alturaVisivel();
    const altTrilho = trilho.clientHeight;
    const sobra = Math.max(0, total - visivel);
    const altPolegar = Math.max(MINIMO, Math.min(altTrilho, (altTrilho * visivel) / Math.max(1, total)));
    return { sobra, altTrilho, altPolegar };
  }

  function desenhar() {
    quadro = 0;
    const { sobra, altTrilho, altPolegar } = medidas();
    const precisa = sobra > 2 && altTrilho > MINIMO;
    trilho.classList.toggle("fio--sem", !precisa);
    if (!precisa) return;
    if (pagina) {
      const cena = document.querySelector(".cena--ativa") || document.querySelector(".cena:not([hidden])");
      const cor = cena ? getComputedStyle(cena).getPropertyValue("--fio-cor").trim() : "";
      if (cor) trilho.style.setProperty("--fio-cor", cor);
      else trilho.style.removeProperty("--fio-cor");
    }
    const fracao = Math.min(1, Math.max(0, topo() / sobra));
    polegar.style.height = `${altPolegar}px`;
    polegar.style.transform = `translateY(${(altTrilho - altPolegar) * fracao}px)`;
  }

  function pedirDesenho() {
    if (!quadro) quadro = requestAnimationFrame(desenhar);
  }

  function acender() {
    trilho.classList.add("fio--ativo");
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!arrastando && !trilho.matches(":hover")) trilho.classList.remove("fio--ativo");
    }, SOME_DEPOIS);
  }

  const aoRolar = () => {
    pedirDesenho();
    acender();
  };
  const alvo = pagina ? window : rolador;
  alvo.addEventListener("scroll", aoRolar, { passive: true });
  window.addEventListener("resize", pedirDesenho);

  let observador = null;
  if (typeof ResizeObserver === "function") {
    observador = new ResizeObserver(pedirDesenho);
    observador.observe(pagina ? document.body : rolador);
    if (!pagina && rolador.firstElementChild) observador.observe(rolador.firstElementChild);
  }

  // Arrastar o polegar
  polegar.addEventListener("pointerdown", (evento) => {
    evento.preventDefault();
    evento.stopPropagation();
    const { sobra, altTrilho, altPolegar } = medidas();
    arrastando = { y: evento.clientY, inicio: topo(), razao: sobra / Math.max(1, altTrilho - altPolegar) };
    trilho.classList.add("fio--arrastando", "fio--ativo");
    try {
      polegar.setPointerCapture(evento.pointerId);
    } catch {
      /* tudo bem */
    }
  });
  polegar.addEventListener("pointermove", (evento) => {
    if (!arrastando) return;
    irPara(arrastando.inicio + (evento.clientY - arrastando.y) * arrastando.razao, false);
  });
  const soltar = () => {
    if (!arrastando) return;
    arrastando = null;
    trilho.classList.remove("fio--arrastando");
    acender();
  };
  polegar.addEventListener("pointerup", soltar);
  polegar.addEventListener("pointercancel", soltar);

  // Tocar no trilho: pula para aquele ponto
  trilho.addEventListener("pointerdown", (evento) => {
    if (evento.target !== trilho) return;
    evento.stopPropagation();
    const { sobra, altTrilho, altPolegar } = medidas();
    const caixa = trilho.getBoundingClientRect();
    const fracao = (evento.clientY - caixa.top - altPolegar / 2) / Math.max(1, altTrilho - altPolegar);
    irPara(Math.min(1, Math.max(0, fracao)) * sobra, true);
    acender();
  });
  trilho.addEventListener("click", (evento) => evento.stopPropagation());
  trilho.addEventListener("pointerenter", () => {
    trilho.classList.add("fio--ativo");
    clearTimeout(timer);
  });
  trilho.addEventListener("pointerleave", acender);

  desenhar();

  return {
    trilho,
    atualizar: () => desenhar(),
    acender: () => {
      desenhar();
      acender();
    },
    destruir() {
      alvo.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", pedirDesenho);
      if (observador) observador.disconnect();
      clearTimeout(timer);
      trilho.remove();
    },
  };
}

// O fio da página inteira (uma vez, quando o site abre).
let fioDaPagina = null;
export function prepararFioDaPagina() {
  if (fioDaPagina || !document.body) return fioDaPagina;
  document.documentElement.classList.add("rolagem-fio");
  fioDaPagina = fioEm(document.scrollingElement || document.documentElement, { onde: document.body, pagina: true });
  return fioDaPagina;
}

// Avisa que a tela mudou (a cor e o tamanho do fio mudam junto).
export function atualizarFioDaPagina() {
  if (fioDaPagina) fioDaPagina.atualizar();
}
