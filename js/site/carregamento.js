// =====================================================================
// Entre Mil Instantes · site/carregamento.js
// Tela 02: aparece logo depois da senha certa.
//   1. a data dentro do anel ("Tu lembraste")
//   2. contador de dias subindo
//   3. frases enquanto o resto do site carrega
//   4. "Tudo pronto" e entra sozinho
// =====================================================================

import { dataCurta, diasDesde } from "./datas.js";

const DURACAO = 8000;           // duração total da animação (ms)
const FIM_DATA = 1800;          // até aqui mostra a data
const FIM_CONTADOR = 4600;      // até aqui o contador sobe
const PERIMETRO = 628.32;       // 2 × π × 100 (raio do anel)
const PAUSA_FINAL = 1800;       // quanto tempo o "Tudo pronto" fica na tela

const FRASES_FINAIS = [
  "Juntando as nossas fotos…",
  "Afinando a tua rádio…",
  "Embrulhando o presente…",
];

// conteudo: o que veio do banco. preparar: promessa do que mais precisa
// carregar (fotos etc.). Devolve uma promessa que termina sozinha
// depois do "Tudo pronto".
export function rodarCarregamento(conteudo, preparar = Promise.resolve()) {
  const el = {
    progresso: document.getElementById("carga-progresso"),
    blocoData: document.getElementById("carga-data"),
    textoData: document.getElementById("carga-data-texto"),
    blocoContador: document.getElementById("carga-contador"),
    numero: document.getElementById("carga-numero"),
    blocoPronto: document.getElementById("carga-pronto"),
    frase: document.getElementById("carga-frase"),
    sub: document.getElementById("carga-sub"),
    barra: document.getElementById("carga-barra"),
    porcento: document.getElementById("carga-porcento"),
  };

  const conhecemos = conteudo && conteudo.datas ? conteudo.datas.conhecemos : null;
  const nome = ((conteudo && conteudo.nome) || "").trim();
  const totalDias = diasDesde(conhecemos);
  const temData = Boolean(dataCurta(conhecemos));
  if (!temData) {
    console.warn("[Entre Mil Instantes] O conteúdo publicado não tem datas.conhecemos. Publique pelo painel.");
  }

  el.textoData.textContent = dataCurta(conhecemos) || "";
  el.blocoData.hidden = !temData;
  el.blocoContador.hidden = true;
  el.blocoPronto.hidden = true;

  let fraseAtual = "";
  function trocarFrase(frase, sub = "") {
    if (frase === fraseAtual) return;
    fraseAtual = frase;
    el.frase.textContent = frase;
    el.sub.textContent = sub;
    el.frase.classList.remove("carga-frase--troca");
    void el.frase.offsetWidth;
    el.frase.classList.add("carga-frase--troca");
  }

  function mostrarBloco(bloco) {
    for (const b of [el.blocoData, el.blocoContador, el.blocoPronto]) {
      b.hidden = b !== bloco;
    }
  }

  function progresso(fracao) {
    const f = Math.min(1, Math.max(0, fracao));
    el.progresso.style.strokeDashoffset = String(PERIMETRO * (1 - f));
    el.barra.style.width = `${(f * 100).toFixed(1)}%`;
    el.porcento.textContent = `${Math.round(f * 100)}%`;
  }

  let pronto = false;
  preparar.catch(() => {}).finally(() => { pronto = true; });

  return new Promise((terminar) => {
    const inicio = performance.now();
    trocarFrase("É essa. Senha certa.", "Abrindo a nossa história…");
    progresso(0);

    function quadro(agora) {
      const t = agora - inicio;

      if (!temData && t < FIM_CONTADOR) {
        // Sem a data no conteúdo publicado: pula a data e o contador.
        mostrarBloco(null);
        trocarFrase("É essa. Senha certa.", "Abrindo a nossa história…");
      } else if (t < FIM_DATA) {
        mostrarBloco(el.blocoData);
      } else if (t < FIM_CONTADOR) {
        mostrarBloco(el.blocoContador);
        const f = (t - FIM_DATA) / (FIM_CONTADOR - FIM_DATA);
        const suave = 1 - Math.pow(1 - Math.min(1, f), 3);
        el.numero.textContent = String(Math.round(totalDias * suave));
        trocarFrase("Cada um deles contou.");
      } else if (t < DURACAO || !pronto) {
        el.numero.textContent = String(totalDias);
        const indice = Math.min(
          FRASES_FINAIS.length - 1,
          Math.floor(((t - FIM_CONTADOR) / (DURACAO - FIM_CONTADOR)) * FRASES_FINAIS.length)
        );
        trocarFrase(t >= DURACAO ? "Quase lá…" : FRASES_FINAIS[indice]);
      }

      // A barra para em 99% se ainda estiver carregando alguma coisa.
      const limite = pronto ? 1 : 0.99;
      progresso(Math.min(limite, t / DURACAO));

      if (t >= DURACAO && pronto) {
        finalizar();
        return;
      }
      requestAnimationFrame(quadro);
    }

    function finalizar() {
      progresso(1);
      mostrarBloco(el.blocoPronto);
      trocarFrase(nome ? `Tudo pronto, ${nome}.` : "Tudo pronto.");
      setTimeout(terminar, PAUSA_FINAL);
    }

    requestAnimationFrame(quadro);
  });
}
