// Sprint 4.0.2 — algoritmo de match OFX ↔ PAYABLE/RECEIVABLE (função PURA).
//
// Score 0-100 baseado em 4 critérios:
//   - Valor (50pts): exato (50), ≤1% diff (40), ≤5% (25), >5% descarta
//   - Data (30pts): mesmo dia (30), D±1 (25), ±3d (15), ±7d (5)
//   - Supplier match (15pts): supplierId batendo
//   - Descrição similar via jaroWinkler (10pts): ≥0.85 (10), ≥0.65 (5)
//
// Thresholds finais:
//   - ≥ 90: AUTO_RECONCILE (sistema concilia sem perguntar)
//   - 70-89: CONFIRM (mostra pro user com checkbox)
//   - < 70: NO_MATCH (não sugere; user vê tx OFX normal)
//
// Filtros pré-cálculo (responsabilidade do CALLER):
//   - Mesma empresa (multi-tenant)
//   - candidate.lifecycle IN PAYABLE/RECEIVABLE + status='PENDING'
//   - candidate.type compatível com ofx.type (CREDIT↔RECEIVABLE, DEBIT↔PAYABLE)
//   - Janela ±15 dias entre ofx.date e candidate.dueDate
//   - Valor candidate dentro ±20% do ofx.amount

import { jaroWinkler } from './jaro-winkler'
import { normalizeDescription } from '@/lib/ai-categorizer/normalize'

export interface MatchCandidate {
  id: string
  lifecycle: 'PAYABLE' | 'RECEIVABLE'
  description: string
  amount: number
  dueDate: Date
  supplierId: string | null
  customerId: string | null
  categoryId: string | null
}

export interface OFXTransaction {
  id: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  date: Date
  supplierId: string | null
  bankAccountId: string
}

export interface MatchScoreBreakdown {
  amount: number
  date: number
  supplier: number
  description: number
}

export interface MatchScore {
  candidateId: string
  score: number
  breakdown: MatchScoreBreakdown
  reasoning: string[]
}

export type MatchRecommendation = 'AUTO_RECONCILE' | 'CONFIRM' | 'NO_MATCH'

export const AUTO_RECONCILE_THRESHOLD = 90
export const CONFIRM_THRESHOLD = 70

function differenceInDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY)
}

export function scoreMatch(
  ofx: OFXTransaction,
  candidate: MatchCandidate,
): MatchScore | null {
  const breakdown: MatchScoreBreakdown = { amount: 0, date: 0, supplier: 0, description: 0 }
  const reasoning: string[] = []

  // Coerência de direção: OFX DEBIT casa com PAYABLE (saída),
  // OFX CREDIT casa com RECEIVABLE (entrada).
  if (ofx.type === 'DEBIT' && candidate.lifecycle !== 'PAYABLE') return null
  if (ofx.type === 'CREDIT' && candidate.lifecycle !== 'RECEIVABLE') return null

  // 1) VALOR — peso alto. < 0.95 descarta (não vale calcular o resto)
  const aAmount = Math.abs(ofx.amount)
  const cAmount = Math.abs(candidate.amount)
  if (aAmount === 0 || cAmount === 0) return null
  const ratio = Math.min(aAmount, cAmount) / Math.max(aAmount, cAmount)
  if (ratio === 1) {
    breakdown.amount = 50
    reasoning.push('Valor exato')
  } else if (ratio >= 0.99) {
    breakdown.amount = 40
    reasoning.push('Valor diff ≤1% (centavos)')
  } else if (ratio >= 0.95) {
    breakdown.amount = 25
    reasoning.push('Valor diff ≤5% (taxa banco?)')
  } else {
    return null
  }

  // 2) DATA
  const days = Math.abs(differenceInDays(ofx.date, candidate.dueDate))
  if (days === 0) {
    breakdown.date = 30
    reasoning.push('Mesmo dia')
  } else if (days <= 1) {
    breakdown.date = 25
    reasoning.push(`D±1 dia`)
  } else if (days <= 3) {
    breakdown.date = 15
    reasoning.push(`Diferença ${days} dias`)
  } else if (days <= 7) {
    breakdown.date = 5
    reasoning.push(`Diferença ${days} dias`)
  }
  // > 7 dias: zero pontos mas não descarta (valor + supplier podem salvar)

  // 3) SUPPLIER match exato
  if (ofx.supplierId && candidate.supplierId && ofx.supplierId === candidate.supplierId) {
    breakdown.supplier = 15
    reasoning.push('Fornecedor exato')
  }

  // 4) DESCRIÇÃO — jaroWinkler na descrição normalizada
  const ofxNorm = normalizeDescription(ofx.description)
  const candNorm = normalizeDescription(candidate.description)
  if (ofxNorm && candNorm) {
    const sim = jaroWinkler(ofxNorm, candNorm)
    if (sim >= 0.85) {
      breakdown.description = 10
      reasoning.push(`Descrição muito similar (${Math.round(sim * 100)}%)`)
    } else if (sim >= 0.65) {
      breakdown.description = 5
      reasoning.push(`Descrição similar (${Math.round(sim * 100)}%)`)
    }
  }

  const score =
    breakdown.amount + breakdown.date + breakdown.supplier + breakdown.description

  return { candidateId: candidate.id, score, breakdown, reasoning }
}

export function rankCandidates(
  ofx: OFXTransaction,
  candidates: MatchCandidate[],
): MatchScore[] {
  return candidates
    .map((c) => scoreMatch(ofx, c))
    .filter((m): m is MatchScore => m !== null)
    .sort((a, b) => b.score - a.score)
}

export function classifyRecommendation(score: number): MatchRecommendation {
  if (score >= AUTO_RECONCILE_THRESHOLD) return 'AUTO_RECONCILE'
  if (score >= CONFIRM_THRESHOLD) return 'CONFIRM'
  return 'NO_MATCH'
}
