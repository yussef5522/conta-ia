// Cálculo de saldo a partir de transações signed (já preparadas por prepare.ts).
// Sprint 0.5 Dia 3 — função PURA.
//
// Saídas:
//   current             saldo final (acumulado a partir de 0)
//   available           current + creditLimit (quanto ainda pode sair)
//   inNegativeSince     data da PRIMEIRA transação numa RUN contínua de saldo < 0
//                       que termina no presente. Resetar se voltar a ≥ 0.
//                       null se conta não está negativa hoje.
//   daysInNegative      dias entre inNegativeSince e referenceDate (0 se positiva)
//   lowestBalance       pior saldo durante o período (incluindo após referenceDate? não — só até)
//   lowestBalanceDate   data em que ocorreu o lowestBalance

import type { SignedBalanceTransaction } from './prepare'

export interface CalculateBalanceResult {
  current: number
  available: number
  inNegativeSince: Date | null
  daysInNegative: number
  lowestBalance: number
  lowestBalanceDate: Date | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function calculateBalance(
  signedTxs: SignedBalanceTransaction[],
  creditLimit: number,
  referenceDate: Date = new Date(),
): CalculateBalanceResult {
  if (creditLimit < 0) {
    throw new Error('creditLimit deve ser >= 0')
  }

  // Ordena ASC por data (estável: se mesma data, mantém ordem original)
  const sorted = [...signedTxs].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )

  let running = 0
  let lowestBalance = 0
  let lowestBalanceDate: Date | null = null
  // "Run" atual de saldo negativo: data da transação que iniciou a run mais recente.
  // Reseta toda vez que running volta a ≥ 0.
  let currentNegativeRunStart: Date | null = null

  for (const tx of sorted) {
    const wasNegative = running < 0
    running += tx.signedAmount
    const isNegative = running < 0

    if (!wasNegative && isNegative) {
      // Transitou de ≥0 pra <0: começou nova run
      currentNegativeRunStart = tx.date
    } else if (wasNegative && !isNegative) {
      // Voltou a ≥0: encerra run
      currentNegativeRunStart = null
    }

    if (lowestBalanceDate === null || running < lowestBalance) {
      lowestBalance = running
      lowestBalanceDate = tx.date
    }
  }

  const current = running
  const available = current + creditLimit

  let inNegativeSince: Date | null = null
  let daysInNegative = 0
  if (current < 0 && currentNegativeRunStart) {
    inNegativeSince = currentNegativeRunStart
    const refMs = referenceDate.getTime()
    const startMs = currentNegativeRunStart.getTime()
    // Math.max(0, ...) por segurança caso runStart > referenceDate
    daysInNegative = Math.max(0, Math.floor((refMs - startMs) / MS_PER_DAY))
  }

  return {
    current,
    available,
    inNegativeSince,
    daysInNegative,
    lowestBalance,
    lowestBalanceDate,
  }
}
