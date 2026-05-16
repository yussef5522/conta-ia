// Predição de categoria via regras aprendidas — Fase 3 Etapa 1.
// Função PURA — sem Prisma.
//
// Estratégia de match (ordem de prioridade):
//   1. EXACT — descrição literal normalizada igual ao padrão da regra.
//      Confidence usada = rule.confianca (default 1.0).
//   2. NORMALIZED — descrição APÓS strip prefixo/data igual ao padrão.
//      Confidence usada = rule.confianca * 0.9 (penalidade por ser inferência).
//
// MULTI-TENANT: caller DEVE filtrar regras por companyId antes de passar.
// Função não checa — mas RuleIndex carrega companyId pra defesa em profundidade.

import { normalizeDescription, normalizeExact } from './normalize'
import type {
  Prediction,
  RuleSnapshot,
  TipoMatch,
  TxSnapshot,
} from './types'

// Penalidade aplicada quando match é NORMALIZED (vs EXACT).
// 1.0 manual → 0.9 normalized → cai em AUTO threshold (≥0.95)
// 0.85 normalized → 0.765 → cai em SUGESTAO (entre 0.75 e 0.95)
// Garantia: NORMALIZED nunca dispara AUTO no import.
const NORMALIZED_PENALTY = 0.9

// Index O(1) de regras por padrão.
//
// Duas estruturas pra busca dual:
//   exactByPattern: lookup direto via descrição original normalizada (case+acentos)
//   normalizedByPattern: lookup via descrição com strip prefixo+data
//
// Multi-tenant: armazena companyId. Caller deve filtrar antes de buildRuleIndex.
export interface RuleIndex {
  companyId: string
  exactByPattern: Map<string, RuleSnapshot>
  normalizedByPattern: Map<string, RuleSnapshot>
}

export function buildRuleIndex(
  companyId: string,
  rules: RuleSnapshot[],
): RuleIndex {
  if (!companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  const exactByPattern = new Map<string, RuleSnapshot>()
  const normalizedByPattern = new Map<string, RuleSnapshot>()

  for (const rule of rules) {
    // Defesa em profundidade: NUNCA indexar regra de outra empresa.
    if (rule.companyId !== companyId) continue
    // Regras inativas são ignoradas no index (caller pode filtrar também).
    if (!rule.isActive) continue
    // categoryId null = regra de supplier only (BrasilAPI futura), skip por ora
    if (!rule.categoryId) continue

    if (rule.tipoMatch === 'EXACT') {
      exactByPattern.set(rule.padrao, rule)
    } else if (rule.tipoMatch === 'NORMALIZED') {
      normalizedByPattern.set(rule.padrao, rule)
    }
    // Outros tipos (CONTAINS, CNPJ) ignorados nesta Etapa 1
  }

  return { companyId, exactByPattern, normalizedByPattern }
}

// Predição: retorna a melhor regra que casa com a transação OU null.
//
// Prioridade EXACT > NORMALIZED. Se nenhum match → null.
export function predictCategory(
  tx: { description: string },
  index: RuleIndex,
): Prediction | null {
  if (!tx.description) return null

  // 1. Tentativa EXACT
  const exactKey = normalizeExact(tx.description)
  const exactRule = index.exactByPattern.get(exactKey)
  if (exactRule) {
    return predictionFromRule(exactRule, 'EXACT', exactRule.confianca)
  }

  // 2. Tentativa NORMALIZED (com strip de prefixo nome próprio + data)
  const normKey = normalizeDescription(tx.description)
  const normRule = index.normalizedByPattern.get(normKey)
  if (normRule) {
    const adjustedConfidence = Math.min(
      normRule.confianca * NORMALIZED_PENALTY,
      1.0,
    )
    return predictionFromRule(normRule, 'NORMALIZED', adjustedConfidence)
  }

  return null
}

function predictionFromRule(
  rule: RuleSnapshot,
  tipoMatch: TipoMatch,
  confidence: number,
): Prediction {
  return {
    ruleId: rule.id,
    categoryId: rule.categoryId,
    supplierId: rule.supplierId,
    confidence,
    tipoMatch,
  }
}

// Predict em batch (otimização pro import). Retorna Map<txId, Prediction | null>.
export function predictBatch(
  txs: TxSnapshot[],
  index: RuleIndex,
): Map<string, Prediction | null> {
  const result = new Map<string, Prediction | null>()
  for (const tx of txs) {
    result.set(tx.id, predictCategory(tx, index))
  }
  return result
}
