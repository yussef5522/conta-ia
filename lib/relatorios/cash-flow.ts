// Sprint 5.0.4.0b Fase 3 — Funções puras do Fluxo de Caixa relatório.
//
// REALIZADO: reusa calculateConsolidatedCashflow (Sprint 0.5 Dia 3).
//   - Bucket month por padrão
//   - IGNORA TRANSFER + dreGroup=TRANSFERENCIA (defesa em profundidade)
//
// PREVISTO (projeção 30/60/90): função pura nova que recebe
//   PAYABLE/RECEIVABLE não pagos vencendo no range.

export interface ProjectionInputTx {
  type: 'CREDIT' | 'DEBIT' | string
  amount: number
  dueDate: Date
}

export interface ProjectionBucket {
  /** "30d" | "60d" | "90d" */
  id: '30d' | '60d' | '90d'
  label: string
  entradas: number
  saidas: number
  resultado: number
}

export interface CashFlowProjectionResult {
  buckets: ProjectionBucket[]
  total: {
    entradas: number
    saidas: number
    resultado: number
  }
}

/**
 * Calcula projeção 30/60/90 dias a partir de transações PAYABLE/RECEIVABLE
 * NÃO pagas (paymentDate IS NULL) com dueDate dentro do range.
 *
 * - 30d bucket = vencimentos próximos 30 dias
 * - 60d bucket = vencimentos próximos 60 dias (cumulativo)
 * - 90d bucket = vencimentos próximos 90 dias (cumulativo)
 *
 * CREDIT = entrada, DEBIT = saída. TRANSFER é IGNORADO.
 *
 * `referenceDate` é o dia "hoje" — buckets contam a partir dele (exclusivo).
 */
export function computeCashFlowProjection(
  txs: ProjectionInputTx[],
  referenceDate: Date = new Date(),
): CashFlowProjectionResult {
  const today = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  )
  const day30 = new Date(today.getTime() + 30 * 86_400_000)
  const day60 = new Date(today.getTime() + 60 * 86_400_000)
  const day90 = new Date(today.getTime() + 90 * 86_400_000)

  let e30 = 0,
    s30 = 0,
    e60 = 0,
    s60 = 0,
    e90 = 0,
    s90 = 0

  for (const t of txs) {
    if (t.type === 'TRANSFER') continue
    const due = t.dueDate.getTime()
    if (due <= today.getTime()) continue

    if (due <= day30.getTime()) {
      if (t.type === 'CREDIT') e30 += t.amount
      else if (t.type === 'DEBIT') s30 += t.amount
    }
    if (due <= day60.getTime()) {
      if (t.type === 'CREDIT') e60 += t.amount
      else if (t.type === 'DEBIT') s60 += t.amount
    }
    if (due <= day90.getTime()) {
      if (t.type === 'CREDIT') e90 += t.amount
      else if (t.type === 'DEBIT') s90 += t.amount
    }
  }

  return {
    buckets: [
      {
        id: '30d',
        label: 'Próximos 30 dias',
        entradas: e30,
        saidas: s30,
        resultado: e30 - s30,
      },
      {
        id: '60d',
        label: 'Próximos 60 dias',
        entradas: e60,
        saidas: s60,
        resultado: e60 - s60,
      },
      {
        id: '90d',
        label: 'Próximos 90 dias',
        entradas: e90,
        saidas: s90,
        resultado: e90 - s90,
      },
    ],
    total: {
      entradas: e90,
      saidas: s90,
      resultado: e90 - s90,
    },
  }
}

/**
 * Computa o saldo acumulado por mês a partir dos buckets ordenados.
 * Recebe array de { bucketStart, net } e retorna array com saldo acumulado
 * em cada bucket, partindo do `saldoInicial`.
 *
 * Usado pra desenhar a linha "saldo acumulado" sobre as barras do gráfico.
 */
export interface AccumBucket {
  bucketKey: string
  net: number
  saldoAcumulado: number
}

export function computeAccumulatedBalance(
  byPeriod: Array<{ bucketStart: Date; net: number }>,
  saldoInicial = 0,
): AccumBucket[] {
  let acc = saldoInicial
  return byPeriod.map((b) => {
    acc += b.net
    return {
      bucketKey: b.bucketStart.toISOString().slice(0, 7),
      net: b.net,
      saldoAcumulado: acc,
    }
  })
}
