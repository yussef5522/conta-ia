// Sprint Contraparte PIX (31/07/2026) — normalização de nome de contraparte.
// Usado pra (1) agrupar nomes divergentes na detecção de ambiguidade e (2) casar
// regras "contraparte X → categoria Y" mesmo com maiúsc/minúsc, acento, espaço
// duplo e TRUNCAMENTO do banco (ex: "...COLCHOES LT" sem o "DA").

export function normalizeCounterparty(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (combining marks)
    .toUpperCase()
    .replace(/[.,;:]/g, ' ') // pontuação vira espaço
    .replace(/\s+/g, ' ') // colapsa espaços
    .trim()
}

/**
 * Dois nomes "batem" pra fins de regra mesmo com truncamento do banco:
 * um é prefixo do outro (após normalizar). Ex.:
 *   "GRUBERT E BRAGA COMERCIO DE COLCHOES LT" ~ "GRUBERT E BRAGA COMERCIO DE COLCHOES LTDA"
 */
export function counterpartyMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeCounterparty(a)
  const nb = normalizeCounterparty(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na]
  // prefixo com pelo menos 8 chars pra evitar falso-positivo em nomes curtos
  return short.length >= 8 && long.startsWith(short)
}
