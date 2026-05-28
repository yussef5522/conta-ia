// Sprint 5.0.4.0c1 — Algoritmo de detecção de variâncias.
//
// Threshold-based: compara categoria × categoria entre 2 períodos e classifica
// em 9 levels. Materiality filter exclui valores pequenos (default R$ 500).
//
// FUNÇÃO PURA — sem DB, sem IO. Caller orquestra coleta + chamada.

export type VarianceLevel =
  | 'NEW' // Categoria não existia no período base
  | 'CRITICAL_UP' // +50% ou mais
  | 'HIGH_UP' // +25% a +50%
  | 'MODERATE_UP' // +15% a +25%
  | 'STABLE' // ±15% (FILTRADO out do resultado final)
  | 'MODERATE_DOWN' // -15% a -25%
  | 'HIGH_DOWN' // -25% a -50%
  | 'CRITICAL_DOWN' // -50% ou pior
  | 'DISAPPEARED' // Existia, sumiu (current = 0)

export type VarianceSeverity = 'critical' | 'high' | 'moderate' | 'low'

export type VarianceType =
  | 'increase'
  | 'decrease'
  | 'new'
  | 'disappeared'
  | 'stable'

export interface CategoryPeriodData {
  categoryId: string
  categoryName: string
  dreGroup: string | null
  /** Sempre positivo (soma de DEBITs sem sinal) */
  amount: number
}

export interface VarianceResult {
  categoryId: string
  categoryName: string
  dreGroup: string | null
  currentAmount: number
  baseAmount: number
  /** R$ — current - base (negativo se reduziu) */
  variationAbs: number
  /** % — null quando base = 0 (NEW) ou ambos 0 */
  variationPct: number | null
  level: VarianceLevel
  severity: VarianceSeverity
  type: VarianceType
}

export interface DetectVariancesOptions {
  /** Mínimo R$ pra entrar (em pelo menos um dos períodos). Default 500. */
  minAbsoluteValue?: number
  /** Se true, inclui STABLE no resultado (default false — filtra) */
  includeStable?: boolean
}

const DEFAULT_MIN_ABSOLUTE = 500

/**
 * Detecta variâncias entre categoria × categoria.
 *
 * @param current Dados do período atual (Maio/2026 por exemplo)
 * @param base Dados do período base (Abril/2026 por exemplo)
 * @param options.minAbsoluteValue Threshold de materiality (R$). Categorias com
 *   maxAmount < threshold são IGNORADAS (não entram no resultado).
 * @param options.includeStable Se true, mantém STABLE no array final.
 *
 * @returns Array de variâncias detectadas. Ordenado por severidade DESC + |variationAbs| DESC.
 */
export function detectVariances(
  current: CategoryPeriodData[],
  base: CategoryPeriodData[],
  options: DetectVariancesOptions = {},
): VarianceResult[] {
  const minAbs = options.minAbsoluteValue ?? DEFAULT_MIN_ABSOLUTE
  const includeStable = options.includeStable ?? false

  const baseMap = new Map(base.map((c) => [c.categoryId, c]))
  const currentMap = new Map(current.map((c) => [c.categoryId, c]))
  const allIds = new Set([...baseMap.keys(), ...currentMap.keys()])

  const results: VarianceResult[] = []

  for (const catId of allIds) {
    const cur = currentMap.get(catId)
    const baseData = baseMap.get(catId)

    const curAmount = cur?.amount ?? 0
    const baseAmount = baseData?.amount ?? 0

    // Materiality: maior valor (current ou base) precisa atingir threshold
    const maxAmount = Math.max(curAmount, baseAmount)
    if (maxAmount < minAbs) continue

    // Classificação
    let level: VarianceLevel
    let severity: VarianceSeverity
    let type: VarianceType
    let variationPct: number | null

    if (!baseData && cur) {
      // Categoria NOVA
      level = 'NEW'
      severity = 'high'
      type = 'new'
      variationPct = null
    } else if (!cur && baseData) {
      // Categoria DESAPARECEU
      level = 'DISAPPEARED'
      severity = 'moderate'
      type = 'disappeared'
      variationPct = null
    } else if (baseData && cur) {
      // Ambos presentes — calcular variação %
      variationPct = baseAmount === 0
        ? null
        : ((curAmount - baseAmount) / baseAmount) * 100

      if (variationPct === null) {
        // Edge case: base 0 mas cur > 0 — equivale a NEW
        level = 'NEW'
        severity = 'high'
        type = 'new'
      } else {
        const absPct = Math.abs(variationPct)
        if (absPct < 15) {
          level = 'STABLE'
          severity = 'low'
          type = 'stable'
        } else if (variationPct >= 50) {
          level = 'CRITICAL_UP'
          severity = 'critical'
          type = 'increase'
        } else if (variationPct >= 25) {
          level = 'HIGH_UP'
          severity = 'high'
          type = 'increase'
        } else if (variationPct >= 15) {
          level = 'MODERATE_UP'
          severity = 'moderate'
          type = 'increase'
        } else if (variationPct <= -50) {
          level = 'CRITICAL_DOWN'
          severity = 'critical'
          type = 'decrease'
        } else if (variationPct <= -25) {
          level = 'HIGH_DOWN'
          severity = 'high'
          type = 'decrease'
        } else {
          level = 'MODERATE_DOWN'
          severity = 'moderate'
          type = 'decrease'
        }
      }
    } else {
      // Ambos undefined — impossível (já filtrado por allIds)
      continue
    }

    results.push({
      categoryId: catId,
      categoryName: cur?.categoryName ?? baseData!.categoryName,
      dreGroup: cur?.dreGroup ?? baseData?.dreGroup ?? null,
      currentAmount: curAmount,
      baseAmount,
      variationAbs: curAmount - baseAmount,
      variationPct,
      level,
      severity,
      type,
    })
  }

  // Filtra STABLE se opcao não permite
  const filtered = includeStable
    ? results
    : results.filter((r) => r.level !== 'STABLE')

  // Ordena por severidade DESC + |variationAbs| DESC
  const severityRank: Record<VarianceSeverity, number> = {
    critical: 3,
    high: 2,
    moderate: 1,
    low: 0,
  }
  return filtered.sort((a, b) => {
    const sevDiff = severityRank[b.severity] - severityRank[a.severity]
    if (sevDiff !== 0) return sevDiff
    return Math.abs(b.variationAbs) - Math.abs(a.variationAbs)
  })
}

/**
 * Sumariza variâncias em buckets por severidade.
 * Útil pros stats cards do topo da página.
 */
export interface VarianceSummary {
  critical: { count: number; totalImpact: number }
  high: { count: number; totalImpact: number }
  moderate: { count: number; totalImpact: number }
  new: { count: number; totalImpact: number }
}

export function summarizeVariances(variances: VarianceResult[]): VarianceSummary {
  const summary: VarianceSummary = {
    critical: { count: 0, totalImpact: 0 },
    high: { count: 0, totalImpact: 0 },
    moderate: { count: 0, totalImpact: 0 },
    new: { count: 0, totalImpact: 0 },
  }

  for (const v of variances) {
    if (v.severity === 'critical') {
      summary.critical.count++
      summary.critical.totalImpact += v.variationAbs
    } else if (v.severity === 'high') {
      summary.high.count++
      summary.high.totalImpact += v.variationAbs
    } else if (v.severity === 'moderate') {
      summary.moderate.count++
      summary.moderate.totalImpact += v.variationAbs
    }
    // "new" overlap com high — conta separado pra card dedicado
    if (v.level === 'NEW') {
      summary.new.count++
      summary.new.totalImpact += v.currentAmount
    }
  }

  return summary
}
