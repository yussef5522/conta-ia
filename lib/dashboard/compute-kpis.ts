// Função PURA que agrega dados em KPIs do Hero Strip.
// Sprint 1 Dia 1 — testável sem DB.
//
// IMPORTANTE: caller (lib/dashboard/queries.ts) é responsável por:
//   - Filtrar transações por companyId (isolamento multi-tenant)
//   - Filtrar `type: { not: 'TRANSFER' }` quando necessário (DRE/sparklines)
//   - Carregar TODAS as categorias da empresa (engine DRE precisa)

import { calculateDRE } from '@/lib/dre/calculator'
import type {
  TransactionForDRE,
  CategoryForDRE,
} from '@/lib/dre/types'
import { calculateConsolidatedCashflow } from '@/lib/cashflow/consolidated'
import type { CashflowTransaction } from '@/lib/cashflow/consolidated'
import type { DashboardPeriods } from './period'
import type { HeroKPIsResult, KPIDelta, SparkPoint } from './types'

export interface ComputeKPIsInput {
  companyId: string
  referenceDate: Date
  periods: DashboardPeriods

  // Saldo atual: soma de BankAccount.balance (cache do banco)
  accountsBalanceTotal: number

  // Categorias da empresa (pra DRE)
  categories: CategoryForDRE[]

  // Transações pro DRE (período current + previous, TRANSFER excluído)
  transactionsForDRE: TransactionForDRE[]

  // Transações dos últimos 30 dias (sparkline saldo cumulativo)
  // SEM TRANSFER pra não inflar; o saldo cumulativo aqui é "fluxo líquido", não saldo real por conta
  transactionsLast30d: CashflowTransaction[]

  // Transações dos últimos 12 meses (sparkline receita/despesa mensal)
  transactionsLast12m: CashflowTransaction[]
}

export function computeKPIsFromData(input: ComputeKPIsInput): HeroKPIsResult {
  if (!input.companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  // ============================================================
  // 1. DRE do mês atual + comparação com mês anterior
  // ============================================================
  const dre = calculateDRE(input.transactionsForDRE, input.categories, {
    period: {
      startDate: input.periods.currentMonth.start,
      endDate: input.periods.currentMonth.end,
      regime: 'competence',
    },
    comparison: { type: 'previous_period' },
  })

  // Valores brutos do mês corrente
  const receitaAtual = dre.totals.receitaBruta
  const despesasAtual =
    dre.totals.totalCustos + dre.totals.totalDespesasOperacionais
  const resultadoAtual = dre.totals.lucroLiquido

  // Pra os deltas absolutos, recalcula DRE do mês anterior sozinho.
  // O `dre.totalsComparison` traz delta só de receitaLiquida/lucroLiquido.
  // Precisamos também de despesas — mais simples reusar calculateDRE.
  const drePrev = calculateDRE(input.transactionsForDRE, input.categories, {
    period: {
      startDate: input.periods.previousMonth.start,
      endDate: input.periods.previousMonth.end,
      regime: 'competence',
    },
  })
  const receitaPrev = drePrev.totals.receitaBruta
  const despesasPrev =
    drePrev.totals.totalCustos + drePrev.totals.totalDespesasOperacionais
  const resultadoPrev = drePrev.totals.lucroLiquido

  // ============================================================
  // 2. Sparkline saldo cumulativo 30 dias
  // ============================================================
  // Fluxo de caixa consolidado por dia, depois transformamos em saldo cumulativo
  // partindo do saldo atual e voltando no tempo (sparkline mostra evolução até hoje).
  const cashflow30d = calculateConsolidatedCashflow(
    input.transactionsLast30d,
    {
      startDate: input.periods.last30Days.start,
      endDate: input.periods.last30Days.end,
      groupBy: 'day',
    },
    input.companyId,
  )

  // Saldo cumulativo: começa do saldo de hoje e desconta net de cada dia indo pra trás
  // Resultado: sequência de saldos por dia (do dia 30 atrás até hoje)
  const saldoSpark = buildCumulativeBalanceSpark(
    input.accountsBalanceTotal,
    cashflow30d.byPeriod.map((b) => ({ date: b.bucketStart, net: b.net })),
    input.periods.last30Days,
  )

  // ============================================================
  // 3. Sparkline receita 12 meses (mensal)
  // ============================================================
  const cashflow12m = calculateConsolidatedCashflow(
    input.transactionsLast12m,
    {
      startDate: input.periods.last12Months.start,
      endDate: input.periods.last12Months.end,
      groupBy: 'month',
    },
    input.companyId,
  )

  // 12 buckets fixos (mesmo se vazio)
  const receitaSpark = build12MonthSpark(
    cashflow12m.byPeriod.map((b) => ({ date: b.bucketStart, value: b.income })),
    input.periods.last12Months,
  )
  const despesasSpark = build12MonthSpark(
    cashflow12m.byPeriod.map((b) => ({ date: b.bucketStart, value: b.expense })),
    input.periods.last12Months,
  )
  const resultadoSpark = build12MonthSpark(
    cashflow12m.byPeriod.map((b) => ({ date: b.bucketStart, value: b.net })),
    input.periods.last12Months,
  )

  // ============================================================
  // 4. Margem líquida (% sobre receita bruta)
  // ============================================================
  const margemLiquida = receitaAtual !== 0 ? (resultadoAtual / receitaAtual) * 100 : 0

  return {
    saldoAtual: {
      value: input.accountsBalanceTotal,
      // Sem comparação histórica de saldo no MVP (precisaria de snapshot diário).
      // Delta é a soma dos nets dos últimos 30 dias (fluxo líquido recente).
      delta: computeDeltaAbsolute(
        input.accountsBalanceTotal,
        input.accountsBalanceTotal - cashflow30d.totals.net,
        'higher-is-better',
      ),
      spark: saldoSpark,
    },
    receitaMes: {
      value: receitaAtual,
      delta: computeDeltaAbsolute(receitaAtual, receitaPrev, 'higher-is-better'),
      spark: receitaSpark,
    },
    despesasMes: {
      value: despesasAtual,
      delta: computeDeltaAbsolute(despesasAtual, despesasPrev, 'lower-is-better'),
      spark: despesasSpark,
    },
    resultadoMes: {
      value: resultadoAtual,
      delta: computeDeltaAbsolute(resultadoAtual, resultadoPrev, 'higher-is-better'),
      spark: resultadoSpark,
    },
    margemLiquida,
    companyId: input.companyId,
    referenceDate: input.referenceDate,
  }
}

// ============================================================
// Helpers puros
// ============================================================

type DeltaSemantic = 'higher-is-better' | 'lower-is-better'

function computeDeltaAbsolute(
  current: number,
  previous: number,
  semantic: DeltaSemantic,
): KPIDelta {
  const absolute = current - previous
  const percent = previous !== 0 ? (absolute / Math.abs(previous)) * 100 : null

  let direction: KPIDelta['direction'] = 'flat'
  if (absolute !== 0) {
    const upRaw = absolute > 0
    direction = semantic === 'higher-is-better'
      ? (upRaw ? 'up' : 'down')
      : (upRaw ? 'down' : 'up')
  }

  return { absolute, percent, direction }
}

// Constrói sparkline de saldo cumulativo trabalhando "pra trás" a partir do saldo atual.
// Se o net total dos últimos 30 dias foi +10k e saldo atual é 50k, saldo do dia 1 era ~40k.
// Pra cada dia, subtrai o net acumulado dali pra frente do saldo atual.
function buildCumulativeBalanceSpark(
  currentBalance: number,
  dailyNets: Array<{ date: Date; net: number }>,
  range: { start: Date; end: Date },
): SparkPoint[] {
  // Preenche 30 buckets diários, mesmo se alguns dias não tiverem transação
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const daysCount = Math.floor((range.end.getTime() - range.start.getTime()) / MS_PER_DAY) + 1

  const netByDay = new Map<string, number>()
  for (const d of dailyNets) {
    const key = startOfDayUTC(d.date).toISOString().slice(0, 10)
    netByDay.set(key, (netByDay.get(key) ?? 0) + d.net)
  }

  // Caminha do FIM pra TRÁS calculando saldo "histórico"
  const points: SparkPoint[] = []
  let balanceCursor = currentBalance
  for (let i = daysCount - 1; i >= 0; i--) {
    const dayMs = range.start.getTime() + i * MS_PER_DAY
    const day = new Date(dayMs)
    const key = day.toISOString().slice(0, 10)
    const net = netByDay.get(key) ?? 0
    points.unshift({ label: key, value: balanceCursor })
    balanceCursor -= net
  }
  return points
}

// Constrói sparkline de 12 buckets mensais com gaps preenchidos por 0.
function build12MonthSpark(
  monthlyValues: Array<{ date: Date; value: number }>,
  range: { start: Date; end: Date },
): SparkPoint[] {
  const valueByMonth = new Map<string, number>()
  for (const m of monthlyValues) {
    const key = monthKey(m.date)
    valueByMonth.set(key, (valueByMonth.get(key) ?? 0) + m.value)
  }

  const points: SparkPoint[] = []
  let cursor = new Date(
    Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1),
  )
  const endMonth = new Date(
    Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1),
  )

  while (cursor.getTime() <= endMonth.getTime()) {
    const key = monthKey(cursor)
    points.push({ label: key, value: valueByMonth.get(key) ?? 0 })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return points
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
