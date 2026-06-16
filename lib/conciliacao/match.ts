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
import { normalizeForMatch } from './normalize-for-match'

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

// Sprint Find&Match World-Class (15/06/2026) — chaves estáveis pra UI.
// `reasoning[]` continua existindo (legível pra logs); `reasons[]` é a
// versão estruturada que vira chips coloridos no painel Find & Match.
export type MatchReason =
  | 'VALOR_EXATO'
  | 'VALOR_PROXIMO_1PCT'
  | 'VALOR_PROXIMO_5PCT'
  | 'DATA_MESMA'
  | 'DATA_D1'
  | 'DATA_PROXIMA'
  | 'DATA_SEMANA'
  | 'FORNECEDOR_IGUAL'
  | 'DESC_MUITO_SIMILAR'
  | 'DESC_SIMILAR'

export interface MatchScore {
  candidateId: string
  score: number
  breakdown: MatchScoreBreakdown
  reasoning: string[]
  /** Sprint Find&Match World-Class: chaves estáveis pros chips do "porque". */
  reasons: MatchReason[]
}

export type MatchRecommendation = 'AUTO_RECONCILE' | 'CONFIRM' | 'NO_MATCH'

export const AUTO_RECONCILE_THRESHOLD = 90
export const CONFIRM_THRESHOLD = 70

// Sprint Find&Match World-Class — pontuação mínima de VALOR que conta
// como "valor próximo" (≤5% de diferença). Usado pra detectar nudge
// "isso provavelmente é Create" no painel Find & Match.
export const AMOUNT_CLOSE_MIN_POINTS = 25

export interface ScoreOptions {
  /**
   * Sprint Find&Match World-Class: quando `true`, NÃO descarta candidatos
   * cujo valor está fora de ±5% — só atribui 0 pts em VALOR. Continua
   * descartando por direção (DEBIT↔PAYABLE) e valores zero.
   *
   * Default `false` mantém comportamento Sprint 4.0.2 (auto-match no XeroRow).
   * Find & Match passa `true` porque user busca manualmente e pode achar
   * um candidato com valor levemente diferente (ex: AP R$ 1.000 vs OFX
   * R$ 1.010 com taxa banco — ainda é o match certo).
   */
  allowAnyAmount?: boolean
}

function differenceInDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY)
}

export function scoreMatch(
  ofx: OFXTransaction,
  candidate: MatchCandidate,
  opts: ScoreOptions = {},
): MatchScore | null {
  const breakdown: MatchScoreBreakdown = { amount: 0, date: 0, supplier: 0, description: 0 }
  const reasoning: string[] = []
  const reasons: MatchReason[] = []

  // Coerência de direção: OFX DEBIT casa com PAYABLE (saída),
  // OFX CREDIT casa com RECEIVABLE (entrada).
  if (ofx.type === 'DEBIT' && candidate.lifecycle !== 'PAYABLE') return null
  if (ofx.type === 'CREDIT' && candidate.lifecycle !== 'RECEIVABLE') return null

  // 1) VALOR — peso alto. < 0.95 descarta (auto-match) ou 0 pts (Find & Match).
  const aAmount = Math.abs(ofx.amount)
  const cAmount = Math.abs(candidate.amount)
  if (aAmount === 0 || cAmount === 0) return null
  const ratio = Math.min(aAmount, cAmount) / Math.max(aAmount, cAmount)
  if (ratio === 1) {
    breakdown.amount = 50
    reasoning.push('Valor exato')
    reasons.push('VALOR_EXATO')
  } else if (ratio >= 0.99) {
    breakdown.amount = 40
    reasoning.push('Valor diff ≤1% (centavos)')
    reasons.push('VALOR_PROXIMO_1PCT')
  } else if (ratio >= 0.95) {
    breakdown.amount = 25
    reasoning.push('Valor diff ≤5% (taxa banco?)')
    reasons.push('VALOR_PROXIMO_5PCT')
  } else if (!opts.allowAnyAmount) {
    return null
  }
  // allowAnyAmount=true e ratio < 0.95: breakdown.amount fica 0,
  // mas o candidato continua no ranking. UI mostra "valor distante" via banner.

  // 2) DATA
  const days = Math.abs(differenceInDays(ofx.date, candidate.dueDate))
  if (days === 0) {
    breakdown.date = 30
    reasoning.push('Mesmo dia')
    reasons.push('DATA_MESMA')
  } else if (days <= 1) {
    breakdown.date = 25
    reasoning.push(`D±1 dia`)
    reasons.push('DATA_D1')
  } else if (days <= 3) {
    breakdown.date = 15
    reasoning.push(`Diferença ${days} dias`)
    reasons.push('DATA_PROXIMA')
  } else if (days <= 7) {
    breakdown.date = 5
    reasoning.push(`Diferença ${days} dias`)
    reasons.push('DATA_SEMANA')
  }
  // > 7 dias: zero pontos mas não descarta (valor + supplier podem salvar)

  // 3) SUPPLIER match exato
  if (ofx.supplierId && candidate.supplierId && ofx.supplierId === candidate.supplierId) {
    breakdown.supplier = 15
    reasoning.push('Fornecedor exato')
    reasons.push('FORNECEDOR_IGUAL')
  }

  // 4) DESCRIÇÃO — jaroWinkler na descrição normalizada PRA MATCH
  // Sprint A: usa normalizeForMatch (preserva nome do fornecedor, strippa
  // só sufixos comerciais tipo "- Pagamento") em vez do normalizeDescription
  // de categorização (que mataria o nome do fornecedor).
  const ofxNorm = normalizeForMatch(ofx.description)
  const candNorm = normalizeForMatch(candidate.description)
  if (ofxNorm && candNorm) {
    const sim = jaroWinkler(ofxNorm, candNorm)
    if (sim >= 0.85) {
      breakdown.description = 10
      reasoning.push(`Descrição muito similar (${Math.round(sim * 100)}%)`)
      reasons.push('DESC_MUITO_SIMILAR')
    } else if (sim >= 0.65) {
      breakdown.description = 5
      reasoning.push(`Descrição similar (${Math.round(sim * 100)}%)`)
      reasons.push('DESC_SIMILAR')
    }
  }

  const score =
    breakdown.amount + breakdown.date + breakdown.supplier + breakdown.description

  return { candidateId: candidate.id, score, breakdown, reasoning, reasons }
}

export function rankCandidates(
  ofx: OFXTransaction,
  candidates: MatchCandidate[],
  opts: ScoreOptions = {},
): MatchScore[] {
  return candidates
    .map((c) => scoreMatch(ofx, c, opts))
    .filter((m): m is MatchScore => m !== null)
    .sort((a, b) => b.score - a.score)
}

export function classifyRecommendation(score: number): MatchRecommendation {
  if (score >= AUTO_RECONCILE_THRESHOLD) return 'AUTO_RECONCILE'
  if (score >= CONFIRM_THRESHOLD) return 'CONFIRM'
  return 'NO_MATCH'
}
