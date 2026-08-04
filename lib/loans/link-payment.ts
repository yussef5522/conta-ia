// Sprint Casar Pagamento (04/08/2026) — FASE 4/5: split de um GRUPO de lançamentos
// (débito parcial) contra UMA parcela. Identidade validada nos 3 bancos:
//   PAGO = AMORTIZAÇÃO + JUROS + CORREÇÃO + MORA
// AMORTIZAÇÃO vem do cronograma (determinística, fora do DRE). ENCARGOS = pago −
// amortização (o residual: juros+correção+mora), despesa financeira REAL no DRE.
// Puro — sem DB.

import { validateSchedule, type ScheduleRowForValidation } from './validate-schedule'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const TOL = 0.02

export interface LinkSplitInput {
  installment: { amortization: number; openingBalance: number }
  rateMonthly: number
  /** soma dos lançamentos do grupo. */
  paidTotal: number
}

export interface LinkSplit {
  /** amortização aplicada (do cronograma; = pago se parcial). Fora do DRE. */
  amortization: number
  paidInterest: number
  paidCorrection: number
  paidPenalty: number
  paidTotal: number
  /** juros+correção+mora = despesa financeira no DRE. */
  encargos: number
  closingBalance: number
  /** pago < amortização prevista → parcela PARCIAL, não quita. */
  isPartial: boolean
}

export function computeLinkSplit(input: LinkSplitInput): LinkSplit {
  const amortSched = round2(input.installment.amortization)
  const paidTotal = round2(input.paidTotal)
  const opening = round2(input.installment.openingBalance)

  // Parcial: pagou menos que a amortização prevista → tudo vira principal, sem
  // encargos, e a parcela NÃO quita (FASE 4.4).
  if (paidTotal < amortSched - TOL) {
    return {
      amortization: paidTotal, paidInterest: 0, paidCorrection: 0, paidPenalty: 0,
      paidTotal, encargos: 0, closingBalance: round2(opening - paidTotal), isPartial: true,
    }
  }

  const encargos = round2(paidTotal - amortSched)
  // Juros nominais = saldo × taxa; correção+mora = o que sobra dos encargos.
  // Clamp pra ambos >= 0 e soma == encargos (o DRE usa só o total).
  const interest = Math.min(round2(opening * input.rateMonthly), encargos)
  const correcao = round2(encargos - interest)
  return {
    amortization: amortSched, paidInterest: interest, paidCorrection: correcao, paidPenalty: 0,
    paidTotal, encargos, closingBalance: round2(opening - amortSched), isPartial: false,
  }
}

/**
 * A agenda ARMAZENADA do empréstimo (faixa rastreada) fecha? Decide se o split
 * flui pro DRE (FASE 5.3): agenda inválida → vincula mas não injeta split.
 */
export function storedScheduleValid(
  trackedInstallments: ScheduleRowForValidation[],
  base: number,
  ratePositive: boolean,
  isPostFixed: boolean,
): boolean {
  if (trackedInstallments.length === 0) return false
  return validateSchedule({ rows: trackedInstallments, base, ratePositive, isPostFixed }).ok
}
