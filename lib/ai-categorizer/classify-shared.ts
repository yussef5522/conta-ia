// Sprint Unificar-Pipelines-Import (01/07/2026).
//
// FONTE ÚNICA DE VERDADE da classificação síncrona de import (OFX/Excel/CSV).
//
// Roda AS MESMAS camadas que `autoClassifyTransactions` (confirm) sempre roda:
//   1. RULE       — AiLearningRule via predictCategory (EXACT > NORMALIZED > CONTAINS)
//                   Threshold auto-apply: confidence >= 0.95
//   2A. KEYWORD   — detectKeyword (Supplier suggestion), marca PENDING
//   2C. SETOR     — matchAgainstPatterns tier AUTO, marca RECONCILED
//   Fallback     — PENDING
//
// NÃO roda 2B (BrasilAPI async) — igual ao caminho confirm síncrono.
// NÃO chama Claude — pipeline síncrono nunca chama IA.
//
// ZERO side-effects: nenhuma chamada Prisma, nenhum log, nenhuma persist.
// 100% determinística: mesmo (txs, ctx) → mesmo resultado, sempre.
//
// Consumidores:
//   • `autoClassifyTransactions` (confirm, apply.ts) — usa isso + agrega
//     `rulesFired`/`supplierSuggestions` pro caller (route.ts) persistir.
//   • `predictSuggestionsForPreview` (preview, predict-for-preview.ts) — usa isso
//     + converte pro shape `PreviewSuggestion[]` que a UI V2/V3 já espera.
//
// Garantia arquitetural: preview e confirm mostram/criam EXATAMENTE o mesmo
// resultado porque rodam a MESMA função pura com o MESMO ctx.

import { classifyForImport } from './pipeline'
import type { RuleIndex } from './predict'
import type { SetorPatternSnapshot } from '@/lib/categorization/match-setor-pattern'

/** Threshold pra RULE auto-apply (RECONCILED). Compartilhado entre preview+confirm. */
export const RULE_AUTO_THRESHOLD = 0.95

/**
 * Input mínimo de uma tx pra classificação síncrona.
 * (Preview passa isso; confirm passa isso + campos extras que não afetam classificação.)
 */
export interface SharedClassifyInputTx {
  dedupHash: string | null
  description: string
  type: string
  amount?: number
  bankAccountId?: string
}

/**
 * Contexto de classificação. Carregado uma vez pelo caller e passado igual
 * pra preview e confirm. `ctx idêntico + tx idêntica → classification idêntica`.
 */
export interface SharedClassifyContext {
  ruleIndex: RuleIndex
  /** SetorPattern snapshot (KB DB-backed). Undefined = camada SETOR skipada. */
  setorPatterns?: SetorPatternSnapshot[]
  /** Resolver categoryName → categoryId pra Camada SETOR. */
  setorResolver?: (categoryName: string) => string | null
}

/**
 * Fonte da classificação — corresponde exatamente ao `classificationSource`
 * persistido em `Transaction`.
 */
export type SharedClassifySource = 'RULE' | 'KEYWORD' | 'SETOR_PATTERN' | null

/**
 * Sugestão de fornecedor detectada pela Camada 2A KEYWORD.
 * Preview mostra na UI (badge amarelo); confirm persiste via
 * `persistSupplierSuggestions` no caller.
 */
export interface SharedSupplierSuggestion {
  dedupHash: string | null
  bankAccountId: string | undefined
  supplierName: string
  categoryNameHint: string
  dreGroup: string
  confidence: number
  fonte: 'KEYWORD'
}

/**
 * Resultado da classificação de UMA tx.
 * O mesmo shape é usado por preview (converte pra PreviewSuggestion) e
 * confirm (converte pra AutoClassifyOutputTx).
 */
export interface SharedClassifyResult {
  /** Status final que a tx teria: RECONCILED (categoria auto ≥0.95) ou PENDING (revisar). */
  status: 'RECONCILED' | 'PENDING'
  /** categoryId sugerido (null quando PENDING sem match). */
  categoryId: string | null
  /** Fonte da sugestão. */
  source: SharedClassifySource
  /** Confidence (0-1). Null quando não houve classificação. */
  aiConfidence: number | null
  /** ID da AiLearningRule que disparou (só quando source=RULE). Pro caller
   *  incrementar `vezesAplicada`. */
  ruleId: string | null
  /** Sugestão de fornecedor (só quando source=KEYWORD). Caller persiste. */
  supplierSuggestion: SharedSupplierSuggestion | null
}

/**
 * Classifica um lote de tx aplicando as camadas síncronas. Retorna Map
 * indexado por `dedupHash` (chave natural do import).
 *
 * Preview e confirm devem chamar esta função com o mesmo `ctx` e converter
 * o resultado pro seu formato. Isso GARANTE que ambos mostrem/criem o
 * mesmo conjunto de tx, com as mesmas categorias.
 *
 * IMPORTANTE: função síncrona pura. Não chama Prisma, não loga, não
 * persiste nada. Caller decide o que fazer com o Map.
 */
export function classifyTransactionsShared(
  txs: SharedClassifyInputTx[],
  ctx: SharedClassifyContext,
): Map<string, SharedClassifyResult> {
  const result = new Map<string, SharedClassifyResult>()

  for (const tx of txs) {
    // dedupHash é a chave. Se null (edge case), pula sem classificar.
    const hash = tx.dedupHash
    if (hash == null) continue

    const pipelineResult = classifyForImport(
      { description: tx.description, type: tx.type },
      ctx.ruleIndex,
      ctx.setorPatterns,
    )

    // CAMADA 1 — RULE com confidence auto (≥0.95): RECONCILED
    if (
      pipelineResult.layer === 'RULE' &&
      pipelineResult.rulePrediction &&
      pipelineResult.rulePrediction.confidence >= RULE_AUTO_THRESHOLD
    ) {
      const pred = pipelineResult.rulePrediction
      result.set(hash, {
        status: 'RECONCILED',
        categoryId: pred.categoryId,
        source: 'RULE',
        aiConfidence: pred.confidence,
        ruleId: pred.ruleId,
        supplierSuggestion: null,
      })
      continue
    }

    // CAMADA 2A — KEYWORD: PENDING + sugestão de fornecedor
    if (pipelineResult.layer === 'KEYWORD' && pipelineResult.keywordMatch) {
      const kw = pipelineResult.keywordMatch
      result.set(hash, {
        status: 'PENDING',
        categoryId: null,
        source: 'KEYWORD',
        aiConfidence: kw.confidence,
        ruleId: null,
        supplierSuggestion: {
          dedupHash: hash,
          bankAccountId: tx.bankAccountId,
          supplierName: kw.displayName,
          categoryNameHint: kw.categoryNameHint,
          dreGroup: kw.dreGroup,
          confidence: kw.confidence,
          fonte: 'KEYWORD',
        },
      })
      continue
    }

    // CAMADA 2C — SETOR tier AUTO: RECONCILED (mesma mecânica de confirm)
    if (
      pipelineResult.layer === 'SETOR' &&
      pipelineResult.setorMatch &&
      ctx.setorResolver
    ) {
      const s = pipelineResult.setorMatch
      const categoryId = ctx.setorResolver(s.pattern.categoryName)
      if (categoryId) {
        result.set(hash, {
          status: 'RECONCILED',
          categoryId,
          source: 'SETOR_PATTERN',
          aiConfidence: s.pattern.confidence,
          ruleId: null,
          supplierSuggestion: null,
        })
        continue
      }
      // Setor sem categoria resolvida cai pra PENDING (idêntico ao confirm).
    }

    // Fallback — sem match nas camadas síncronas
    result.set(hash, {
      status: 'PENDING',
      categoryId: null,
      source: null,
      aiConfidence: null,
      ruleId: null,
      supplierSuggestion: null,
    })
  }

  return result
}
