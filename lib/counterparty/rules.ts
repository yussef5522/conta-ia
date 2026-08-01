// Sprint FASE 4 (01/08/2026) — regra "contraparte X → categoria Y".
// Reusa AiLearningRule com tipoMatch='CONTRAPARTE' (padrão = nome normalizado).
// Regra vale POR EMPRESA (o caller filtra por companyId). NUNCA global.
// Aditivo: só entra em ação quando a tx TEM counterpartyName.

import { normalizeCounterparty, counterpartyMatches } from './normalize'

export const CONTRAPARTE_TIPO_MATCH = 'CONTRAPARTE'

export interface CpRule {
  id: string
  padrao: string // nome normalizado da contraparte
  categoryId: string | null
}

/**
 * Retorna a regra que casa com a contraparte (caller já filtrou por empresa+ativas).
 * Matching conservador:
 *   1) igualdade normalizada (mais seguro)
 *   2) truncamento do banco (prefixo, guard de 8 chars em counterpartyMatches —
 *      nomes distintos curtos NÃO colidem).
 * Na dúvida, não casa (retorna null) — melhor pedir confirmação que errar.
 */
export function matchCounterpartyRule(
  counterpartyName: string | null | undefined,
  rules: CpRule[],
): CpRule | null {
  if (!counterpartyName) return null
  const norm = normalizeCounterparty(counterpartyName)
  if (!norm) return null
  const exact = rules.find((r) => r.categoryId && normalizeCounterparty(r.padrao) === norm)
  if (exact) return exact
  const trunc = rules.find((r) => r.categoryId && counterpartyMatches(counterpartyName, r.padrao))
  return trunc ?? null
}

/** Padrão normalizado pra criar/upsert a regra CONTRAPARTE (chave natural por empresa). */
export function counterpartyRulePattern(counterpartyName: string): string {
  return normalizeCounterparty(counterpartyName)
}
