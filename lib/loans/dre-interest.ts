// Sprint DRE-Represado (14/08/2026): construção ÚNICA das transações de juros de
// empréstimo que entram no DRE.
// ⛔⛔ R54 (25/11/2026) — UMA FONTE SÓ: os encargos APURADOS (paidInterest+paidCorrection+
// paidPenalty). O caminho 1:1, que lia `interest+correcao` da AGENDA, morreu junto com a
// porta 1:1 — eram duas réguas pro mesmo fato.
// Extraído de `app/api/empresas/[id]/dre/route.ts` pra ter DONO ÚNICO + teste
// (REGRA 4/5: a mesma decisão em 2 lugares vira função, não cópia por caminho).
//
// REPRESAR (dreHeld): parcela com `dreHeld=true` tem o juros GRAVADO mas NÃO
// entra no DRE (mês fechado, represado até o contador liberar). O flag só
// liga/desliga a CONTAGEM — a competência segue a data da tx/paidDate; soltar
// (flip pra false) reapresenta o juros na competência ORIGINAL, nunca no mês do
// flip.

/** Transação sintética de juros que o engine do DRE consome (usa
 *  `loanInterestSplit` como valor efetivo). */
export interface DreInterestTx {
  id: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
  amount: number
  date: Date
  competenceDate: Date | null
  paymentDate: Date | null
  categoryId: string
  isCardPayment: boolean
  pendingTransfer: boolean
  loanInterestSplit: number
}

/** Linha do caminho N:1 — parcela paga por ponte, com encargos reais. */
export interface LoanN1Row {
  id: string
  paidDate: Date | null
  paidInterest: number | null
  paidCorrection: number | null
  paidPenalty: number | null
  dreHeld: boolean
}

/** Caminho N:1 → encargos reais = paidInterest + paidCorrection + paidPenalty. */
export function buildLoanN1InterestTx(
  rows: LoanN1Row[],
  jurosCategoryId: string,
): DreInterestTx[] {
  const out: DreInterestTx[] = []
  for (const inst of rows) {
    // Represado: encargos gravados na parcela mas fora do DRE (mês fechado).
    if (inst.dreHeld) continue
    const encargos =
      (inst.paidInterest ?? 0) + (inst.paidCorrection ?? 0) + (inst.paidPenalty ?? 0)
    if (encargos <= 0 || !inst.paidDate) continue
    out.push({
      id: `loan-n1-${inst.id}`,
      type: 'DEBIT',
      amount: encargos,
      date: inst.paidDate,
      competenceDate: inst.paidDate,
      paymentDate: inst.paidDate,
      categoryId: jurosCategoryId,
      isCardPayment: false,
      pendingTransfer: false,
      loanInterestSplit: encargos,
    })
  }
  return out
}
