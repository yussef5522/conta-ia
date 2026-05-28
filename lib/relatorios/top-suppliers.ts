// Sprint 5.0.4.0b Fase 4 — Função pura Top Fornecedores.
//
// Agrupa por supplierId, ordena DESC, retorna top N + concentração + trend.

import { TREND_VISUAL, type TrendIndicator } from './comparativo'

export type TrendVisual = (typeof TREND_VISUAL)[TrendIndicator]

export interface SupplierAggInput {
  supplierId: string
  amount: number
  count: number
}

export interface SupplierMeta {
  id: string
  nome: string
  cnpj: string | null
}

export interface TopSupplierRow {
  supplierId: string
  nome: string
  cnpj: string | null
  rank: number
  amount: number
  count: number
  percentDoTotal: number
  /** Delta % vs mês anterior. null se prev=0 ou current=0 */
  trendPct: number | null
  trend: TrendIndicator
  trendVisual: TrendVisual
}

export interface TopSuppliersResult {
  rows: TopSupplierRow[]
  totalAmount: number
  totalCount: number
  totalSuppliersUnique: number
  /** % do total concentrado nos top 5 */
  concentracaoTop5: number
}

export interface ComputeTopSuppliersInput {
  current: SupplierAggInput[]
  previous: SupplierAggInput[]
  suppliers: SupplierMeta[]
  topN: number
}

/**
 * Aplica trendIndicator simplificado: NÃO precisamos das 8 categorias da
 * comparativo.ts porque aqui o "previous" tem só 1 ponto (mês anterior).
 * Categorias possíveis aqui: NEW, UP_STRONG, UP, STABLE, DOWN, DOWN_STRONG, GONE.
 */
function trendIndicatorSupplier(
  prev: number,
  current: number,
): TrendIndicator {
  if (current === 0 && prev === 0) return 'EMPTY'
  if (current === 0 && prev > 0) return 'GONE'
  if (prev === 0 && current > 0) return 'NEW'
  const delta = (current - prev) / prev
  if (delta > 0.5) return 'UP_STRONG'
  if (delta > 0.15) return 'UP'
  if (delta < -0.5) return 'DOWN_STRONG'
  if (delta < -0.15) return 'DOWN'
  return 'STABLE'
}

export function computeTopSuppliers(
  input: ComputeTopSuppliersInput,
): TopSuppliersResult {
  const { current, previous, suppliers, topN } = input

  const suppliersById = new Map(suppliers.map((s) => [s.id, s]))
  const prevById = new Map(previous.map((p) => [p.supplierId, p.amount]))

  const sorted = [...current].sort((a, b) => b.amount - a.amount)

  const totalAmount = sorted.reduce((s, r) => s + r.amount, 0)
  const totalCount = sorted.reduce((s, r) => s + r.count, 0)

  const rows: TopSupplierRow[] = sorted.slice(0, topN).map((r, i) => {
    const meta = suppliersById.get(r.supplierId)
    const prev = prevById.get(r.supplierId) ?? 0
    const trend = trendIndicatorSupplier(prev, r.amount)
    const trendPct =
      prev > 0 && r.amount > 0 ? ((r.amount - prev) / prev) * 100 : null

    return {
      supplierId: r.supplierId,
      nome: meta?.nome ?? 'Fornecedor sem nome',
      cnpj: meta?.cnpj ?? null,
      rank: i + 1,
      amount: r.amount,
      count: r.count,
      percentDoTotal: totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0,
      trendPct,
      trend,
      trendVisual: TREND_VISUAL[trend],
    }
  })

  // Concentração top 5 (independe do topN — sempre 5 fixo)
  const top5Sum = sorted.slice(0, 5).reduce((s, r) => s + r.amount, 0)
  const concentracaoTop5 = totalAmount > 0 ? (top5Sum / totalAmount) * 100 : 0

  return {
    rows,
    totalAmount,
    totalCount,
    totalSuppliersUnique: sorted.length,
    concentracaoTop5,
  }
}
