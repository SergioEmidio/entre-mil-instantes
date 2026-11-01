// =====================================================================
// Nós, em Todos os Instantes · site/avisos.js
// Avisos no celular (notificações): carta nova, música nova, contagem
// das cartas trancadas e "a carta foi liberada".
//
// O pedido de permissão só acontece quando ela toca em "Ativar avisos"
// (no cantinho). Depois disso o celular avisa mesmo com o app fechado.
// =====================================================================

import { CONFIG } from "../config.js";
import { salvarAviso, removerAviso } from "../supabase.js";
import { lerMemoria, guardarMemoria } from "./memoria.js";

const el = {};
let ligado = false;

function chaveEmBytes(base64) {
  const t = base64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function avisosSuportados() {
  return (
    Boolean(CONFIG.AVISOS_CHAVE_PUBLICA) &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function registro() {
  // espera o sw.js (registrado no instalar.js) ficar pronto, no máximo 8 s
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error("sw_demorou")), 8000)),
  ]);
}

async function inscricaoAtual() {
  try {
    const reg = await registro();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// "sem-suporte" | "bloqueado" | "ligado" | "desligado"
export async function situacaoDosAvisos() {
  if (!avisosSuportados()) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission === "granted" && (await inscricaoAtual())) return "ligado";
  return "desligado";
}

// Ela tocou em "Ativar avisos"
export async function ativarAvisos() {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desligado";
  const reg = await registro();
  let inscricao = await reg.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveEmBytes(CONFIG.AVISOS_CHAVE_PUBLICA),
    });
  }
  await salvarAviso(inscricao.toJSON());
  guardarMemoria("avisos-dispensado", false);
  // um primeiro aviso, na hora, para ela ver como fica (e sentir a vibração)
  try {
    await reg.showNotification("Pronto, avisos ligados ♥", {
      body: "Vou te avisar quando chegar carta nova, música nova e quando faltar pouco para uma carta abrir.",
      icon: "./icones/icone-192.png",
      badge: "./icones/aviso-selo.png",
      vibrate: [180, 90, 180, 90, 320],
      tag: "avisos-ligados",
    });
  } catch {
    /* tudo bem: os avisos continuam ligados */
  }
  return "ligado";
}

export async function desativarAvisos() {
  const inscricao = await inscricaoAtual();
  if (inscricao) {
    await removerAviso(inscricao.endpoint).catch(() => {});
    await inscricao.unsubscribe().catch(() => {});
  }
  return "desligado";
}

// Ao abrir o app: se os avisos estão ligados, confere se a inscrição
// continua salva (o celular às vezes troca o endereço) e apaga a bolinha.
export async function sincronizarAvisos() {
  try {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch {
    /* ok */
  }
  if (!avisosSuportados() || Notification.permission !== "granted") return;
  const inscricao = await inscricaoAtual();
  if (inscricao) await salvarAviso(inscricao.toJSON()).catch(() => {});
}

// ---------------------------------------------------------------------
// O cartão no cantinho
// ---------------------------------------------------------------------
function pegar() {
  if (ligado) return;
  ligado = true;
  for (const [nome, idDoEl] of Object.entries({
    caixa: "convite-avisos",
    titulo: "avisos-titulo",
    texto: "avisos-texto",
    ativar: "avisos-ativar",
    agoraNao: "avisos-agora-nao",
    desligar: "avisos-desligar",
  })) {
    el[nome] = document.getElementById(idDoEl);
  }
  if (!el.caixa) return;

  el.ativar.addEventListener("click", async () => {
    el.ativar.disabled = true;
    el.ativar.textContent = "Ativando…";
    try {
      const resultado = await ativarAvisos();
      desenhar(resultado);
    } catch (erro) {
      console.error(erro);
      el.texto.textContent = "Não consegui ativar agora. Confere a internet e tenta de novo.";
      el.ativar.textContent = "Tentar de novo";
    } finally {
      el.ativar.disabled = false;
    }
  });
  el.agoraNao.addEventListener("click", () => {
    guardarMemoria("avisos-dispensado", true);
    el.caixa.hidden = true;
  });
  el.desligar.addEventListener("click", async () => {
    el.desligar.disabled = true;
    desenhar(await desativarAvisos());
    el.desligar.disabled = false;
  });
}

function desenhar(situacao) {
  if (!el.caixa) return;
  el.caixa.dataset.situacao = situacao;
  el.caixa.hidden = situacao === "sem-suporte" || (situacao === "desligado" && lerMemoria("avisos-dispensado", false));
  el.ativar.hidden = situacao !== "desligado";
  el.agoraNao.hidden = situacao !== "desligado";
  el.desligar.hidden = situacao !== "ligado";
  el.ativar.textContent = "Ativar avisos";
  if (situacao === "ligado") {
    el.titulo.textContent = "Avisos ligados neste celular";
    el.texto.textContent = "Quando chegar carta nova, música nova ou faltar pouco para uma carta abrir, o teu celular avisa e vibra.";
  } else if (situacao === "bloqueado") {
    el.titulo.textContent = "Os avisos estão bloqueados";
    el.texto.textContent = "Para ligar: segura o ícone do app → Informações do app → Notificações → Permitir.";
  } else {
    el.titulo.textContent = "Quer que eu te avise?";
    el.texto.textContent = "Quando chegar carta nova, música nova na Rádio ou faltar pouco para uma carta trancada abrir, o teu celular vibra e avisa.";
  }
}

export async function atualizarConviteDosAvisos() {
  pegar();
  if (!el.caixa) return;
  desenhar(await situacaoDosAvisos());
}
