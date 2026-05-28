// Sprint 5.0.4.0b — Server queries pra alimentar Hero + 5 cards de preview
// da página /relatorios. Reusa engines existentes (Sprint 0.5 + Sprint 1 +
// Sprint 5.0.4.0a) sem duplicar lógica. Cache 60s via unstable_cache.

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { calculateDRE } from '@/lib/dre/calculator'
import { calculateConsolidatedCashflow } from '@/lib/cashflow/consolidated'
import type { CashflowTransaction } from '@/lib/cashflow/consolidated'
import type { CategoryForDRE, TransactionForDRE } from '@/lib/dre/types'

const CACHE_TTL_SECONDS = 60

// ============================================================
// Tipos públicos
// ============================================================

export interface HeroPreview {
  /** "Maio/2026" */
  monthLabel: string
  /** "Abr/26" — pra usar no badge de trend */
  prevMonthLabel: string
  lucroLiquido: number
  /** true se lucroLíquido >= 0 (verde) ou < 0 (vermelho) */
  isProfit: boolean
  receita: number
  despesas: number
  /** Pontos percentuais (ex: 22 = 22%) ou null se receita=0 */
  margemPct: number | null
  /** Delta % vs mês anterior. null quando previous=0 OU current=0 */
  trendPercent: number | null
  trendDirection: 'up' | 'down' | 'stable'
  /** Sparkline adaptativo: 3-12 buckets de Lucro Líquido mensal. Vazio se < 3 meses. */
  sparkline: SparklinePoint[]
}

export interface SparklinePoint {
  monthKey: string // "2026-05"
  value: number
}

export interface CategoriasPreview {
  topCategory: { name: string; value: number; percent: number } | null
  top3: Array<{ name: string; value: number; percent: number }>
  totalAmount: number
  hasData: boolean
}

export interface ComparativoPreview {
  /** Categorias que subiram este mês vs mês anterior (UP + UP_STRONG) */
  subindo: number
  /** Maior alta detectada (nome + %) */
  maiorAlta: { name: string; percent: number } | null
  /** Sparkline 3m: total de despesas por mês */
  sparkline3m: SparklinePoint[]
}

export interface FluxoCaixaPreview {
  /** Saldo do mês atual = entradas - saídas (lifecycle=EFFECTED, sem TRANSFER) */
  saldoMesAtual: number
  isPositive: boolean
  monthLabel: string
  /** Projeção próximos 30 dias (lifecycle PAYABLE/RECEIVABLE + paymentDate NULL) */
  proxima30: {
    entradas: number
    saidas: number
    resultado: number
  }
}

export interface FornecedoresPreview {
  topSupplier: { name: string; value: number; percent: number } | null
  /** Fornecedor com maior crescimento vs mês anterior (excluindo 🆕 novos) */
  maiorCrescimento: { name: string; percent: number } | null
  totalSuppliers: number
}

export interface FuncionariosPreview {
  ativos: number
  totalFolhaMes: number
  monthLabel: string
}

export interface RelatoriosPreview {
  hero: HeroPreview
  categorias: CategoriasPreview
  comparativo: ComparativoPreview
  fluxoCaixa: FluxoCaixaPreview
  fornecedores: FornecedoresPreview
  funcionarios: FuncionariosPreview
}

// ============================================================
// Helpers de período
// ============================================================

const MES_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]
const MES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function monthLabel(date: Date): string {
  return `${MES_FULL[date.getUTCMonth()]}/${date.getUTCFullYear()}`
}

export function monthLabelShort(date: Date): string {
  return `${MES_LABELS[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(-2)}`
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function endOfMonthUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  )
}

function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
}

function addDaysUTC(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000)
}

// ============================================================
// Entry point — orquestrador paralelo + cache
// ============================================================

export async function getRelatoriosPreview(
  empresaId: string,
  referenceDate: Date = new Date(),
): Promise<RelatoriosPreview> {
  if (!empresaId) {
    throw new Error('empresaId é obrigatório (isolamento multi-tenant)')
  }

  const dayKey = referenceDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadRelatoriosPreview(empresaId, referenceDate),
    [`relatorios:preview:${empresaId}:${dayKey}`],
    {
      revalidate: CACHE_TTL_SECONDS,
      tags: [`relatorios:${empresaId}`, `dashboard:${empresaId}`],
    },
  )
  return cached()
}

async function loadRelatoriosPreview(
  empresaId: string,
  refDate: Date,
): Promise<RelatoriosPreview> {
  const [hero, categorias, comparativo, fluxoCaixa, fornecedores, funcionarios] =
    await Promise.all([
      loadHeroPreview(empresaId, refDate),
      loadCategoriasPreview(empresaId, refDate),
      loadComparativoPreview(empresaId, refDate),
      loadFluxoCaixaPreview(empresaId, refDate),
      loadFornecedoresPreview(empresaId, refDate),
      loadFuncionariosPreview(empresaId, refDate),
    ])

  return { hero, categorias, comparativo, fluxoCaixa, fornecedores, funcionarios }
}

// ============================================================
// HERO PREVIEW — Lucro Líquido + Receita/Despesas/Margem + sparkline adaptativo
// ============================================================

async function loadHeroPreview(
  empresaId: string,
  refDate: Date,
): Promise<HeroPreview> {
  const currentStart = startOfMonthUTC(refDate)
  const currentEnd = endOfMonthUTC(refDate)
  const prevStart = addMonthsUTC(currentStart, -1)
  const prevEnd = endOfMonthUTC(prevStart)
  // Range adaptativo: até 12 meses pra trás (inclusive corrente)
  const sparkRangeStart = addMonthsUTC(currentStart, -11)
  const sparkRangeEnd = currentEnd

  const [categoriesRaw, txCurrentRaw, txPrevRaw, txSparkRaw] = await Promise.all([
    prisma.category.findMany({
      where: { companyId: empresaId },
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
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        OR: [
          {
            competenceDate: { gte: currentStart, lte: currentEnd },
          },
          {
            competenceDate: null,
            date: { gte: currentStart, lte: currentEnd },
          },
        ],
      },
      select: txDRESelect(),
    }),
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        OR: [
          { competenceDate: { gte: prevStart, lte: prevEnd } },
          {
            competenceDate: null,
            date: { gte: prevStart, lte: prevEnd },
          },
        ],
      },
      select: txDRESelect(),
    }),
    prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        type: { not: 'TRANSFER' },
        date: { gte: sparkRangeStart, lte: sparkRangeEnd },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        category: { select: { dreGroup: true } },
      },
    }),
  ])

  const categories: CategoryForDRE[] = mapCategories(categoriesRaw)
  const txCurrent: TransactionForDRE[] = mapTxsForDRE(txCurrentRaw)
  const txPrev: TransactionForDRE[] = mapTxsForDRE(txPrevRaw)

  const dreCurrent = calculateDRE(txCurrent, categories, {
    period: { startDate: currentStart, endDate: currentEnd, regime: 'competence' },
  })
  const drePrev = calculateDRE(txPrev, categories, {
    period: { startDate: prevStart, endDate: prevEnd, regime: 'competence' },
  })

  const lucroLiquido = dreCurrent.totals.lucroLiquido
  const lucroLiquidoPrev = drePrev.totals.lucroLiquido
  const receita = dreCurrent.totals.receitaBruta
  const despesas =
    dreCurrent.totals.totalCustos +
    dreCurrent.totals.totalDespesasOperacionais +
    dreCurrent.totals.despesasFinanceiras +
    dreCurrent.totals.impostosSobreLucro

  // Usa margemLiquida do engine se receita > 0, senão null (evita NaN)
  const margemPct = receita > 0 ? dreCurrent.totals.margemLiquida : null

  const { trendPercent, trendDirection } = computeTrend(
    lucroLiquidoPrev,
    lucroLiquido,
  )

  // Sparkline: usa calculateConsolidatedCashflow agrupado por mês.
  // O "valor" do bucket é o NET (income - expense), aproximação ok pra
  // sparkline (não precisa de DRE completa por mês).
  const sparkTxs: CashflowTransaction[] = txSparkRaw.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    date: t.date,
    dreGroup: t.category?.dreGroup ?? null,
  }))
  const cashflow = calculateConsolidatedCashflow(
    sparkTxs,
    {
      startDate: sparkRangeStart,
      endDate: sparkRangeEnd,
      groupBy: 'month',
    },
    empresaId,
  )
  // Adaptativo: só inclui buckets que tiveram alguma movimentação.
  // Se < 3 meses com dado, sparkline vai vazio.
  const sparkline: SparklinePoint[] = cashflow.byPeriod
    .filter((b) => b.income > 0 || b.expense > 0)
    .map((b) => ({
      monthKey: b.bucketStart.toISOString().slice(0, 7),
      value: b.net,
    }))

  return {
    monthLabel: monthLabel(currentStart),
    prevMonthLabel: monthLabelShort(prevStart),
    lucroLiquido,
    isProfit: lucroLiquido >= 0,
    receita,
    despesas,
    margemPct,
    trendPercent,
    trendDirection,
    sparkline: sparkline.length >= 3 ? sparkline : [],
  }
}

// ============================================================
// CATEGORIAS PREVIEW — Top 1 + Top 3 do mês atual (DESPESA)
// ============================================================

async function loadCategoriasPreview(
  empresaId: string,
  refDate: Date,
): Promise<CategoriasPreview> {
  const currentStart = startOfMonthUTC(refDate)
  const currentEnd = endOfMonthUTC(refDate)

  // Top categorias DESPESA mês atual: groupBy + DESC
  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      bankAccount: { companyId: empresaId },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'DEBIT',
      categoryId: { not: null },
      date: { gte: currentStart, lte: currentEnd },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 10,
  })

  if (grouped.length === 0) {
    return {
      topCategory: null,
      top3: [],
      totalAmount: 0,
      hasData: false,
    }
  }

  const categoryIds = grouped
    .map((g) => g.categoryId)
    .filter((id): id is string => !!id)

  const cats = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, dreGroup: true },
  })
  const byId = new Map(cats.map((c) => [c.id, c]))

  // Filtra só dreGroup de DESPESA (mesmas regras do dashboard.compute-top-categories)
  const DESPESA_GROUPS = new Set([
    'CUSTO_PRODUTO_VENDIDO',
    'CUSTO_SERVICOS',
    'DESPESAS_OPERACIONAIS',
    'DESPESAS_ADMINISTRATIVAS',
    'OUTRAS_DESPESAS',
    'IMPOSTOS',
  ])

  const filtered = grouped
    .map((g) => {
      const cat = byId.get(g.categoryId!)
      if (!cat || !cat.dreGroup) return null
      if (!DESPESA_GROUPS.has(cat.dreGroup)) return null
      return {
        name: cat.name,
        value: g._sum.amount ?? 0,
      }
    })
    .filter((x): x is { name: string; value: number } => x !== null)

  if (filtered.length === 0) {
    return { topCategory: null, top3: [], totalAmount: 0, hasData: false }
  }

  const totalAmount = filtered.reduce((s, c) => s + c.value, 0)
  const withPercent = filtered.map((c) => ({
    ...c,
    percent: totalAmount > 0 ? (c.value / totalAmount) * 100 : 0,
  }))

  return {
    topCategory: withPercent[0] ?? null,
    top3: withPercent.slice(0, 3),
    totalAmount,
    hasData: true,
  }
}

// ============================================================
// COMPARATIVO PREVIEW — N subindo + maior alta + sparkline 3m
// ============================================================

async function loadComparativoPreview(
  empresaId: string,
  refDate: Date,
): Promise<ComparativoPreview> {
  const currentStart = startOfMonthUTC(refDate)
  const currentEnd = endOfMonthUTC(refDate)
  const prevStart = addMonthsUTC(currentStart, -1)
  const prevEnd = endOfMonthUTC(prevStart)
  const prev2Start = addMonthsUTC(currentStart, -2)
  const prev2End = endOfMonthUTC(prev2Start)

  // Pega todas tx DESPESA dos 3 meses (limitado a 5000 pra cap)
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: empresaId },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'DEBIT',
      categoryId: { not: null },
      date: { gte: prev2Start, lte: currentEnd },
    },
    select: {
      amount: true,
      date: true,
      categoryId: true,
      category: { select: { id: true, name: true, dreGroup: true } },
    },
    take: 5000,
  })

  // Agrega por categoria × bucket
  type CatTotals = { name: string; current: number; prev: number }
  const byCat = new Map<string, CatTotals>()
  const sparkBuckets: Record<string, number> = {
    [prev2Start.toISOString().slice(0, 7)]: 0,
    [prevStart.toISOString().slice(0, 7)]: 0,
    [currentStart.toISOString().slice(0, 7)]: 0,
  }
  for (const t of txs) {
    if (!t.categoryId || !t.category) continue
    const bucket = t.date.toISOString().slice(0, 7)
    if (bucket in sparkBuckets) {
      sparkBuckets[bucket] += t.amount
    }
    const existing = byCat.get(t.categoryId) ?? {
      name: t.category.name,
      current: 0,
      prev: 0,
    }
    const d = t.date.getTime()
    if (d >= currentStart.getTime() && d <= currentEnd.getTime()) {
      existing.current += t.amount
    } else if (d >= prevStart.getTime() && d <= prevEnd.getTime()) {
      existing.prev += t.amount
    }
    byCat.set(t.categoryId, existing)
  }

  let subindo = 0
  let maiorAlta: { name: string; percent: number } | null = null

  for (const cat of byCat.values()) {
    if (cat.prev <= 0 || cat.current <= 0) continue
    const delta = (cat.current - cat.prev) / cat.prev
    if (delta > 0.15) {
      subindo++
      const pct = delta * 100
      if (!maiorAlta || pct > maiorAlta.percent) {
        maiorAlta = { name: cat.name, percent: pct }
      }
    }
  }

  const sparkline3m: SparklinePoint[] = Object.entries(sparkBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, value]) => ({ monthKey, value }))

  return { subindo, maiorAlta, sparkline3m }
}

// ============================================================
// FLUXO CAIXA PREVIEW — Saldo mês + projeção 30d
// ============================================================

async function loadFluxoCaixaPreview(
  empresaId: string,
  refDate: Date,
): Promise<FluxoCaixaPreview> {
  const currentStart = startOfMonthUTC(refDate)
  const currentEnd = endOfMonthUTC(refDate)
  const next30Start = addDaysUTC(refDate, 1)
  const next30End = addDaysUTC(refDate, 30)

  const [entradasMes, saidasMes, entradasFuturas, saidasFuturas] = await Promise.all(
    [
      // Realizado mês: CREDIT EFFECTED não-TRANSFER no mês
      prisma.transaction.aggregate({
        where: {
          bankAccount: { companyId: empresaId },
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          type: 'CREDIT',
          date: { gte: currentStart, lte: currentEnd },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          bankAccount: { companyId: empresaId },
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          type: 'DEBIT',
          date: { gte: currentStart, lte: currentEnd },
        },
        _sum: { amount: true },
      }),
      // Projeção 30d entradas: RECEIVABLE não pagas vencendo
      prisma.transaction.aggregate({
        where: {
          bankAccount: { companyId: empresaId },
          lifecycle: 'RECEIVABLE',
          paymentDate: null,
          dueDate: { gte: next30Start, lte: next30End },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          bankAccount: { companyId: empresaId },
          lifecycle: 'PAYABLE',
          paymentDate: null,
          dueDate: { gte: next30Start, lte: next30End },
        },
        _sum: { amount: true },
      }),
    ],
  )

  const entradasV = entradasMes._sum.amount ?? 0
  const saidasV = saidasMes._sum.amount ?? 0
  const saldoMesAtual = entradasV - saidasV

  const entradasFutV = entradasFuturas._sum.amount ?? 0
  const saidasFutV = saidasFuturas._sum.amount ?? 0

  return {
    saldoMesAtual,
    isPositive: saldoMesAtual >= 0,
    monthLabel: monthLabel(currentStart),
    proxima30: {
      entradas: entradasFutV,
      saidas: saidasFutV,
      resultado: entradasFutV - saidasFutV,
    },
  }
}

// ============================================================
// FORNECEDORES PREVIEW — Top 1 + maior crescimento
// ============================================================

async function loadFornecedoresPreview(
  empresaId: string,
  refDate: Date,
): Promise<FornecedoresPreview> {
  const currentStart = startOfMonthUTC(refDate)
  const currentEnd = endOfMonthUTC(refDate)
  const prevStart = addMonthsUTC(currentStart, -1)
  const prevEnd = endOfMonthUTC(prevStart)

  const [groupedCurrent, groupedPrev, suppliersCount] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['supplierId'],
      where: {
        bankAccount: { companyId: empresaId },
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        type: 'DEBIT',
        supplierId: { not: null },
        date: { gte: currentStart, lte: currentEnd },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 30,
    }),
    prisma.transaction.groupBy({
      by: ['supplierId'],
      where: {
        bankAccount: { companyId: empresaId },
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        type: 'DEBIT',
        supplierId: { not: null },
        date: { gte: prevStart, lte: prevEnd },
      },
      _sum: { amount: true },
    }),
    prisma.supplier.count({ where: { companyId: empresaId } }),
  ])

  if (groupedCurrent.length === 0) {
    return {
      topSupplier: null,
      maiorCrescimento: null,
      totalSuppliers: suppliersCount,
    }
  }

  const ids = groupedCurrent
    .map((g) => g.supplierId)
    .filter((id): id is string => !!id)
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: ids } },
    select: { id: true, razaoSocial: true },
  })
  const byId = new Map(suppliers.map((s) => [s.id, s]))

  const totalCurrent = groupedCurrent.reduce(
    (s, g) => s + (g._sum.amount ?? 0),
    0,
  )

  const prevById = new Map(
    groupedPrev.map((g) => [g.supplierId!, g._sum.amount ?? 0]),
  )

  // Top 1
  const top = groupedCurrent[0]
  const topSupplier = top.supplierId
    ? {
        name: byId.get(top.supplierId)?.razaoSocial ?? 'Fornecedor sem nome',
        value: top._sum.amount ?? 0,
        percent: totalCurrent > 0 ? ((top._sum.amount ?? 0) / totalCurrent) * 100 : 0,
      }
    : null

  // Maior crescimento (exclui 🆕 — só compara quando prev > 0)
  let maiorCrescimento: { name: string; percent: number } | null = null
  for (const g of groupedCurrent) {
    if (!g.supplierId) continue
    const current = g._sum.amount ?? 0
    const prev = prevById.get(g.supplierId) ?? 0
    if (prev <= 0 || current <= 0) continue
    const pct = ((current - prev) / prev) * 100
    if (pct > 15 && (!maiorCrescimento || pct > maiorCrescimento.percent)) {
      maiorCrescimento = {
        name: byId.get(g.supplierId)?.razaoSocial ?? 'Sem nome',
        percent: pct,
      }
    }
  }

  return { topSupplier, maiorCrescimento, totalSuppliers: suppliersCount }
}

// ============================================================
// FUNCIONÁRIOS PREVIEW — Ativos + total folha mês
// ============================================================

async function loadFuncionariosPreview(
  empresaId: string,
  refDate: Date,
): Promise<FuncionariosPreview> {
  const currentStart = startOfMonthUTC(refDate)
  const currentEnd = endOfMonthUTC(refDate)

  const [ativos, agg] = await Promise.all([
    prisma.employee.count({ where: { companyId: empresaId, ativo: true } }),
    prisma.transaction.aggregate({
      where: {
        bankAccount: { companyId: empresaId },
        lifecycle: 'EFFECTED',
        reconciledWithId: null,
        type: 'DEBIT',
        employeeId: { not: null },
        date: { gte: currentStart, lte: currentEnd },
      },
      _sum: { amount: true },
    }),
  ])

  return {
    ativos,
    totalFolhaMes: agg._sum.amount ?? 0,
    monthLabel: monthLabel(currentStart),
  }
}

// ============================================================
// Helpers internos
// ============================================================

function txDRESelect() {
  return {
    id: true,
    type: true,
    amount: true,
    date: true,
    competenceDate: true,
    paymentDate: true,
    categoryId: true,
  } as const
}

function mapCategories(
  raw: Array<{
    id: string
    name: string
    code: string | null
    dreGroup: string | null
    parentId: string | null
    isActive: boolean
    type: string
  }>,
): CategoryForDRE[] {
  return raw.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    dreGroup: c.dreGroup ?? '',
    parentId: c.parentId,
    isActive: c.isActive,
    type: c.type,
  }))
}

function mapTxsForDRE(
  raw: Array<{
    id: string
    type: string
    amount: number
    date: Date
    competenceDate: Date | null
    paymentDate: Date | null
    categoryId: string | null
  }>,
): TransactionForDRE[] {
  return raw.map((t) => ({
    id: t.id,
    type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
    amount: t.amount,
    date: t.date,
    competenceDate: t.competenceDate,
    paymentDate: t.paymentDate,
    categoryId: t.categoryId,
  }))
}

/**
 * Calcula trend % entre mês anterior e atual + direção.
 * Exposto pra testes unitários e reuso em outros previews futuros.
 */
export function computeTrend(
  previous: number,
  current: number,
): { trendPercent: number | null; trendDirection: 'up' | 'down' | 'stable' } {
  if (previous === 0 && current === 0) {
    return { trendPercent: null, trendDirection: 'stable' }
  }
  if (previous === 0) {
    // current ≠ 0, divisão por zero — sem percentual, mas direção dada pelo sinal
    return {
      trendPercent: null,
      trendDirection: current > 0 ? 'up' : 'down',
    }
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const direction: 'up' | 'down' | 'stable' =
    Math.abs(pct) < 1 ? 'stable' : pct > 0 ? 'up' : 'down'
  return { trendPercent: pct, trendDirection: direction }
}
