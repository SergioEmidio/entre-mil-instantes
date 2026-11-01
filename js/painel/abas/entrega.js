// =====================================================================
// Nós, em Todos os Instantes · aba "Antes de entregar"
//  1. Conferência: o que ainda falta preencher (só lê o rascunho).
//  2. Cópia de segurança: baixar o rascunho num arquivo e restaurar.
//  3. Deixar tudo zerado para ela: apaga só os rastros dos testes
//     (recados, itens da lista, cartas abertas, caixa aberta).
//     O conteúdo (stories, cartas, vales, rádio, presente) não é tocado.
// =====================================================================

import { h, avisar, confirmar, dataHora } from "../ui.js";
import { rascunho, presente, situacao, copiaDeSeguranca, lerCopia, restaurarCopia, marcarPresenteFechado, salvarAgora } from "../estado.js";
import { obterSituacao, resumoDosTestes, limparTestes } from "../../supabase.js";

const CHAVE_ULTIMA_COPIA = "eni-painel-ultima-copia";

const vazio = (t) => !String(t || "").trim();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function irPara(aba) {
  window.dispatchEvent(new CustomEvent("eni-ir-para-aba", { detail: aba }));
}

export function desenharEntrega(area) {
  const caixaConferencia = h("div", { class: "conferencia" });
  const caixaCopia = h("div", { class: "bloco" });
  const caixaLimpar = h("div", { class: "bloco" }, h("p", { class: "carregando-texto" }, "Conferindo o que tem de teste…"));

  area.append(
    h("div", { class: "area-titulo" }, h("h2", null, "Antes de entregar")),
    h("p", { class: "area-intro" }, "Uma conferência final, uma cópia de segurança e a limpeza dos testes."),
    h("div", { class: "area-titulo area-titulo--separado" }, h("h2", null, "O que ainda falta")),
    caixaConferencia,
    h("div", { class: "area-titulo area-titulo--separado" }, h("h2", null, "Cópia de segurança")),
    caixaCopia,
    h("div", { class: "area-titulo area-titulo--separado" }, h("h2", null, "Deixar tudo zerado para ela")),
    caixaLimpar
  );

  desenharConferencia(caixaConferencia);
  desenharCopia(caixaCopia);
  carregarLimpeza(caixaLimpar);
}

// =====================================================================
// 1. Conferência
// =====================================================================
function pendencias() {
  const r = rascunho();
  const p = presente();
  const itens = [];
  const add = (tipo, texto, aba) => itens.push({ tipo, texto, aba });

  // Retrospectiva
  if (vazio(r.datas.conhecemos) || vazio(r.datas.namoro)) add("falta", "Datas (quando se conheceram / namoro) estão vazias.", "retrospectiva");
  if (!r.retrospectiva.musica.audio) add("aviso", "A «nossa música» da retrospectiva está sem áudio.", "retrospectiva");

  // Stories
  if (!r.stories.length) add("falta", "Nenhum story ainda.", "stories");
  r.stories.forEach((s, i) => {
    if (!s.foto) add("falta", `Story ${i + 1}: sem foto ou vídeo (não aparece para ela).`, "stories");
  });
  const semFrase = r.stories.map((s, i) => (s.foto && vazio(s.frase) ? i + 1 : 0)).filter(Boolean);
  if (semFrase.length) {
    add("aviso", `${semFrase.length === 1 ? "Story" : "Stories"} sem legenda: ${semFrase.join(", ")}. (Pode ser de propósito.)`, "stories");
  }

  // Rádio
  r.radio.faixas.forEach((f, i) => {
    if (!f.audio) add("falta", `Rádio, faixa ${i + 1}${f.titulo ? ` «${f.titulo}»` : ""}: sem música.`, "radio");
  });

  // Cartas
  r.cartas.forEach((c, i) => {
    const nome = c.titulo ? `«${c.titulo}»` : `${i + 1}`;
    if (vazio(c.titulo)) add("falta", `Carta ${i + 1}: sem título.`, "cartas");
    if (vazio(c.texto) && !c.audio) add("falta", `Carta ${nome}: sem texto e sem voz.`, "cartas");
  });

  // Vales
  r.vales.forEach((v, i) => {
    if (vazio(v.texto)) add("falta", `Vale ${i + 1}: sem texto.`, "vales");
  });

  // Presente
  if (vazio(p.nome) && vazio(p.frase) && !p.foto) add("falta", "O presente está vazio (sem nome, frase nem foto).", "presente");
  else if (vazio(p.frase)) add("aviso", "O presente está sem a frase final.", "presente");

  return itens;
}

function desenharConferencia(caixa) {
  const itens = pendencias();
  const s = situacao();
  const linhas = [];

  const linhaAbertura = h("li", { class: "conf-item conf-item--info" }, h("span", null, "Conferindo quando o site abre…"));
  linhas.push(linhaAbertura);
  obterSituacao()
    .then(({ liberarEm }) => {
      const ok = liberarEm.getTime() === Date.parse("2026-11-03T19:55:00-03:00");
      linhaAbertura.className = `conf-item ${ok ? "conf-item--ok" : "conf-item--aviso"}`;
      linhaAbertura.replaceChildren(
        h("span", null, `O site abre para ela em ${dataHora(liberarEm)}.${ok ? "" : " (Confere se é isso mesmo: o combinado é 03/11 às 19:55.)"}`)
      );
    })
    .catch(() => {
      linhaAbertura.replaceChildren(h("span", null, "Não consegui conferir a data de abertura agora."));
    });

  if (s.temDiferenca || s.salvandoOuPendente) {
    linhas.push(
      h("li", { class: "conf-item conf-item--aviso" }, h("span", null, "Tens alterações que ela ainda não vê. Toca em «Publicar» no fim da tela."))
    );
  } else {
    linhas.push(h("li", { class: "conf-item conf-item--ok" }, h("span", null, "Tudo o que está aqui já está publicado.")));
  }

  if (!itens.length) {
    linhas.push(h("li", { class: "conf-item conf-item--ok" }, h("span", null, "Nada faltando no conteúdo. ♥")));
  }
  for (const item of itens) {
    linhas.push(
      h(
        "li",
        { class: `conf-item conf-item--${item.tipo}` },
        h("span", null, item.texto),
        h("button", { class: "botao-pequeno conf-ir", type: "button", onClick: () => irPara(item.aba) }, "Ir")
      )
    );
  }

  caixa.replaceChildren(
    h("ul", { class: "conf-lista" }, ...linhas),
    h(
      "button",
      { class: "botao-pequeno", type: "button", onClick: () => desenharConferencia(caixa) },
      "Conferir de novo"
    )
  );
}

// =====================================================================
// 2. Cópia de segurança
// =====================================================================
function lerUltimaCopia() {
  try {
    return localStorage.getItem(CHAVE_ULTIMA_COPIA);
  } catch {
    return null;
  }
}

function guardarUltimaCopia() {
  try {
    localStorage.setItem(CHAVE_ULTIMA_COPIA, new Date().toISOString());
  } catch {
    /* tudo bem */
  }
}

function nomeDoArquivo() {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, "0");
  return `nossos-instantes-copia-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}h${dois(d.getMinutes())}.json`;
}

function desenharCopia(caixa) {
  const ultima = lerUltimaCopia();
  const entrada = h("input", { type: "file", accept: "application/json,.json", class: "sr-only", id: "entrada-copia" });

  async function baixar() {
    try {
      await salvarAgora();
    } catch {
      avisar("Ainda não consegui salvar. Tenta de novo em instantes.", "erro");
      return;
    }
    const texto = JSON.stringify(copiaDeSeguranca(), null, 2);
    const blob = new Blob([texto], { type: "application/json" });
    const link = h("a", { href: URL.createObjectURL(blob), download: nomeDoArquivo() });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    guardarUltimaCopia();
    avisar("Cópia baixada. Guarda esse arquivo no computador.", "ok", 4500);
    desenharCopia(caixa);
  }

  entrada.addEventListener("change", async () => {
    const arquivo = entrada.files && entrada.files[0];
    entrada.value = "";
    if (!arquivo) return;
    let copia;
    try {
      if (arquivo.size > 5 * 1024 * 1024) throw new Error("copia_invalida");
      copia = lerCopia(JSON.parse(await arquivo.text()));
    } catch {
      avisar("Esse arquivo não é uma cópia do painel.", "erro", 5000);
      return;
    }
    const quando = copia.feitaEm ? ` (feita em ${dataHora(copia.feitaEm)})` : "";
    const sim = await confirmar(
      `O rascunho atual vai ser trocado pelo da cópia${quando}: ${plural(copia.rascunho.stories.length, "story", "stories")}, ${plural(copia.rascunho.cartas.length, "carta", "cartas")}, ${plural(copia.rascunho.vales.length, "vale", "vales")}. Nada muda para ela até publicares.`,
      { titulo: "Restaurar esta cópia?", botao: "Restaurar" }
    );
    if (!sim) return;
    restaurarCopia(copia);
    try {
      await salvarAgora();
      avisar("Cópia restaurada no rascunho. Confere e publica quando quiseres.", "ok", 5000);
    } catch {
      avisar("Restaurei, mas ainda não consegui salvar. O painel tenta de novo sozinho.", "erro", 6000);
    }
  });

  caixa.replaceChildren(
    h(
      "p",
      { class: "bloco-dica" },
      "Baixa um arquivo com todos os textos, cartas, vales, stories e a ordem de tudo. Se algo for apagado sem querer, dá para voltar. (As fotos, vídeos e músicas ficam guardados no Supabase; o arquivo guarda onde cada um está.)"
    ),
    h("p", { class: "copia-ultima" }, ultima ? `Última cópia baixada neste computador: ${dataHora(ultima)}` : "Ainda não baixaste nenhuma cópia neste computador."),
    h(
      "div",
      { class: "copia-acoes" },
      h("button", { class: "botao-pequeno botao-pequeno--destaque", type: "button", onClick: baixar }, "Baixar cópia agora"),
      entrada,
      h("label", { class: "botao-pequeno", for: "entrada-copia", tabindex: "0", role: "button", onKeydown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          entrada.click();
        }
      } }, "Restaurar uma cópia…")
    )
  );
}

// =====================================================================
// 3. Deixar tudo zerado para ela
// =====================================================================
async function carregarLimpeza(caixa) {
  let resumo;
  try {
    resumo = await resumoDosTestes();
  } catch (erro) {
    console.error((erro && erro.original) || erro);
    caixa.replaceChildren(
      h(
        "p",
        { class: "aviso-erro" },
        erro && erro.codigo === "falta_sql"
          ? "Falta rodar o arquivo 07_limpeza.sql no Supabase (SQL Editor → New query → colar → Run)."
          : "Não consegui ver o que tem de teste agora."
      ),
      h("button", { class: "botao-pequeno", type: "button", onClick: () => carregarLimpeza(caixa) }, "Tentar de novo")
    );
    return;
  }
  desenharLimpeza(caixa, resumo);
}

function opcao(nome, texto, detalhe, marcado, desligado) {
  return h(
    "label",
    { class: `limpar-opcao${desligado ? " limpar-opcao--vazia" : ""}` },
    h("input", { type: "checkbox", name: nome, checked: marcado && !desligado, disabled: desligado }),
    h("span", { class: "limpar-opcao-textos" }, h("span", { class: "limpar-opcao-titulo" }, texto), h("span", { class: "limpar-opcao-detalhe" }, detalhe))
  );
}

function desenharLimpeza(caixa, resumo) {
  const nRecados = resumo.recados || 0;
  const nAudios = resumo.recados_audio || 0;
  const nDela = resumo.lista_dela || 0;
  const nTua = resumo.lista_tua || 0;
  const nCartas = resumo.cartas || 0;
  const abertoEm = resumo.presente_aberto_em || null;

  const oRecados = opcao(
    "recados",
    "Recados",
    nRecados ? `${plural(nRecados, "recado", "recados")}${nAudios ? ` (${plural(nAudios, "áudio", "áudios")})` : ""}` : "Nenhum",
    true,
    !nRecados
  );
  const oCartas = opcao("cartas", "«Cartas que ela abriu»", nCartas ? plural(nCartas, "registro", "registros") : "Nenhum", true, !nCartas);
  const oPresente = opcao("presente", "Fechar a caixa do presente", abertoEm ? `Aberta em ${dataHora(abertoEm)}` : "Já está fechada", true, !abertoEm);

  // Lista dos 365 dias: escolhe entre não mexer, só os escritos no login dela, ou tudo.
  const listaTotal = nDela + nTua;
  const radio = (valor, texto, marcado, desligado) =>
    h(
      "label",
      { class: `limpar-radio${desligado ? " limpar-opcao--vazia" : ""}` },
      h("input", { type: "radio", name: "lista", value: valor, checked: marcado, disabled: desligado }),
      h("span", null, texto)
    );
  const grupoLista = h(
    "fieldset",
    { class: "limpar-lista" },
    h("legend", { class: "limpar-opcao-titulo" }, "Lista «Nossos próximos 365 dias»"),
    h(
      "p",
      { class: "limpar-opcao-detalhe" },
      listaTotal
        ? `${plural(nDela, "item escrito", "itens escritos")} no login dela · ${plural(nTua, "item teu", "itens teus")} (do painel)`
        : "Nenhum item"
    ),
    radio("dela", `Apagar só os escritos no login dela (${nDela})`, Boolean(nDela), !nDela),
    radio("tudo", `Apagar todos (${listaTotal})`, false, !listaTotal),
    radio("nada", "Não mexer na lista", !nDela, false)
  );

  const campoAutorizo = h("input", {
    class: "campo campo--autorizo",
    id: "limpar-autorizo",
    type: "text",
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    placeholder: "AUTORIZO",
  });
  const botao = h("button", { class: "botao botao--perigo limpar-botao", type: "button", disabled: true }, "Limpar agora");
  const erro = h("p", { class: "aviso-erro", "aria-live": "polite" });

  const nadaParaLimpar = !nRecados && !nCartas && !abertoEm && !listaTotal;

  function escolhas() {
    const marcado = (nome) => {
      const i = caixa.querySelector(`input[name="${nome}"]`);
      return Boolean(i && i.checked && !i.disabled);
    };
    const lista = caixa.querySelector('input[name="lista"]:checked');
    return { recados: marcado("recados"), cartas: marcado("cartas"), presente: marcado("presente"), lista: lista ? lista.value : "nada" };
  }

  function algoEscolhido(e) {
    return e.recados || e.cartas || e.presente || e.lista !== "nada";
  }

  function atualizarBotao() {
    botao.disabled = !(campoAutorizo.value.trim().toUpperCase() === "AUTORIZO" && algoEscolhido(escolhas()));
  }

  for (const grupo of [oRecados, grupoLista, oCartas, oPresente]) grupo.addEventListener("change", atualizarBotao);
  campoAutorizo.addEventListener("input", atualizarBotao);
  campoAutorizo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!botao.disabled) botao.click();
    }
  });

  botao.addEventListener("click", async () => {
    const e = escolhas();
    if (!algoEscolhido(e)) return;
    botao.disabled = true;
    botao.textContent = "Limpando…";
    erro.textContent = "";
    try {
      const feito = await limparTestes("AUTORIZO", e);
      if (feito.presente_fechado) marcarPresenteFechado();
      if (e.recados) window.dispatchEvent(new CustomEvent("eni-recados-lidos"));
      const partes = [];
      if (e.recados) partes.push(plural(feito.recados || 0, "recado", "recados"));
      if (e.lista !== "nada") partes.push(plural(feito.lista || 0, "item da lista", "itens da lista"));
      if (e.cartas) partes.push(plural(feito.cartas || 0, "registro de carta", "registros de carta"));
      if (feito.presente_fechado) partes.push("caixa fechada");
      avisar(`Pronto: ${partes.join(", ")}.`, "ok", 6000);
      await carregarLimpeza(caixa);
    } catch (falha) {
      console.error((falha && falha.original) || falha);
      erro.textContent =
        falha && falha.codigo === "rede"
          ? "Sem conexão. Nada foi apagado."
          : falha && falha.codigo === "falta_sql"
            ? "Falta rodar o 07_limpeza.sql no Supabase."
            : "Não consegui limpar. Tenta de novo.";
      botao.textContent = "Limpar agora";
      atualizarBotao();
    }
  });

  if (nadaParaLimpar) {
    caixa.replaceChildren(
      h("p", { class: "limpar-zerado" }, "Tudo zerado. ♥ Nenhum recado, nenhuma carta marcada como aberta, lista vazia e a caixa do presente fechada."),
      h("p", { class: "bloco-dica" }, "Se testares de novo depois, volta aqui e limpa outra vez."),
      h("button", { class: "botao-pequeno", type: "button", onClick: () => carregarLimpeza(caixa) }, "Conferir de novo")
    );
    return;
  }

  caixa.replaceChildren(
    h(
      "p",
      { class: "bloco-dica" },
      "Apaga só o que foi criado testando o site. Stories, cartas, vales, rádio, presente e datas NÃO são tocados. Faz isso por último, depois dos teus testes, para ela encontrar tudo novo. Não dá para desfazer."
    ),
    oRecados,
    grupoLista,
    oCartas,
    oPresente,
    h(
      "div",
      { class: "campo-grupo limpar-confirmar" },
      h("label", { class: "campo-rotulo", for: "limpar-autorizo" }, "Digite AUTORIZO para confirmar"),
      campoAutorizo
    ),
    erro,
    botao
  );
}
