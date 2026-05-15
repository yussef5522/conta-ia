// AI Insights — Sprint 2 Dia 3.
// Tipos centrais. Detectors são funções PURAS que recebem InsightContext
// e retornam 0+ Insights.

export type InsightSeverity = 'alerta' | 'oportunidade' | 'sugestao' | 'parabens'

export interface InsightAction {
  label: string
  url: string
}

export interface Insight {
  // ID estável — usado pra "Dispensar" via sessionStorage.
  // Detectors devem usar prefixo do detector (ex: "pending-classifications").
  id: string
  severity: InsightSeverity
  priority: number // 1-10, maior = mais importante
  title: string
  description: string
  action?: InsightAction
  // Pra debug/tooltip "como sistema detectou" (Dia 5).
  metadata?: Record<string, unknown>
}

// Histórico de burn pra detect-burn-rate-spike: até 6 meses, ASC por monthKey.
export interface BurnHistoryEntry {
  monthKey: string // 'YYYY-MM'
  expense: number
  income: number
}

// Conta bancária pro detect-high-overdraft-usage.
export interface InsightAccountSnapshot {
  id: string
  name: string
  balance: number
  creditLimit: number
  allowNegativeBalance: boolean
}

// Contexto rico pré-buscado pela query — passado pra todos os detectors.
// Adicionar campo aqui = adicionar 1 query no loadInsights + detectors usam.
export interface InsightContext {
  companyId: string
  // Contagem de Transaction.status = 'PENDING'
  pendingCount: number
  // Contas ativas da empresa
  accounts: InsightAccountSnapshot[]
  // Últimos 6 meses (ASC). Detectors de tendência (burn spike) usam.
  burnHistory: BurnHistoryEntry[]
}

// Detector: função pura. Recebe contexto, retorna 0+ insights.
export type Detector = (ctx: InsightContext) => Insight[]
