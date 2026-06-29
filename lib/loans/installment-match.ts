// Sprint Pagamento Parcela Redesign (28/06/2026, nível Xero/QuickBooks).
//
// Lib PURA reusada por:
//   - GET /parcelas/[n]/candidatos (lista candidatos com confidenceScore)
//   - POST /parcelas/[n] (recalcula juros/correcao/closing quando pos-fixado)
//   - UI ConfirmarPagamentoDialog (breakdown "como fica nos livros")
//
// Regra contábil (CFC/STJ): pagamento de parcela divide em:
//   - amortização (principal) → FORA do DRE (abate dívida no balanço)
//   - juros contratuais → DESPESA FINANCEIRA no DRE
//   - correção CDI/IPCA (pós-fixado) → DESPESA FINANCEIRA no DRE
//                                       (STJ: CDI é juros na essência)
// → Total despesa financeira = juros + correcao

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface InstallmentForMatch {
  /** Valor planejado da parcela (R$) */
  payment: number
  /** Juros planejados (R$) — base contratual */
  interest: number
  /** Amortização do contrato (R$) — fixa em SAC */
  amortization: number
  /** Saldo devedor antes desta parcela (R$) */
  openingBalance: number
  /** true = pós-fixado (CDI/IPCA — valor real pode divergir do planejado) */
  isEstimate: boolean
  /** Data esperada de pagamento (ISO ou Date) */
  dueDate: Date
}

export interface TxForMatch {
  amount: number
  date: Date
  type: 'DEBIT' | 'CREDIT' | string
  origin: string
}

/**
 * Tolerâncias por tipo de contrato (Sprint Pagamento Parcela Redesign).
 *
 * - Pré-fixado (isEstimate=false): valor planejado é o que cai. Tolerância apertada (±R$ 1).
 * - Pós-fixado (isEstimate=true): CDI/IPCA varia, valor real ≥ planejado. Tolerância expandida
 *   pra cima (até payment × 1.25) e leve pra baixo (payment − R$ 1, raramente diminui).
 */
export const PRE_FIXED_AMOUNT_TOL_ABS = 1.0
export const POS_FIXED_AMOUNT_TOL_PCT = 0.25 // +25% pra cima
export const DATE_WINDOW_DAYS = 7

/**
 * Verifica se uma tx cabe na janela de match pra esta parcela.
 * Tolerância depende do isEstimate da parcela.
 */
export function isTxInMatchWindow(
  installment: Pick<InstallmentForMatch, 'payment' | 'dueDate' | 'isEstimate'>,
  tx: Pick<TxForMatch, 'amount' | 'date' | 'type'>,
  opts: { dateWindowDays?: number } = {},
): boolean {
  if (tx.type !== 'DEBIT') return false
  const windowDays = opts.dateWindowDays ?? DATE_WINDOW_DAYS

  const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
  const due = installment.dueDate instanceof Date ? installment.dueDate : new Date(installment.dueDate)
  const dateDiffMs = Math.abs(txDate.getTime() - due.getTime())
  if (dateDiffMs > windowDays * 86400_000) return false

  const minAmount = installment.payment - PRE_FIXED_AMOUNT_TOL_ABS
  const maxAmount = installment.isEstimate
    ? installment.payment * (1 + POS_FIXED_AMOUNT_TOL_PCT)
    : installment.payment + PRE_FIXED_AMOUNT_TOL_ABS

  return tx.amount >= minAmount && tx.amount <= maxAmount
}

export interface MatchConfidence {
  /** 0.0 a 1.0 */
  score: number
  /** Rótulo legível pra UI: "Tenho certeza" | "Confira" | "Confira com atenção" */
  label: 'Tenho certeza' | 'Confira' | 'Confira com atenção'
  /** Evidências que somaram o score */
  evidences: string[]
}

/**
 * Calcula confidence do match parcela ↔ tx.
 *
 * Sinais:
 *   +0.50 base: já passou na janela (caller garantiu)
 *   +0.20 data exata (dueDate)
 *   +0.15 valor exato (diff ≤ R$ 0,50)
 *   +0.10 diff dentro da tolerância pos-fixado mas explicável como CDI
 *  -0.10 diff > 10% pra baixo (suspeito: paga menos que planejado raramente acontece)
 */
export function computeMatchConfidence(
  installment: Pick<InstallmentForMatch, 'payment' | 'dueDate' | 'isEstimate'>,
  tx: Pick<TxForMatch, 'amount' | 'date'>,
): MatchConfidence {
  const evidences: string[] = []
  let score = 0.5

  const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
  const due = installment.dueDate instanceof Date ? installment.dueDate : new Date(installment.dueDate)
  const daysDiff = Math.abs(
    Math.round((txDate.getTime() - due.getTime()) / 86400_000),
  )

  if (daysDiff === 0) {
    score += 0.2
    evidences.push('Mesma data do vencimento')
  } else if (daysDiff <= 3) {
    score += 0.1
    evidences.push(`${daysDiff} dia(s) do vencimento`)
  } else {
    evidences.push(`Δ ${daysDiff} dias do vencimento`)
  }

  const amountDiff = tx.amount - installment.payment
  const absAmountDiff = Math.abs(amountDiff)
  const pctDiff = installment.payment > 0 ? amountDiff / installment.payment : 0

  if (absAmountDiff <= 0.5) {
    score += 0.15
    evidences.push('Valor exato')
  } else if (installment.isEstimate && amountDiff > 0 && pctDiff <= 0.10) {
    score += 0.1
    evidences.push(`+${(pctDiff * 100).toFixed(1)}% — provável correção CDI`)
  } else if (installment.isEstimate && amountDiff > 0 && pctDiff <= 0.25) {
    score += 0.05
    evidences.push(`+${(pctDiff * 100).toFixed(1)}% — correção CDI alta, confirmar`)
  } else if (amountDiff < 0 && Math.abs(pctDiff) > 0.10) {
    score -= 0.1
    evidences.push(`Pagamento −${(Math.abs(pctDiff) * 100).toFixed(1)}% abaixo (incomum)`)
  } else {
    evidences.push(`Δ R$ ${amountDiff.toFixed(2)}`)
  }

  // Clamp 0-1
  score = Math.max(0, Math.min(1, score))

  const label: MatchConfidence['label'] =
    score >= 0.85 ? 'Tenho certeza' : score >= 0.65 ? 'Confira' : 'Confira com atenção'

  return { score, label, evidences }
}

export interface PosFixedSplit {
  /** Valor real pago = tx.amount */
  realPayment: number
  /** Juros base do contrato (R$) — openingBalance × rateMonthly */
  interest: number
  /** Correção CDI (R$) — diferença entre real e (juros + amortização) */
  correcao: number
  /** Saldo devedor pós-parcela (R$) */
  closingBalance: number
  /** Despesa financeira no DRE = juros + correcao */
  totalDespesaFinanceira: number
}

/**
 * Calcula split contábil pra parcela PÓS-FIXADA (isEstimate=true).
 *
 * SAC (Sistema de Amortização Constante):
 *   - amortização é FIXA pelo contrato
 *   - juros base é openingBalance × rateMonthly (planejado)
 *   - correção CDI = realPayment − amortização − juros base (diferença pro CDI)
 *   - closingBalance = openingBalance − amortização (não afeta CDI — só zera amort)
 *
 * STJ: "CDI sobre empréstimo é juros na essência" → entra como Despesa Financeira no DRE.
 */
export function computePosFixedSplit(
  installment: Pick<InstallmentForMatch, 'amortization' | 'openingBalance'>,
  realPayment: number,
  rateMonthly: number,
): PosFixedSplit {
  const interest = round2(installment.openingBalance * rateMonthly)
  const correcao = round2(realPayment - installment.amortization - interest)
  const closingBalance = round2(installment.openingBalance - installment.amortization)
  const totalDespesaFinanceira = round2(interest + correcao)
  return {
    realPayment: round2(realPayment),
    interest,
    correcao,
    closingBalance,
    totalDespesaFinanceira,
  }
}

/**
 * Calcula split contábil pra parcela PRÉ-FIXADA (isEstimate=false).
 *
 * Valores planejados são os reais (juros + amortização fixados pelo contrato).
 * Correção = 0 (não aplica).
 */
export function computePreFixedSplit(
  installment: Pick<InstallmentForMatch, 'interest' | 'amortization' | 'payment' | 'openingBalance'>,
): PosFixedSplit {
  return {
    realPayment: round2(installment.payment),
    interest: round2(installment.interest),
    correcao: 0,
    closingBalance: round2(installment.openingBalance - installment.amortization),
    totalDespesaFinanceira: round2(installment.interest),
  }
}
