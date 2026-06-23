// Sprint 4 Motor Único Dashboard (22/06/2026)
//
// Fonte da verdade ÚNICA pro dashboard. UM cache, UMA query base, UMA
// definição de cada conceito. Todos os widgets (Hero KPIs, Mini-DRE,
// DRE Gerencial, Top5, card Pendentes) leem deste motor — fim das
// contradições em tela.
//
// Princípios:
//   - regime: 'caixa' (default; data pagamento) ou 'competência'
//   - NON_DRE_GROUPS (TRANSFERENCIA, DISTRIBUICAO_LUCROS, INVESTIMENTOS,
//     AJUSTE_SALDO) NUNCA entram em receita/despesa
//   - lifecycle='EFFECTED' consistente em TUDO (realizado, não previsto)
//   - Pendentes = MESMA definição do badge sidebar + tela /pendentes
//     (não basta status=PENDING)
//   - MoM: só mostra % se mês-anterior tem cobertura comparável
//     (>= 20% das tx do mês atual); senão retorna comparable=false

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { calculateDRE } from '@/lib/dre/calculator'
import type { CategoryForDRE, DREResult, DRETotals } from '@/lib/dre/types'
import { NON_DRE_GROUP_SET } from '@/lib/dre/types'
import { derivePeriods, type DashboardPeriods } from './period'
import {
  TOP_CATEGORY_COLORS,
  type TopCategoriesResult,
  type TopCategoryItem,
} from './compute-top-categories'

// dreGroups considerados despesa operacional pro Top 5 e somatório
const EXPENSE_DRE_GROUPS = new Set([
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
])

export type Regime = 'caixa' | 'competencia'

export interface PendenteCount {
  total: number
}

export interface MoMComparison {
  comparable: boolean
  motivo?: 'mes_anterior_incompleto' | 'sem_dados'
  // Quando comparable=true:
  receitaCurrent?: number
  receitaPrevious?: number
  receitaDeltaPercent?: number | null
  txCurrent?: number
  txPrevious?: number
  // Limiar de cobertura usado pra decidir
  thresholdRatio?: number
}

export interface DashboardData {
  // ───────── Saldo ─────────
  saldoAtual: number
  saldosPorConta: Array<{
    bankAccountId: string
    name: string
    balance: number
    ledgerBal: number | null
  }>

  // ───────── DRE realizado mês atual ─────────
  receitaBruta: number
  totalDeducoes: number
  lucroBruto: number
  despesaOperacional: number // soma de todos EXPENSE_DRE_GROUPS
  resultadoOperacional: number
  lucroLiquido: number
  margemLiquida: number

  // DRE mês anterior (pra Mini-DRE deltas)
  previousTotals: DRETotals

  // ───────── Top 5 Despesas mês atual ─────────
  top5Despesas: TopCategoriesResult

  // ───────── Pendentes (mesma def do badge + tela) ─────────
  pendentes: PendenteCount

  // ───────── MoM Receita ─────────
  mom: MoMComparison

  // Metadados
  companyId: string
  regime: Regime
  periods: {
    currentMonthStart: string // ISO
    currentMonthEnd: string
    previousMonthStart: string
    previousMonthEnd: string
  }
  computedAt: string // ISO timestamp
}

const CACHE_TTL_SECONDS = 60

/**
 * Período custom opcional. Quando passado, sobrescreve o currentMonth derivado
 * de refDate. previousMonth é re-derivado simétrico (mesmo tamanho, anterior).
 * Sprint 7 — seletor de mês corrente.
 */
export interface CustomPeriod {
  start: Date
  end: Date
}

/**
 * Fonte ÚNICA da verdade pro dashboard.
 * Cache key consolidado: 1 entrada por (companyId, regime, periodKey).
 */
export async function getDashboardData(
  companyId: string,
  refDate: Date = new Date(),
  regime: Regime = 'caixa',
  customPeriod?: CustomPeriod,
): Promise<DashboardData> {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }
  const periodKey = customPeriod
    ? `${customPeriod.start.toISOString().slice(0, 10)}_${customPeriod.end.toISOString().slice(0, 10)}`
    : refDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadDashboardData(companyId, refDate, regime, customPeriod),
    [`dashboard:engine:${companyId}:${regime}:${periodKey}`],
    { revalidate: CACHE_TTL_SECONDS, tags: [`dashboard:${companyId}`] },
  )
  // unstable_cache do Next 15+ serializa via JSON — Date vira string.
  // Re-hidratar campos que precisam ser Date no caller (não há nenhum aqui:
  // periods são strings ISO + computedAt string).
  return cached()
}

/** Exposto pra scripts CLI / testes (não chama unstable_cache).
 * Em runtime do app, sempre use getDashboardData() (com cache). */
export async function loadDashboardData(
  companyId: string,
  refDate: Date,
  regime: Regime,
  customPeriod?: CustomPeriod,
): Promise<DashboardData> {
  // Sprint 7: customPeriod sobrescreve currentMonth. previousMonth fica
  // simétrico (mesmo tamanho, anterior) pra preservar shape MoM. UI Mercury
  // (Sprint 7) ignora MoM, mas APIs/cards antigos ainda leem previousTotals.
  const periodsBase = derivePeriods(refDate)
  const periods = customPeriod
    ? applyCustomPeriod(periodsBase, customPeriod)
    : periodsBase

  const [
    accounts,
    categoriesRaw,
    transactionsForDRE,
    pendentesCount,
    momCurrent,
    momPrevious,
  ] = await Promise.all([
    // 1) Saldos
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        balance: true,
        ledgerBal: true,
      },
    }),

    // 2) Categorias da empresa
    prisma.category.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        dreGroup: true,
        parentId: true,
        isActive: true,
        type: true,
      },
    }),

    // 3) Transações pro DRE: cobre current + previous month
    //    Filtros UNIFICADOS:
    //    - lifecycle='EFFECTED' (realizado)
    //    - reconciledWithId=null (anti-dupla-contagem OFX-pai)
    //    - NÃO filtra type aqui — calculateDRE já trata TRANSFER e NON_DRE_GROUPS
    //    - Regime caixa: paymentDate; competência: competenceDate
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        ...whereByRegime(periods, regime),
      },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        competenceDate: true,
        paymentDate: true,
        categoryId: true,
      },
    }),

    // 4) Pendentes — DEFINIÇÃO ÚNICA (mesma do badge + tela)
    prisma.transaction.count({
      where: {
        bankAccount: { companyId },
        lifecycle: 'EFFECTED',
        status: 'PENDING',
        categoryId: null,
        reconciledWithId: null,
        reconciledFrom: { none: {} },
        transferGroupId: null,
        type: { not: 'TRANSFER' },
      },
    }),

    // 5) MoM cobertura: contar tx EFFECTED non-TRANSFER mês atual
    prisma.transaction.count({
      where: {
        bankAccount: { companyId },
        lifecycle: 'EFFECTED',
        type: { not: 'TRANSFER' },
        date: { gte: periods.currentMonth.start, lte: periods.currentMonth.end },
      },
    }),

    // 6) MoM cobertura: contar tx mês anterior
    prisma.transaction.count({
      where: {
        bankAccount: { companyId },
        lifecycle: 'EFFECTED',
        type: { not: 'TRANSFER' },
        date: { gte: periods.previousMonth.start, lte: periods.previousMonth.end },
      },
    }),
  ])

  const categories: CategoryForDRE[] = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    dreGroup: c.dreGroup ?? '',
    parentId: c.parentId,
    isActive: c.isActive,
    type: c.type,
  }))

  // Tipa as tx pra TransactionForDRE (cast de type:string → union literal).
  // Filtros já asseguram type ∈ CREDIT/DEBIT/TRANSFER no DB.
  const txsForCalc = transactionsForDRE.map((t) => ({
    id: t.id,
    type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
    amount: t.amount,
    date: t.date,
    competenceDate: t.competenceDate,
    paymentDate: t.paymentDate,
    categoryId: t.categoryId,
  }))

  // Mapeia regime do motor ('caixa'/'competencia') pra RegimeContabil ('cash'/'competence')
  const dreRegime = regime === 'caixa' ? 'cash' : 'competence'

  // DRE current + previous
  const dreCurrent: DREResult = calculateDRE(txsForCalc, categories, {
    period: {
      startDate: periods.currentMonth.start,
      endDate: periods.currentMonth.end,
      regime: dreRegime,
    },
  })
  const drePrevious: DREResult = calculateDRE(txsForCalc, categories, {
    period: {
      startDate: periods.previousMonth.start,
      endDate: periods.previousMonth.end,
      regime: dreRegime,
    },
  })

  const totalsCurrent: DRETotals = dreCurrent.totals
  const totalsPrevious: DRETotals = drePrevious.totals

  // Saldo total
  const saldoAtual = accounts.reduce((s, a) => s + a.balance, 0)

  // Despesa Operacional = soma de groups EXPENSE_DRE_GROUPS no DRE current
  let despesaOperacional = 0
  for (const grp of dreCurrent.groups) {
    if (EXPENSE_DRE_GROUPS.has(grp.group)) {
      // total no calculator vem positivo pra despesas (já tratou sinal)
      despesaOperacional += Math.abs(grp.total)
    }
  }

  // Top 5 — REUSAR mesma fonte de dados (dreCurrent.groups) pra garantir consistência
  const top5Despesas = computeTop5FromDREGroups(dreCurrent, companyId)

  // MoM honesto
  const mom = computeMoM({
    receitaCurrent: totalsCurrent.receitaBruta,
    receitaPrevious: totalsPrevious.receitaBruta,
    txCurrent: momCurrent,
    txPrevious: momPrevious,
  })

  return {
    saldoAtual,
    saldosPorConta: accounts.map((a) => ({
      bankAccountId: a.id,
      name: a.name,
      balance: a.balance,
      ledgerBal: a.ledgerBal,
    })),

    receitaBruta: totalsCurrent.receitaBruta,
    totalDeducoes: totalsCurrent.totalDeducoes,
    lucroBruto: totalsCurrent.lucroBruto,
    despesaOperacional,
    resultadoOperacional: totalsCurrent.resultadoOperacional,
    lucroLiquido: totalsCurrent.lucroLiquido,
    margemLiquida: totalsCurrent.margemLiquida,

    previousTotals: totalsPrevious,
    top5Despesas,
    pendentes: { total: pendentesCount },
    mom,

    companyId,
    regime,
    periods: {
      currentMonthStart: periods.currentMonth.start.toISOString(),
      currentMonthEnd: periods.currentMonth.end.toISOString(),
      previousMonthStart: periods.previousMonth.start.toISOString(),
      previousMonthEnd: periods.previousMonth.end.toISOString(),
    },
    computedAt: new Date().toISOString(),
  }
}

// ============================================================
// Helpers (puros — testáveis sem DB)
// ============================================================

function whereByRegime(periods: DashboardPeriods, regime: Regime) {
  if (regime === 'caixa') {
    // Caixa: paymentDate; fallback pra date quando NULL
    return {
      OR: [
        {
          paymentDate: {
            gte: periods.previousMonth.start,
            lte: periods.currentMonth.end,
          },
        },
        {
          paymentDate: null,
          date: {
            gte: periods.previousMonth.start,
            lte: periods.currentMonth.end,
          },
        },
      ],
    }
  }
  // Competência: competenceDate; fallback pra date
  return {
    OR: [
      {
        competenceDate: {
          gte: periods.previousMonth.start,
          lte: periods.currentMonth.end,
        },
      },
      {
        competenceDate: null,
        date: {
          gte: periods.previousMonth.start,
          lte: periods.currentMonth.end,
        },
      },
    ],
  }
}

/**
 * Top 5 derivado dos groups do DRE — garantia de consistência:
 * MESMOS números agregados que o DRE mostra (receita/despesa).
 * NON_DRE_GROUPS já filtrados pelo engine DRE.
 * Anti-vazamento: TRANSFERENCIA + DISTRIBUICAO_LUCROS + INVESTIMENTOS
 * NUNCA entram (engine os manda pra dre.nonDreGroups, não pra dre.groups).
 */
function computeTop5FromDREGroups(
  dre: DREResult,
  companyId: string,
): TopCategoriesResult {
  // Flatten: pra cada grupo EXPENSE, listar categorias com seu total
  interface Flat { categoryId: string; name: string; total: number }
  const flat: Flat[] = []
  for (const g of dre.groups) {
    if (!EXPENSE_DRE_GROUPS.has(g.group)) continue
    if (NON_DRE_GROUP_SET.has(g.group)) continue // double-guard
    for (const cat of g.categories) {
      flat.push({
        categoryId: cat.category.id,
        name: cat.category.name,
        total: Math.abs(cat.total),
      })
    }
  }

  flat.sort((a, b) => b.total - a.total)
  const top = flat.slice(0, 5)
  const totalDespesas = top.reduce((s, t) => s + t.total, 0)

  const items: TopCategoryItem[] = top.map((t, idx) => ({
    categoryId: t.categoryId,
    name: t.name,
    amount: t.total,
    percent: totalDespesas > 0 ? (t.total / totalDespesas) * 100 : 0,
    color: TOP_CATEGORY_COLORS[idx] ?? TOP_CATEGORY_COLORS[TOP_CATEGORY_COLORS.length - 1],
  }))

  return { items, totalDespesas, companyId }
}

/**
 * Sprint 7 — aplica período custom ao DashboardPeriods existente.
 * - currentMonth = custom
 * - previousMonth = anterior simétrico (mesma duração, anterior ao custom.start)
 * - last30Days e last12Months preservados (referência ainda é refDate)
 */
function applyCustomPeriod(
  base: DashboardPeriods,
  custom: CustomPeriod,
): DashboardPeriods {
  const durationMs = custom.end.getTime() - custom.start.getTime()
  const previousStart = new Date(custom.start.getTime() - durationMs - 1)
  const previousEnd = new Date(custom.start.getTime() - 1)
  return {
    ...base,
    currentMonth: { start: custom.start, end: custom.end },
    previousMonth: { start: previousStart, end: previousEnd },
  }
}

/**
 * MoM "honesto":
 *   - Se mês-anterior tem 0 tx: NÃO comparável (motivo='sem_dados')
 *   - Se mês-anterior tem < THRESHOLD_RATIO da contagem do atual:
 *     NÃO comparável (motivo='mes_anterior_incompleto')
 *   - Caso contrário: comparable=true + deltaPercent
 */
export interface ComputeMoMInput {
  receitaCurrent: number
  receitaPrevious: number
  txCurrent: number
  txPrevious: number
}

const MOM_COVERAGE_THRESHOLD = 0.2 // mês-anterior precisa ter >=20% das tx do atual

export function computeMoM(input: ComputeMoMInput): MoMComparison {
  const { receitaCurrent, receitaPrevious, txCurrent, txPrevious } = input

  if (txPrevious === 0) {
    return { comparable: false, motivo: 'sem_dados', thresholdRatio: MOM_COVERAGE_THRESHOLD }
  }
  if (txCurrent > 0 && txPrevious / txCurrent < MOM_COVERAGE_THRESHOLD) {
    return {
      comparable: false,
      motivo: 'mes_anterior_incompleto',
      txCurrent,
      txPrevious,
      thresholdRatio: MOM_COVERAGE_THRESHOLD,
    }
  }

  const deltaAbs = receitaCurrent - receitaPrevious
  const deltaPercent = receitaPrevious !== 0
    ? (deltaAbs / Math.abs(receitaPrevious)) * 100
    : null

  return {
    comparable: true,
    receitaCurrent,
    receitaPrevious,
    receitaDeltaPercent: deltaPercent,
    txCurrent,
    txPrevious,
    thresholdRatio: MOM_COVERAGE_THRESHOLD,
  }
}
