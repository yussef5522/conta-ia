// Sprint 5.0.2.3 — Lógica pura que decide o que o /confirm faz com uma linha
// do staging. Extraído pra ter cobertura de teste independente da DB.

import { Prisma } from '@prisma/client'

export type RowDecision = 'INCLUDE' | 'EXCLUDE' | 'NEEDS_REVIEW' | string

export interface RowLike {
  rawFavorecido: string | null
  userDecision: RowDecision
}

export interface OverrideLike {
  decision?: 'INCLUDE' | 'EXCLUDE'
}

export type RowAction =
  /** Linha foi marcada pra exclusão (user ou staging). */
  | { kind: 'SKIP_EXCLUDED' }
  /** Linha sem favorecido — nunca cria Transaction. */
  | { kind: 'SKIP_NO_FAVORECIDO' }
  /** Linha pediu revisão e user NÃO fez override → pula pra próxima sprint. */
  | { kind: 'SKIP_NEEDS_REVIEW' }
  /** Tudo OK — caller pode criar Transaction. */
  | { kind: 'PROCEED' }

/**
 * Decide a ação do /confirm pra uma linha do staging. Ordem importante:
 *
 *   1. EXCLUDE explícito (override ou staging) → SKIP_EXCLUDED
 *   2. Sem favorecido (raw vazio/nulo) → SKIP_NO_FAVORECIDO
 *   3. NEEDS_REVIEW sem override INCLUDE → SKIP_NEEDS_REVIEW
 *   4. Qualquer outro caso → PROCEED
 *
 * Justificativa de ordem: override de decision tem precedência sobre staging
 * EXCETO quando rawFavorecido vazio — nunca cria Transaction sem favorecido,
 * mesmo se user marcou INCLUDE manualmente (defesa).
 */
export function decideRowAction(
  row: RowLike,
  override?: OverrideLike,
): RowAction {
  const overrideDecision = override?.decision
  const finalDecision = overrideDecision ?? row.userDecision

  if (finalDecision === 'EXCLUDE') return { kind: 'SKIP_EXCLUDED' }
  if (!row.rawFavorecido || row.rawFavorecido.trim() === '') {
    return { kind: 'SKIP_NO_FAVORECIDO' }
  }
  if (row.userDecision === 'NEEDS_REVIEW' && overrideDecision !== 'INCLUDE') {
    return { kind: 'SKIP_NEEDS_REVIEW' }
  }
  return { kind: 'PROCEED' }
}

/**
 * True se o erro é unique constraint violation (P2002) do Prisma.
 * Sprint 5.0.2.3 — usado pra skipar duplicatas no /confirm sem matar o batch.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  )
}
