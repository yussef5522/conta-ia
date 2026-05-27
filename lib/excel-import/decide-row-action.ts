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

/**
 * Sprint 5.0.2.4 — Decide se uma linha do staging precisa de revisão humana.
 *
 * REGRA CORRIGIDA: marcar NEEDS_REVIEW SÓ quando classify.confidence (favorecido)
 * é baixo. NÃO incluir categoryConfidence — categoria com confidence 0 só
 * significa "propor nova com nome do CC" (estratégia 4 do mapCategories) —
 * caminho normal, não justifica skip.
 *
 * Sprint 5.0.2.0 ORIGINAL incluía `categoryConfidence < 0.7` no critério →
 * 46/94 linhas do Cacula viraram NEEDS_REVIEW → /confirm skipou silenciosamente
 * → R$ 76.405,02 fora do DRE (bug Sprint 5.0.2.4).
 *
 * @param favorecidoConfidence Confidence do classifyFavorecido (0-1). Baixo
 *   significa ambiguidade real (nome que pode ser PF ou PJ, etc).
 * @param threshold Default 0.7. Configurável pra testes.
 */
export function decideStagedUserDecision(
  favorecidoConfidence: number,
  threshold = 0.7,
): 'NEEDS_REVIEW' | 'INCLUDE' {
  return favorecidoConfidence < threshold ? 'NEEDS_REVIEW' : 'INCLUDE'
}
