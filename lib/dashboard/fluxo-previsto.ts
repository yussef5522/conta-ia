// Sprint 4.0.3 — função pura pra calcular Fluxo Previsto 30/60/90 dias.
// Recebe lista de PAYABLE + RECEIVABLE pendentes e saldo atual.

export interface PendenteTx {
  id: string
  amount: number
  dueDate: Date | null
  lifecycle: 'PAYABLE' | 'RECEIVABLE'
}

export interface FluxoPrevistoBucket {
  days: 30 | 60 | 90
  receitasPrevistas: { count: number; total: number }
  despesasPrevistas: { count: number; total: number }
  resultadoPrevisto: number
  saldoProjetado: number
}

export interface FluxoPrevistoResult {
  saldoAtual: number
  buckets: FluxoPrevistoBucket[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function computeFluxoPrevisto(
  pendentes: PendenteTx[],
  saldoAtual: number,
  referenceDate: Date = new Date(),
): FluxoPrevistoResult {
  const todayMs = startOfDayUTC(referenceDate)
  const buckets: FluxoPrevistoBucket[] = [30, 60, 90].map((days) => {
    const horizonMs = todayMs + days * MS_PER_DAY

    let receitasCount = 0
    let receitasTotal = 0
    let despesasCount = 0
    let despesasTotal = 0

    for (const tx of pendentes) {
      if (!tx.dueDate) continue
      const dueMs = startOfDayUTC(tx.dueDate)
      // Janela: hoje até horizon (inclusive). Vencidas (dueMs < today) NÃO entram aqui —
      // alertas as cobre separadamente.
      if (dueMs < todayMs || dueMs > horizonMs) continue

      if (tx.lifecycle === 'RECEIVABLE') {
        receitasCount++
        receitasTotal += tx.amount
      } else {
        despesasCount++
        despesasTotal += tx.amount
      }
    }

    const resultadoPrevisto = receitasTotal - despesasTotal
    const saldoProjetado = saldoAtual + resultadoPrevisto

    return {
      days: days as 30 | 60 | 90,
      receitasPrevistas: { count: receitasCount, total: receitasTotal },
      despesasPrevistas: { count: despesasCount, total: despesasTotal },
      resultadoPrevisto,
      saldoProjetado,
    }
  })

  return { saldoAtual, buckets }
}
