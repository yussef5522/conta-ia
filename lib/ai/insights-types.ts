// Sprint 5.0.4.0c1 — Tipos compartilhados pros insights narrativos.

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

export interface InsightInputData {
  empresaId: string
  empresaName: string
  currentPeriod: string // YYYY-MM
  basePeriod: string // YYYY-MM
  currentLabel: string // "Maio/2026"
  baseLabel: string // "Abril/2026"
  currentTotals: {
    receita: number
    despesas: number
    lucro: number
    margem: number
  }
  baseTotals: {
    receita: number
    despesas: number
    lucro: number
    margem: number
  }
  variances: Array<{
    categoryName: string
    level: string
    currentAmount: number
    baseAmount: number
    variationPct: number | null
  }>
  topCategoriesCurrent: Array<{
    name: string
    amount: number
    percent: number
  }>
}

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
