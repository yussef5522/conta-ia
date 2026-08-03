// Sprint Enriquecer entry (03/08/2026) — detecção read-only do "gap de contraparte":
// transações de transferência (PIX/TED/DOC) que ainda estão SEM o nome de quem
// recebeu/pagou. Alimenta o banner que leva pra tela de enriquecimento por PDF.
// Puro e determinístico — não grava nada, não olha o banco.
//
// Regra: elegível = é transferência de pessoa (PIX/TED/DOC) E NÃO é tarifa/imposto.
// Tarifa (ex "TARIFA PIX") e IOF são cobrança do banco — não têm favorecido a
// preencher, então NÃO contam (senão o banner mente sobre quantos dá pra enriquecer).

/** Transferência com favorecido/pagador: PIX, TED, DOC. */
export const COUNTERPARTY_ELIGIBLE_RE = /\b(PIX|TED|DOC)\b/i
/** Cobrança do banco (sem favorecido): tarifa/IOF — exclui do gap. */
export const COUNTERPARTY_FEE_RE = /\bTARIFA\b|\bTAR\b|\bIOF\b/i

export interface GapTx {
  description: string | null
  counterpartyName: string | null
}

/** É uma tx de transferência elegível a ter contraparte (e não é tarifa)? */
export function isCounterpartyEligible(description: string | null | undefined): boolean {
  const d = description ?? ''
  return COUNTERPARTY_ELIGIBLE_RE.test(d) && !COUNTERPARTY_FEE_RE.test(d)
}

/** Quantas tx elegíveis (PIX/TED/DOC) ainda estão SEM contraparte identificada. */
export function countCounterpartyGap(txs: GapTx[]): number {
  let n = 0
  for (const t of txs) {
    if (t.counterpartyName) continue // já identificada
    if (isCounterpartyEligible(t.description)) n++
  }
  return n
}
