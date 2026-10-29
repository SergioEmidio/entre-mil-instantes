// =====================================================================
// Entre Mil Instantes · site/som.js
// A música da Retrospectiva (opção A): toca só no story da música.
//   · começa no segundo escolhido no painel, com o volume subindo
//   · pausa quando ela segura o dedo
//   · some devagar quando ela passa de story
//   · botão de som ligado/desligado (fica lembrado no celular)
//
// Celulares só deixam tocar som depois de um toque. Por isso o botão
// "Entrar na nossa história" chama destravarSom().
// =====================================================================

const musica = new Audio();
musica.preload = "auto";
musica.setAttribute("playsinline", "");

let temMusica = false;
let inicio = 0;
let noStory = false;       // está no story da música agora
let mudo = lerMudo();
let animacao = 0;

function lerMudo() {
  try {
    return localStorage.getItem("eni-som") === "desligado";
  } catch {
    return false;
  }
}

function guardarMudo() {
  try {
    localStorage.setItem("eni-som", mudo ? "desligado" : "ligado");
  } catch {
    /* tudo bem */
  }
}

// Volume subindo/descendo aos poucos. (No iPhone o volume é sempre o do
// aparelho: lá a música só começa e para, sem o efeito.)
function volumeAte(alvo, ms) {
  cancelAnimationFrame(animacao);
  const de = musica.volume;
  const inicioTempo = performance.now();
  return new Promise((resolver) => {
    const passo = (agora) => {
      const f = Math.min(1, (agora - inicioTempo) / ms);
      try {
        musica.volume = Math.max(0, Math.min(1, de + (alvo - de) * f));
      } catch {
        /* alguns aparelhos não deixam mudar */
      }
      if (f < 1) animacao = requestAnimationFrame(passo);
      else resolver();
    };
    animacao = requestAnimationFrame(passo);
  });
}

function irParaInicio() {
  try {
    musica.currentTime = inicio;
  } catch {
    /* ainda carregando: o "#t=" do endereço cuida disso */
  }
}

function tocar() {
  const promessa = musica.play();
  if (promessa && typeof promessa.catch === "function") promessa.catch(() => {});
}

// ---------------------------------------------------------------------
export function prepararMusica(link, inicioSegundos) {
  temMusica = Boolean(link);
  if (!temMusica) return;
  inicio = Math.max(0, Number(inicioSegundos) || 0);
  const endereco = inicio ? `${link}#t=${inicio}` : link;
  if (musica.getAttribute("src") !== endereco) musica.setAttribute("src", endereco);
  atualizarBotao();
}

export function haMusica() {
  return temMusica;
}

// Chamar DENTRO do toque em "Entrar" (antes de qualquer espera).
export function destravarSom() {
  if (!temMusica) return;
  musica.muted = true;
  const promessa = musica.play();
  const voltar = () => {
    if (!noStory) musica.pause();
    musica.muted = false;
  };
  if (promessa && typeof promessa.then === "function") promessa.then(voltar, voltar);
  else voltar();
}

export function entrarNoStoryDaMusica() {
  noStory = true;
  if (!temMusica || mudo) return;
  irParaInicio();
  try {
    musica.volume = 0;
  } catch {
    /* ok */
  }
  tocar();
  volumeAte(1, 1200);
}

export function sairDoStoryDaMusica() {
  noStory = false;
  if (!temMusica || musica.paused) return;
  volumeAte(0, 900).then(() => {
    if (!noStory) musica.pause();
  });
}

export function pausarMusica() {
  if (noStory && !musica.paused) musica.pause();
}

export function continuarMusica() {
  if (noStory && temMusica && !mudo && musica.paused) {
    cancelAnimationFrame(animacao);
    try {
      musica.volume = 1;
    } catch {
      /* ok */
    }
    tocar();
  }
}

export function alternarSom() {
  mudo = !mudo;
  guardarMudo();
  if (noStory) {
    if (mudo) musica.pause();
    else continuarMusica();
  }
  atualizarBotao();
}

export function somDesligado() {
  return mudo;
}

// Botão do topo dos stories
export function atualizarBotao() {
  const botao = document.getElementById("stories-som");
  if (!botao) return;
  botao.hidden = !temMusica;
  botao.setAttribute("aria-pressed", String(!mudo));
  botao.setAttribute("aria-label", mudo ? "Ligar o som" : "Desligar o som");
  botao.dataset.mudo = String(mudo);
}
