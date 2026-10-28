// =====================================================================
// Entre Mil Instantes · site/datas.js
// Contas com datas, sempre no horário de Brasília (America/Sao_Paulo).
// Funções "puras": não mexem na página, só calculam.
// =====================================================================

const FUSO = "America/Sao_Paulo";
const UM_DIA = 24 * 60 * 60 * 1000;

// Dia de hoje em Brasília: { ano, mes, dia }.
export function hojeEmBrasilia(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const pegar = (tipo) => Number(partes.find((p) => p.type === tipo).value);
  return { ano: pegar("year"), mes: pegar("month"), dia: pegar("day") };
}

// "2025-05-19" → { ano: 2025, mes: 5, dia: 19 } (ou null se vier errado).
export function lerDataISO(texto) {
  const certo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || "").trim());
  if (!certo) return null;
  const data = { ano: Number(certo[1]), mes: Number(certo[2]), dia: Number(certo[3]) };
  return dataExiste(data) ? data : null;
}

function numeroDoDia({ ano, mes, dia }) {
  return Math.round(Date.UTC(ano, mes - 1, dia) / UM_DIA);
}

export function dataExiste({ ano, mes, dia }) {
  if (!ano || !mes || !dia || mes < 1 || mes > 12 || dia < 1) return false;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia <= ultimoDia;
}

// Quantos dias se passaram desde uma data até hoje.
export function diasDesde(iso, hoje = hojeEmBrasilia()) {
  const inicio = lerDataISO(iso);
  if (!inicio) return 0;
  return Math.max(0, numeroDoDia(hoje) - numeroDoDia(inicio));
}

// Quantos meses completos se passaram (conta o mêsversário).
export function mesesDesde(iso, hoje = hojeEmBrasilia()) {
  const inicio = lerDataISO(iso);
  if (!inicio) return 0;
  let meses = (hoje.ano - inicio.ano) * 12 + (hoje.mes - inicio.mes);
  if (hoje.dia < inicio.dia) meses -= 1;
  return Math.max(0, meses);
}

// "2025-05-19" → "19·05·2025"
export function dataCurta(iso, separador = "·") {
  const data = lerDataISO(iso);
  if (!data) return "";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(data.dia)}${separador}${dois(data.mes)}${separador}${data.ano}`;
}

// Milissegundos → { dias, horas, minutos, segundos } (nunca negativo).
export function partesDoTempo(ms) {
  let resto = Math.max(0, Math.floor(ms / 1000));
  const dias = Math.floor(resto / 86400);
  resto -= dias * 86400;
  const horas = Math.floor(resto / 3600);
  resto -= horas * 3600;
  const minutos = Math.floor(resto / 60);
  const segundos = resto - minutos * 60;
  return { dias, horas, minutos, segundos };
}

// ---------------------------------------------------------------------
// Campo da senha (data dd/mm/aaaa)
// ---------------------------------------------------------------------

// Só os números, no máximo 8.
export function somenteNumeros(texto) {
  return String(texto || "").replace(/\D/g, "").slice(0, 8);
}

// "19052025" → "19/05/2025" (vai formando enquanto digita).
export function mascararData(numeros) {
  const n = somenteNumeros(numeros);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

// "19052025" é uma data que existe? (evita gastar tentativa com 31/02)
export function numerosFormamData(numeros) {
  const n = somenteNumeros(numeros);
  if (n.length !== 8) return false;
  return dataExiste({
    dia: Number(n.slice(0, 2)),
    mes: Number(n.slice(2, 4)),
    ano: Number(n.slice(4, 8)),
  });
}
