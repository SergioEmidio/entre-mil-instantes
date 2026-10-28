// =====================================================================
// Entre Mil Instantes · site/senha.js
// Tela 01: campo da data. Só aceita números e já forma dd/mm/aaaa.
// Quando acerta, NÃO mostra nada aqui: o site passa direto para o
// carregamento (é ele que mostra que a senha estava certa).
// =====================================================================

import { somenteNumeros, mascararData, numerosFormamData } from "./datas.js";

const ERROS_PARA_DICA = 2;
const ERROS_PARA_PAUSA = 5;     // depois de 5 erros seguidos, espera um pouco
const PAUSA_SEGUNDOS = 30;

// tentarEntrar(numeros) deve devolver:
//   "certo" | "errado" | "muitas_tentativas" | "rede" | "erro" | "parado"
export function iniciarSenha({ tentarEntrar, aoAcertar }) {
  const form = document.getElementById("senha-form");
  const campo = document.getElementById("senha-campo");
  const aviso = document.getElementById("senha-aviso");

  let erros = 0;
  let errosSeguidos = 0;
  let conferindo = false;
  let pausaAte = 0;
  let relogioPausa = null;

  function avisar(texto, tipo = "erro") {
    aviso.textContent = texto;
    aviso.classList.toggle("senha-aviso--dica", tipo === "dica");
    aviso.classList.toggle("senha-aviso--neutro", tipo === "neutro");
  }

  function tremer() {
    campo.classList.remove("senha-campo--treme");
    void campo.offsetWidth; // reinicia a animação
    campo.classList.add("senha-campo--treme");
    if (navigator.vibrate) {
      try { navigator.vibrate(60); } catch { /* alguns celulares não deixam */ }
    }
  }

  function escrever(numeros) {
    campo.value = mascararData(numeros);
    // cursor sempre no fim (a máscara põe as barras sozinha)
    const fim = campo.value.length;
    try { campo.setSelectionRange(fim, fim); } catch { /* ok */ }
  }

  // Bloqueia letras e símbolos antes mesmo de aparecerem.
  campo.addEventListener("beforeinput", (evento) => {
    if (evento.data && /\D/.test(evento.data.replace(/\//g, ""))) {
      evento.preventDefault();
    }
  });

  campo.addEventListener("input", () => {
    const numeros = somenteNumeros(campo.value);
    escrever(numeros);

    if (numeros.length < 8) {
      if (aviso.classList.contains("senha-aviso--neutro") || aviso.dataset.tipo === "data") {
        avisar("");
      }
      return;
    }
    conferir(numeros);
  });

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const numeros = somenteNumeros(campo.value);
    if (numeros.length === 8) {
      conferir(numeros);
    } else if (numeros.length > 0) {
      avisar("Faltam números. Usa dia, mês e ano: dd/mm/aaaa.");
    }
  });

  async function conferir(numeros) {
    if (conferindo || Date.now() < pausaAte) return;

    if (!numerosFormamData(numeros)) {
      avisar("Essa data não existe. Confere o dia e o mês.");
      aviso.dataset.tipo = "data";
      tremer();
      return;
    }
    aviso.dataset.tipo = "";

    conferindo = true;
    campo.disabled = true;
    avisar("Conferindo…", "neutro");

    let resultado;
    try {
      resultado = await tentarEntrar(numeros);
    } catch {
      resultado = "rede";
    }

    conferindo = false;

    if (resultado === "certo") {
      avisar("");
      aoAcertar();
      return;
    }

    campo.disabled = false;

    if (resultado === "parado") {
      // O site saiu desta tela (ex.: ainda não era a hora). Nada a avisar.
      avisar("");
      escrever("");
      return;
    }

    if (resultado === "rede") {
      avisar("Sem conexão. Confere a internet e tenta de novo.");
      campo.focus();
      return;
    }

    if (resultado === "erro") {
      avisar("Algo deu errado. Tenta de novo em instantes.");
      escrever("");
      campo.focus();
      return;
    }

    if (resultado === "muitas_tentativas") {
      escrever("");
      pausar(60);
      return;
    }

    // errado
    erros += 1;
    errosSeguidos += 1;
    tremer();
    escrever("");

    if (errosSeguidos >= ERROS_PARA_PAUSA) {
      errosSeguidos = 0;
      pausar(PAUSA_SEGUNDOS);
      return;
    }

    if (erros >= ERROS_PARA_DICA) {
      avisar("Dica: é o dia em que a gente se conheceu.", "dica");
    } else {
      avisar("Não foi esse dia. Tenta de novo.");
    }
    campo.focus();
  }

  function pausar(segundos) {
    pausaAte = Date.now() + segundos * 1000;
    campo.disabled = true;
    clearInterval(relogioPausa);

    const atualizar = () => {
      const falta = Math.ceil((pausaAte - Date.now()) / 1000);
      if (falta <= 0) {
        clearInterval(relogioPausa);
        campo.disabled = false;
        avisar("Pode tentar de novo. Dica: é o dia em que a gente se conheceu.", "dica");
        campo.focus();
        return;
      }
      avisar(`Muitas tentativas. Espera ${falta}s para tentar de novo.`);
    };
    atualizar();
    relogioPausa = setInterval(atualizar, 1000);
  }

  return {
    focar() {
      // No computador já deixa pronto para digitar.
      // (No iPhone o teclado só abre quando ela toca no campo; isso é do próprio iOS.)
      if (!window.matchMedia("(pointer: coarse)").matches) campo.focus();
    },
  };
}
