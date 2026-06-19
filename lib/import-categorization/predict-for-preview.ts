// Sprint Import Categoria Editável (18/06/2026) — sugestão de categoria
// no PREVIEW (read-only, não muta nada).
//
// Reusa pipeline existente:
//   1. AiLearningRule (Camada 1) — RULE: EXACT > CNPJ > CONTAINS
//   2. SetorPattern (Camada 2C)  — padrão setorial UNIVERSAL + setor empresa
//   3. fallback: "A classificar" (confiança REVISAR)
//
// Transferência interna (detectada pelo detector) NUNCA recebe categoria —
// caller deve filtrar antes de chamar esta função.

import { predictCategory } from '@/lib/ai-categorizer/predict'
import type { RuleIndex } from '@/lib/ai-categorizer/predict'
import { matchAgainstPatterns } from '@/lib/categorization/match-setor-pattern'
import type { SetorPatternSnapshot } from '@/lib/categorization/match-setor-pattern'

export type SuggestionSource = 'RULE' | 'SETOR' | 'DEFAULT'

export type SuggestionConfidence = 'ALTA' | 'REVISAR'

export interface PreviewSuggestion {
  /** Identidade da tx incoming (dedupHash já calculado) */
  dedupHash: string
  /** categoryId proposto (null = "A classificar") */
  categoryId: string | null
  /** dreGroup proposto */
  dreGroup: string | null
  /** Nome legível (pra UI mostrar inline na bolinha) */
  categoryName: string | null
  /** ALTA = aplicar direto; REVISAR = bolinha amarela, aba Revisar */
  confidence: SuggestionConfidence
  /** Origem da sugestão (debug/explicabilidade) */
  source: SuggestionSource
  /** ID da AiLearningRule que disparou (caso source=RULE) — pro vezesAplicada */
  matchedRuleId?: string
}

export interface PreviewTx {
  dedupHash: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT' | string
}

export interface PreviewSuggestionContext {
  ruleIndex: RuleIndex
  setorPatterns: SetorPatternSnapshot[]
  /** Mapa categoryName → categoryId pra resolver SETOR matches */
  setorCategoryByName: Map<string, { id: string; dreGroup: string | null }>
  /** Mapa categoryId → { name, dreGroup } pra etiqueta na UI */
  categoryById: Map<string, { name: string; dreGroup: string | null }>
}

/**
 * Sugere categoria pra cada tx — função PURA (não acessa DB).
 * Caller carrega `ctx` com snapshot de rules/setor/categorias.
 *
 * Ordem de prioridade:
 *   1. AiLearningRule match (EXACT > CNPJ > CONTAINS) — ALTA, source=RULE
 *   2. SetorPattern match com confiança ≥ 0.90 — ALTA, source=SETOR
 *   3. SetorPattern match com confiança < 0.90 — REVISAR, source=SETOR
 *   4. Sem match — REVISAR, source=DEFAULT
 */
export function predictSuggestionsForPreview(
  txs: PreviewTx[],
  ctx: PreviewSuggestionContext,
): PreviewSuggestion[] {
  const SETOR_AUTO_THRESHOLD = 0.9
  const result: PreviewSuggestion[] = []

  for (const tx of txs) {
    // Camada 1: AiLearningRule
    const pred = predictCategory(
      { description: tx.description },
      ctx.ruleIndex,
    )
    if (pred && pred.categoryId && pred.confidence >= 0.95) {
      const cat = ctx.categoryById.get(pred.categoryId)
      result.push({
        dedupHash: tx.dedupHash,
        categoryId: pred.categoryId,
        dreGroup: cat?.dreGroup ?? null,
        categoryName: cat?.name ?? null,
        confidence: 'ALTA',
        source: 'RULE',
        matchedRuleId: pred.ruleId,
      })
      continue
    }

    // Camada 2C: SetorPattern
    const setorMatch = matchAgainstPatterns(
      { description: tx.description, type: tx.type as 'CREDIT' | 'DEBIT' },
      ctx.setorPatterns,
    )
    if (setorMatch) {
      const resolved = ctx.setorCategoryByName.get(setorMatch.pattern.categoryName)
      if (resolved) {
        result.push({
          dedupHash: tx.dedupHash,
          categoryId: resolved.id,
          dreGroup: resolved.dreGroup,
          categoryName: setorMatch.pattern.categoryName,
          confidence: setorMatch.pattern.confidence >= SETOR_AUTO_THRESHOLD ? 'ALTA' : 'REVISAR',
          source: 'SETOR',
        })
        continue
      }
    }

    // Fallback: "A classificar"
    result.push({
      dedupHash: tx.dedupHash,
      categoryId: null,
      dreGroup: null,
      categoryName: null,
      confidence: 'REVISAR',
      source: 'DEFAULT',
    })
  }

  return result
}
