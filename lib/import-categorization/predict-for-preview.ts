// Sprint Import Categoria Editável (18/06/2026) — sugestão de categoria
// no PREVIEW (read-only, não muta nada).
//
// Sprint Unificar-Pipelines-Import (01/07/2026):
//   ANTES: função tinha lógica de classificação DUPLICADA (só camada 1 RULE
//     + camada 2C SETOR inline), rodava predictCategory direto. Divergia de
//     autoClassifyTransactions (confirm) em edge cases — user via 23 tx a
//     revisar mas confirm criava 39 (16 auto-classificadas escondidas).
//   AGORA: delega tudo pra `classifyTransactionsShared` (mesma função pura
//     que autoClassifyTransactions usa). Preview e confirm rodam a MESMA
//     função com o MESMO ctx → resultado idêntico bit-a-bit.
//
// GARANTIA ARQUITETURAL: o preview mostra EXATAMENTE o que o confirm vai
// criar. Não é promessa — é construção. Se um dia divergir, é bug numa
// única função (classify-shared), não em 2 pipelines paralelos.
//
// Transferência interna (detectada pelo detector) NUNCA recebe categoria —
// caller deve filtrar antes de chamar esta função (comportamento antigo
// preservado).

import type { RuleIndex } from '@/lib/ai-categorizer/predict'
import type { SetorPatternSnapshot } from '@/lib/categorization/match-setor-pattern'
import { classifyTransactionsShared } from '@/lib/ai-categorizer/classify-shared'

export type SuggestionSource = 'RULE' | 'SETOR' | 'KEYWORD' | 'DEFAULT'

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
  /**
   * ALTA = confirm vai marcar RECONCILED sem revisão manual;
   * REVISAR = confirm vai marcar PENDING (user precisa categorizar).
   *
   * Mapeamento a partir do resultado do `classifyTransactionsShared`:
   *   status='RECONCILED' → ALTA
   *   status='PENDING'   → REVISAR (mesmo com sugestão KEYWORD — UI mostra
   *                       na aba Revisar com badge do fornecedor sugerido)
   */
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
 * Sugere categoria pra cada tx delegando pra `classifyTransactionsShared`
 * (fonte única de verdade). Retorno mantém o shape `PreviewSuggestion[]`
 * que as UIs V2 (EditablePreviewTable) e V3 (PreviewV3Premium) esperam —
 * ZERO mudança no cliente.
 *
 * Função síncrona pura. Não acessa DB. Não muta ctx.
 */
export function predictSuggestionsForPreview(
  txs: PreviewTx[],
  ctx: PreviewSuggestionContext,
): PreviewSuggestion[] {
  // 1. Constrói setorResolver a partir de setorCategoryByName (mesma
  //    mecânica que route.ts usa no confirm).
  const setorResolver = (categoryName: string): string | null => {
    const cat = ctx.setorCategoryByName.get(categoryName)
    return cat?.id ?? null
  }

  // 2. Roda a função pura compartilhada — MESMA que o confirm executa.
  const sharedMap = classifyTransactionsShared(
    txs.map((t) => ({
      dedupHash: t.dedupHash,
      description: t.description,
      type: t.type,
      amount: t.amount,
    })),
    {
      ruleIndex: ctx.ruleIndex,
      setorPatterns: ctx.setorPatterns,
      setorResolver,
    },
  )

  // 3. Converte pro shape que a UI espera (PreviewSuggestion[]).
  //    ALTA quando o confirm vai criar RECONCILED; REVISAR quando PENDING.
  const result: PreviewSuggestion[] = []
  for (const tx of txs) {
    const shared = sharedMap.get(tx.dedupHash)

    if (!shared) {
      result.push({
        dedupHash: tx.dedupHash,
        categoryId: null,
        dreGroup: null,
        categoryName: null,
        confidence: 'REVISAR',
        source: 'DEFAULT',
      })
      continue
    }

    if (shared.source === 'RULE' && shared.categoryId) {
      const catMeta = ctx.categoryById.get(shared.categoryId)
      result.push({
        dedupHash: tx.dedupHash,
        categoryId: shared.categoryId,
        dreGroup: catMeta?.dreGroup ?? null,
        categoryName: catMeta?.name ?? null,
        confidence: 'ALTA',
        source: 'RULE',
        matchedRuleId: shared.ruleId ?? undefined,
      })
      continue
    }

    if (shared.source === 'SETOR_PATTERN' && shared.categoryId) {
      const catMeta = ctx.categoryById.get(shared.categoryId)
      result.push({
        dedupHash: tx.dedupHash,
        categoryId: shared.categoryId,
        dreGroup: catMeta?.dreGroup ?? null,
        categoryName: catMeta?.name ?? null,
        confidence: 'ALTA',
        source: 'SETOR',
      })
      continue
    }

    if (shared.source === 'KEYWORD' && shared.supplierSuggestion) {
      // KEYWORD marca PENDING (nem preview nem confirm categoriza automático)
      // mas UI pode mostrar hint do fornecedor. Contrato preservado: REVISAR.
      result.push({
        dedupHash: tx.dedupHash,
        categoryId: null,
        dreGroup: shared.supplierSuggestion.dreGroup ?? null,
        categoryName: shared.supplierSuggestion.categoryNameHint,
        confidence: 'REVISAR',
        source: 'KEYWORD',
      })
      continue
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
