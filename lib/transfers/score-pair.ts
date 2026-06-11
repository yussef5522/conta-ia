// Sprint R1 (10/06/2026) — Fórmula de score UNIFICADA pra preview OFX +
// varredura retroativa. Antes vivia em 2 lugares com diferenças reais:
//   - lib/ofx/detect-transfer.ts (preview): NÃO usava own-entity-signals
//   - lib/transfers/detect-retroactive.ts (varredura): USAVA
//
// Resultado: preview "pega umas e falha em outras" — exatamente o Gap 4
// reportado. Centralizar aqui resolve.
//
// PESOS (Sprint R1):
//   - proximidade temporal: 0.50 mesmo dia | 0.40 D+1 | 0.30 D+2/D+3
//     (bump 0.45→0.50 mesmo dia e 0.35→0.40 D+1 pra não regredir preview
//      em bancos que não gravam CNPJ no memo — ex: extratos Itaú/Bradesco
//      com TED demorada e memo sem CNPJ)
//   - valor exato: 0.20 (assumido — caller já filtrou ±0.01)
//   - own-entity (CNPJ/nome/conta próprios): até +0.35 (max dos 2 lados)
//   - keyword forte (TRANSF/PIX_DEB/PIX_ENVIADO/TED/DOC/ENTRE CONTAS): +0.10
//   - keyword soft (PIX puro): +0.05
//
// THRESHOLDS:
//   - PAIR_THRESHOLD = 0.85 (entra em "Sugeridas" / level=HIGH)
//   - CONFIRM_THRESHOLD = 0.70 (preview level=MEDIUM)
//   - <0.70: ignorado
//
// Função PURA — caller passa tudo carregado, sem DB.

import { extractOwnSignals, type OwnEntityRefs } from './own-entity-signals'

export const MS_PER_DAY = 24 * 60 * 60 * 1000
export const CENT_TOLERANCE = 0.015
export const MAX_DELTA_DAYS = 3

export const PAIR_THRESHOLD = 0.85
export const CONFIRM_THRESHOLD = 0.70

// Pesos
const SAME_DAY_WEIGHT = 0.5
const D_PLUS_1_WEIGHT = 0.4
const D_PLUS_2_3_WEIGHT = 0.3
const AMOUNT_EXACT_WEIGHT = 0.2
const STRONG_KEYWORD_BOOST = 0.1
const SOFT_KEYWORD_BOOST = 0.05

// Keywords
// Forte: termos quase-exclusivamente de transferência interna
const STRONG_KEYWORDS =
  /\b(transfer[eê]ncia|transferencia|transf|entre\s+contas|pix[\s_-]*deb|pix[\s_-]*enviado|pix[\s_-]*recebido|envio\s+pix|pagamento\s+pix|ted|doc)\b/i
// Soft: PIX puro (também aparece em venda recebida — boost pequeno)
const SOFT_KEYWORDS = /\bpix\b/i

export interface TxForScoring {
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT' | string
  date: Date
}

export type ScoreLevel = 'HIGH' | 'MEDIUM' | null
export type SuggestedAction = 'AUTO_PAIR' | 'CONFIRM' | 'IGNORE'

export interface ScoringResult {
  /** 0-1, 2 casas decimais */
  confidence: number
  /** HIGH ≥ PAIR_THRESHOLD · MEDIUM ≥ CONFIRM_THRESHOLD · null abaixo */
  level: ScoreLevel
  /** Inteiro de dias entre as 2 datas */
  deltaDays: number
  /** Lista de evidências legíveis em pt-BR (pra UI mostrar) */
  evidences: string[]
  /** Keyword forte/soft matched (pra UI badge), null se nenhuma */
  matchedKeyword: 'STRONG' | 'SOFT' | null
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}

function diffInDays(a: Date, b: Date): number {
  // Normaliza pra meia-noite pra evitar erro de fuso (preview vinha de
  // dates ISO sem hora, varredura vinha de DB com hora)
  const dayA = Math.floor(a.getTime() / MS_PER_DAY)
  const dayB = Math.floor(b.getTime() / MS_PER_DAY)
  return Math.abs(dayA - dayB)
}

/**
 * Pré-filtros obrigatórios (caller deve passar). Se algum falha, NÃO chama
 * scorePair — economiza CPU em varredura grande.
 *
 *   1. Mesma empresa (companyId match) — escopo da query
 *   2. Tipos opostos (CREDIT × DEBIT) — `txA.type !== txB.type`
 *   3. Contas diferentes — `txA.bankAccountId !== txB.bankAccountId`
 *   4. Valor exato ±0.015 — `Math.abs(a.amount - b.amount) <= CENT_TOLERANCE`
 *   5. Janela ≤ MAX_DELTA_DAYS — `diffInDays(a, b) <= MAX_DELTA_DAYS`
 *
 * Caller que NÃO faz pré-filtro tb funciona — `scorePair` retorna
 * confidence < CONFIRM_THRESHOLD nesses casos.
 */
export function scorePair(
  a: TxForScoring,
  b: TxForScoring,
  refs: OwnEntityRefs,
): ScoringResult {
  const evidences: string[] = []
  let score = 0

  const deltaDays = diffInDays(a.date, b.date)

  // 1) Proximidade temporal
  if (deltaDays === 0) {
    score += SAME_DAY_WEIGHT
    evidences.push('Mesmo dia')
  } else if (deltaDays === 1) {
    score += D_PLUS_1_WEIGHT
    evidences.push('D+1')
  } else if (deltaDays <= MAX_DELTA_DAYS) {
    score += D_PLUS_2_3_WEIGHT
    evidences.push(`D+${deltaDays}`)
  }
  // > MAX_DELTA_DAYS: 0 contribuição

  // 2) Valor exato (caller já filtrou; explícito pra UI)
  score += AMOUNT_EXACT_WEIGHT
  evidences.push('Valor exato')

  // 3) Sinais "own entity" — pega o MELHOR dos 2 lados (max, não soma)
  // pra evitar dupla contagem quando memo de ambos coincide
  const sigA = extractOwnSignals(a.description, refs)
  const sigB = extractOwnSignals(b.description, refs)
  const bestBoost = Math.max(sigA.scoreBoost, sigB.scoreBoost)
  score += bestBoost
  if (sigA.hasOwnCnpj || sigB.hasOwnCnpj) {
    evidences.push('CNPJ próprio')
  }
  if (sigA.hasOwnAccountName || sigB.hasOwnAccountName) {
    evidences.push('Nome de conta própria')
  }
  if (sigA.hasOwnName || sigB.hasOwnName) {
    evidences.push('Nome da empresa')
  }

  // 4) Keywords
  let matchedKeyword: 'STRONG' | 'SOFT' | null = null
  if (STRONG_KEYWORDS.test(a.description) || STRONG_KEYWORDS.test(b.description)) {
    score += STRONG_KEYWORD_BOOST
    evidences.push('Palavra de transferência')
    matchedKeyword = 'STRONG'
  } else if (
    SOFT_KEYWORDS.test(a.description) ||
    SOFT_KEYWORDS.test(b.description)
  ) {
    score += SOFT_KEYWORD_BOOST
    evidences.push('Contém PIX')
    matchedKeyword = 'SOFT'
  }

  const confidence = Math.min(1, roundTo2(score))
  const level: ScoreLevel =
    confidence >= PAIR_THRESHOLD
      ? 'HIGH'
      : confidence >= CONFIRM_THRESHOLD
        ? 'MEDIUM'
        : null

  return { confidence, level, deltaDays, evidences, matchedKeyword }
}

/**
 * Mapeia confidence numérica pra ação sugerida (compatível com UI atual).
 */
export function actionForConfidence(confidence: number): SuggestedAction {
  if (confidence >= PAIR_THRESHOLD) return 'AUTO_PAIR'
  if (confidence >= CONFIRM_THRESHOLD) return 'CONFIRM'
  return 'IGNORE'
}

/**
 * Helper opcional — chama scorePair com todos os pré-filtros.
 * Retorna null se algum pré-filtro falha (mais barato pra varredura O(n²)).
 */
export function scorePairWithGuards(
  a: TxForScoring & { bankAccountId?: string },
  b: TxForScoring & { bankAccountId?: string },
  refs: OwnEntityRefs,
): ScoringResult | null {
  // Tipos opostos
  const opposite =
    (a.type === 'CREDIT' && b.type === 'DEBIT') ||
    (a.type === 'DEBIT' && b.type === 'CREDIT')
  if (!opposite) return null

  // Contas diferentes (quando disponível)
  if (
    a.bankAccountId &&
    b.bankAccountId &&
    a.bankAccountId === b.bankAccountId
  )
    return null

  // Valor próximo
  if (Math.abs(a.amount - b.amount) > CENT_TOLERANCE) return null

  // Janela temporal
  if (diffInDays(a.date, b.date) > MAX_DELTA_DAYS) return null

  return scorePair(a, b, refs)
}
