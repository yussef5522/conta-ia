// Sprint 5.0.2.l — Engine de aplicação dos Padrões Universais BR.
//
// FUNÇÃO PURA: recebe descrição + type, devolve UniversalPattern | null.
//
// Estratégia:
//   1. Filtra padrões compatíveis com o tipo da transação (INCOME/EXPENSE/ANY)
//   2. Ordena por (confidence desc, pattern length desc) — mais específicos
//      primeiro (DAS SIMPLES bate antes de DAS MEI; GUIA ICMS antes de ICMS)
//   3. Itera e retorna o primeiro match
//
// Multi-tenant: PURO — não há acesso a DB. Caller decide o que fazer com
// o resultado (auto-aplicar ou só sugerir).

import {
  UNIVERSAL_PATTERNS_BR,
  type UniversalPattern,
} from './universal-patterns-br'

/** Tier de aplicação:
 *  - AUTO: confidence ≥ AUTO_THRESHOLD — auto-categoriza no import + bulk
 *  - SUGGEST: confidence < AUTO_THRESHOLD — só categoriza no bulk retroativo
 */
export const UNIVERSAL_AUTO_THRESHOLD = 0.9

export type UniversalApplyTier = 'AUTO' | 'SUGGEST'

// Pre-ordenado uma vez (data static); evita ordenar a cada chamada
const SORTED_PATTERNS: UniversalPattern[] = [...UNIVERSAL_PATTERNS_BR].sort(
  (a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.pattern.length - a.pattern.length
  },
)

export interface MatchUniversalInput {
  description: string | null | undefined
  /** 'CREDIT' = INCOME, 'DEBIT' = EXPENSE, 'TRANSFER' = ignora. Outros valores = ANY apenas. */
  type: string | null | undefined
}

export interface MatchUniversalResult {
  pattern: UniversalPattern
  tier: UniversalApplyTier
}

export function matchUniversalPattern(
  input: MatchUniversalInput,
): MatchUniversalResult | null {
  if (!input.description) return null

  const desc = input.description.toUpperCase()
  // Mapeia DEBIT/CREDIT → tipos da pattern table
  const txCat: 'INCOME' | 'EXPENSE' | null =
    input.type === 'CREDIT'
      ? 'INCOME'
      : input.type === 'DEBIT'
        ? 'EXPENSE'
        : null

  for (const pattern of SORTED_PATTERNS) {
    // Filtro de tipo: ANY casa qualquer; outros precisam de match exato
    if (pattern.type !== 'ANY') {
      if (txCat === null) continue
      if (pattern.type !== txCat) continue
    }

    const matched = (() => {
      switch (pattern.matchType) {
        case 'STARTS_WITH':
          return desc.startsWith(pattern.pattern)
        case 'CONTAINS':
          return desc.includes(pattern.pattern)
        case 'EQUALS':
          return desc.trim() === pattern.pattern
      }
    })()

    if (matched) {
      return {
        pattern,
        tier:
          pattern.confidence >= UNIVERSAL_AUTO_THRESHOLD ? 'AUTO' : 'SUGGEST',
      }
    }
  }

  return null
}

/**
 * Resolve categoryId a partir do match universal usando o plano de contas
 * da empresa.
 *
 * Estratégia:
 *   1. Match por NOME EXATO (case-insensitive) — categoryNameHint
 *   2. Match parcial — categoria contém o hint E mesmo dreGroup
 *   3. Match por dreGroup — primeira ATIVA com mesmo dreGroup
 *
 * Retorna null se nenhuma estratégia casar (caller decide se cria categoria
 * ou marca PENDING).
 */
export function resolveUniversalCategoryId(
  categories: Array<{ id: string; name: string; dreGroup: string | null; isActive: boolean }>,
  hint: { categoryNameHint: string; dreGroup: string },
): string | null {
  const target = hint.categoryNameHint.toLowerCase().trim()

  // 1. Match exato por nome
  const byName = categories.find(
    (c) => c.isActive && c.name.toLowerCase().trim() === target,
  )
  if (byName) return byName.id

  // 2. Match parcial + mesmo dreGroup
  const byPartial = categories.find(
    (c) =>
      c.isActive &&
      c.name.toLowerCase().includes(target) &&
      c.dreGroup === hint.dreGroup,
  )
  if (byPartial) return byPartial.id

  // 3. Fallback por dreGroup
  const byGroup = categories.find(
    (c) => c.isActive && c.dreGroup === hint.dreGroup,
  )
  if (byGroup) return byGroup.id

  return null
}
