// =====================================================================
// Entre Mil Instantes · site/memoria.js
// Pequenas lembranças guardadas só neste celular (vales raspados,
// cartas lidas, se ela já viu tudo…). Na pré-visualização usa outra
// gaveta, para não misturar com o que ela fizer.
// =====================================================================

let previa = false;

export function definirPrevia(valor) {
  previa = Boolean(valor);
}

export function ehPrevia() {
  return previa;
}

const chave = (nome) => (previa ? `eni-previa-${nome}` : `eni-${nome}`);

export function lerMemoria(nome, padrao) {
  try {
    const bruto = localStorage.getItem(chave(nome));
    return bruto == null ? padrao : JSON.parse(bruto);
  } catch {
    return padrao;
  }
}

export function guardarMemoria(nome, valor) {
  try {
    localStorage.setItem(chave(nome), JSON.stringify(valor));
  } catch {
    /* navegação anônima pode bloquear: tudo bem */
  }
}

// Conjuntos de ids (ex.: cartas já lidas)
export function lerConjunto(nome) {
  const lista = lerMemoria(nome, []);
  return new Set(Array.isArray(lista) ? lista : []);
}

export function guardarConjunto(nome, conjunto) {
  guardarMemoria(nome, [...conjunto]);
}
