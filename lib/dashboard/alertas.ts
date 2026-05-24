// Sprint 4.0.3 — função pura pra contar alertas de vencimento.
// Recebe lista de PAYABLE/RECEIVABLE PENDING e classifica em janelas.

export interface VencimentoTx {
  id: string
  amount: number
  dueDate: Date | null
}

export interface AlertasResult {
  vencidas: { count: number; total: number }
  vencendoEm3Dias: { count: number; total: number }
  vencendoSemana: { count: number; total: number } // 3-7 dias
  total: { count: number; total: number }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function classifyAlertas(
  txs: VencimentoTx[],
  referenceDate: Date = new Date(),
): AlertasResult {
  const todayMs = startOfDayUTC(referenceDate)
  const result: AlertasResult = {
    vencidas: { count: 0, total: 0 },
    vencendoEm3Dias: { count: 0, total: 0 },
    vencendoSemana: { count: 0, total: 0 },
    total: { count: 0, total: 0 },
  }

  for (const tx of txs) {
    if (!tx.dueDate) continue
    const dueMs = startOfDayUTC(tx.dueDate)
    const daysDiff = Math.floor((dueMs - todayMs) / MS_PER_DAY)

    result.total.count++
    result.total.total += tx.amount

    if (daysDiff < 0) {
      result.vencidas.count++
      result.vencidas.total += tx.amount
    } else if (daysDiff <= 3) {
      result.vencendoEm3Dias.count++
      result.vencendoEm3Dias.total += tx.amount
    } else if (daysDiff <= 7) {
      result.vencendoSemana.count++
      result.vencendoSemana.total += tx.amount
    }
  }

  return result
}
