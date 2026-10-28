// =====================================================================
// Entre Mil Instantes · painel/diagnostico.js (só da fase 0)
// Confere se o config.js, o banco e as duas contas estão funcionando.
// =====================================================================

import { CONFIG, configPreenchido } from "../config.js";
import {
  supabase,
  obterLiberacao,
  entrarComoAdmin,
  entrarComoConvidada,
  meuPapel,
  obterConteudo,
  sair,
} from "../supabase.js";

function marcar(id, estado, detalhe) {
  const item = document.getElementById(id);
  item.dataset.estado = estado;
  item.querySelector(".diag-detalhe").textContent = detalhe;
}

function formatarData(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CONFIG.FUSO,
    dateStyle: "long",
    timeStyle: "short",
  }).format(data);
}

// 1 e 2: config e banco
async function testarBase() {
  if (!configPreenchido()) {
    marcar("d-config", "erro", "Abre o js/config.js e cola a Project URL e a Publishable key.");
    marcar("d-banco", "erro", "Precisa do item 1 primeiro.");
    return;
  }
  marcar("d-config", "ok", CONFIG.SUPABASE_URL);

  marcar("d-banco", "testando", "Conectando…");
  try {
    const liberacao = await obterLiberacao();
    marcar("d-banco", "ok", `O site abre para ela em ${formatarData(liberacao)}.`);
  } catch (erro) {
    console.error(erro.original || erro);
    marcar(
      "d-banco",
      "erro",
      `${erro.message} Confere se rodaste o 01_estrutura.sql e se a URL e a chave estão certas.`
    );
  }
}

// 3: conta de admin
document.getElementById("form-admin").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const email = document.getElementById("admin-email").value.trim();
  const senha = document.getElementById("admin-senha").value;
  if (!email || !senha) return;

  marcar("d-admin", "testando", "Entrando…");
  try {
    await entrarComoAdmin(email, senha);
    const papel = await meuPapel();
    if (papel === "admin") {
      const conteudo = await obterConteudo();
      marcar("d-admin", "ok", `Entrou como admin. O banco respondeu (${Object.keys(conteudo).length} itens publicados).`);
    } else {
      marcar("d-admin", "erro", "A senha funcionou, mas a conta não tem o papel de admin. Roda o SQL dos papéis.");
    }
  } catch (erro) {
    console.error(erro.original || erro);
    marcar("d-admin", "erro", erro.message);
  } finally {
    await sair().catch(() => {});
    document.getElementById("admin-senha").value = "";
  }
});

// 4: conta dela
document.getElementById("form-convidada").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const numeros = document.getElementById("convidada-senha").value.replace(/\D/g, "");
  if (numeros.length !== 8) {
    marcar("d-convidada", "erro", "Digita exatamente 8 números (ddmmaaaa).");
    return;
  }

  marcar("d-convidada", "testando", "Entrando…");
  try {
    await entrarComoConvidada(numeros);
    const papel = await meuPapel();
    if (papel !== "convidada") {
      marcar("d-convidada", "erro", "A senha funcionou, mas a conta não tem o papel de convidada. Roda o SQL dos papéis.");
      return;
    }
    // Antes do dia 3 o banco DEVE recusar o conteúdo para ela.
    try {
      await obterConteudo();
      marcar("d-convidada", "ok", "Entrou como convidada. O site já está liberado para ela.");
    } catch (erro) {
      if (erro.codigo === "sem_acesso") {
        marcar("d-convidada", "ok", "Entrou como convidada e o banco bloqueou o conteúdo até o dia 3. Perfeito.");
      } else {
        throw erro;
      }
    }
  } catch (erro) {
    console.error(erro.original || erro);
    marcar("d-convidada", "erro", erro.message);
  } finally {
    await sair().catch(() => {});
    document.getElementById("convidada-senha").value = "";
  }
});

// Começa limpo, sem ninguém logado.
await supabase.auth.signOut().catch(() => {});
testarBase();
