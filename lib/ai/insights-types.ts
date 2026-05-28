// Hotfix 5.0.4.0c1-fix — Tipos compartilhados pros insights narrativos.
// REFATORADO: union discriminada por modo (comparative/evolution/single).

export type InsightDestaqueTipo = 'alerta' | 'positivo' | 'atencao'

export interface InsightDestaque {
  tipo: InsightDestaqueTipo
  /** 5-10 palavras */
  titulo: string
  /** 1-3 frases */
  descricao: string
  /** Nome da categoria envolvida (opcional) */
  categoria?: string
  /** Valor formatado em R$ (opcional) */
  valor?: string
  /** Pergunta pra reflexão do gestor (opcional) */
  perguntaSugerida?: string
}

export interface InsightOutput {
  /** 1-2 frases capturando o essencial */
  resumoExecutivo: string
  destaques: InsightDestaque[]
  /** Lista de ações práticas em 1 frase cada */
  recomendacoes: string[]
}

export type InsightMode = 'comparative' | 'evolution' | 'single'

// ============================================================
// InsightInputData — union discriminada por modo
// ============================================================

export interface InsightPeriodTotals {
  receita: number
  despesas: number
  lucro: number
  margem: number
}

export interface InsightCategorySnapshot {
  name: string
  amount: number
  percent: number
}

export interface InsightVarianceItem {
  categoryName: string
  level: string
  currentAmount: number
  baseAmount: number
  variationPct: number | null
}

export interface InsightMonthlySnapshot {
  /** "Janeiro/2026" */
  label: string
  /** YYYY-MM */
  ym: string
  receita: number
  despesas: number
  lucro: number
  margem: number
}

export interface InsightEmergingCategory {
  name: string
  total: number
  /** "Março/2026" */
  firstMonth: string
}

export interface InsightDisappearedCategory {
  name: string
  total: number
  /** Último mês com movimento — "Fevereiro/2026" */
  lastMonth: string
}

export interface InsightTopCategoryEvolution {
  name: string
  /** Total no período inteiro */
  total: number
  /** Em quantos meses do período apareceu */
  monthsPresent: number
}

interface BaseInputData {
  empresaId: string
  empresaName: string
  /** YYYY-MM-DD ISO */
  startDate: string
  endDate: string
  /** Label longo "1 de Maio a 31 de Maio de 2026" pra prompt */
  periodLabel: string
}

export interface ComparativeInputData extends BaseInputData {
  mode: 'comparative'
  /** YYYY-MM-DD ISO */
  compareStartDate: string
  compareEndDate: string
  compareLabel: string
  currentTotals: InsightPeriodTotals
  baseTotals: InsightPeriodTotals
  variances: InsightVarianceItem[]
  topCategoriesCurrent: InsightCategorySnapshot[]
}

export interface EvolutionInputData extends BaseInputData {
  mode: 'evolution'
  /** Snapshots mensais ordenados ASC */
  months: InsightMonthlySnapshot[]
  /** Top categorias no PERÍODO TODO (não mês específico) */
  topCategories: InsightTopCategoryEvolution[]
  emergingCategories: InsightEmergingCategory[]
  disappearedCategories: InsightDisappearedCategory[]
}

export interface SingleInputData extends BaseInputData {
  mode: 'single'
  currentTotals: InsightPeriodTotals
  topCategoriesCurrent: InsightCategorySnapshot[]
}

export type InsightInputData =
  | ComparativeInputData
  | EvolutionInputData
  | SingleInputData

// ============================================================
// API result
// ============================================================

export type InsightApiResult =
  | {
      kind: 'success'
      insights: InsightOutput
      cacheHit: boolean
      tokensUsed?: { input: number; output: number }
      costCents?: number
    }
  | { kind: 'cache-hit'; insights: InsightOutput; cachedAt: Date }
  | { kind: 'disabled'; reason: string }
  | { kind: 'rate-limited' }
  | { kind: 'invalid-json'; rawText: string }
  | { kind: 'error'; status?: number; message: string }
