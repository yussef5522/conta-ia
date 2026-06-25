// Sprint Cartao Credito PJ (24/06/2026) — sugere categoria por linha da fatura.
//
// Reusa pipeline existente (lib/ai-categorizer/predict.ts) — mesmas regras
// AiLearningRule que o import OFX usa. Tudo SUGESTAO; user confirma na tela.

import { prisma } from '@/lib/db'
import { loadActiveRules, buildRuleIndex } from '@/lib/ai-categorizer/apply'
import { predictCategory } from '@/lib/ai-categorizer/predict'
import { fuzzyMatchCategory } from './fuzzy-category-match'
import type { InvoiceLine } from './types'

export interface CategorySuggestion {
  /** Categoria sugerida (id) — null se a IA nao tem certeza */
  categoryId: string | null
  /**
   * Origem da sugestao:
   *   RULE     — AiLearningRule existente bateu (predictCategory)
   *   AI_NAME  — Claude sugeriu suggestedCategoryName + fuzzy match achou
   *   DEFAULT  — ENCARGO -> categoria financeira padrao
   *   NONE     — nada bateu (UI mostra dropdown vazio "escolher categoria")
   */
  source: 'RULE' | 'AI_NAME' | 'DEFAULT' | 'NONE'
  /** Confianca 0-1 */
  confidence: number
  /** Nome da categoria sugerida (quando AI_NAME, pro log/debug) */
  matchedFromSuggestion?: string | null
}

export interface SuggestForLinesOptions {
  companyId: string
}

export interface SuggestForLinesResult {
  perIndex: Map<number, CategorySuggestion>
  /** Categoria default sugerida pra encargos financeiros, se encontrada */
  defaultFinancialExpenseCategoryId: string | null
}

/**
 * Pra cada linha sugere categoria. NAO MODIFICA nada — pura predicao.
 *
 * - COMPRA_AVISTA / COMPRA_PARCELADA: usa predictCategory contra AiLearningRule
 * - ENCARGO_FINANCEIRO: tenta achar categoria "Despesa Financeira" / "Juros e Multas"
 * - IGNORAR: nao sugere
 */
export async function suggestCategoriesForInvoiceLines(
  lines: InvoiceLine[],
  opts: SuggestForLinesOptions,
): Promise<SuggestForLinesResult> {
  const perIndex = new Map<number, CategorySuggestion>()

  // Categoria default pra encargos (busca por nome)
  const financialCat = await prisma.category.findFirst({
    where: {
      companyId: opts.companyId,
      isActive: true,
      OR: [
        { name: { contains: 'Juros' } },
        { name: { contains: 'Despesa Financeira' } },
        { name: { contains: 'Encargo' } },
        { dreGroup: 'DESPESAS_FINANCEIRAS' },
      ],
    },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  const defaultFin = financialCat?.id ?? null

  // Carrega TODAS categorias EXPENSE da empresa pra fuzzy match
  const expenseCategories = await prisma.category.findMany({
    where: { companyId: opts.companyId, isActive: true, type: 'EXPENSE' },
    select: { id: true, name: true, type: true },
  })

  // Carrega indice de regras 1x
  const activeRules = await loadActiveRules(opts.companyId)
  const ruleIndex = buildRuleIndex(opts.companyId, activeRules)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.suggestedKind === 'IGNORAR') {
      perIndex.set(i, { categoryId: null, source: 'NONE', confidence: 0 })
      continue
    }

    if (line.suggestedKind === 'ENCARGO_FINANCEIRO') {
      perIndex.set(i, {
        categoryId: defaultFin,
        source: defaultFin ? 'DEFAULT' : 'NONE',
        confidence: defaultFin ? 0.85 : 0,
      })
      continue
    }

    // COMPRA: CAMADA 1 — tenta regra do user (mais alta confianca)
    const pred = predictCategory({ description: line.description }, ruleIndex)
    if (pred && pred.categoryId && pred.confidence >= 0.6) {
      perIndex.set(i, {
        categoryId: pred.categoryId,
        source: 'RULE',
        confidence: pred.confidence,
      })
      continue
    }

    // CAMADA 2 — IA sugeriu nome de categoria + fuzzy match com cats da empresa
    if (line.suggestedCategoryName) {
      const match = fuzzyMatchCategory(line.suggestedCategoryName, expenseCategories)
      if (match) {
        perIndex.set(i, {
          categoryId: match.categoryId,
          source: 'AI_NAME',
          confidence: match.confidence,
          matchedFromSuggestion: line.suggestedCategoryName,
        })
        continue
      }
    }

    // CAMADA 3 — fallback regra de baixa confianca (RULE com <0.6)
    if (pred && pred.categoryId) {
      perIndex.set(i, {
        categoryId: pred.categoryId,
        source: 'RULE',
        confidence: pred.confidence,
      })
      continue
    }

    perIndex.set(i, { categoryId: null, source: 'NONE', confidence: 0 })
  }

  return { perIndex, defaultFinancialExpenseCategoryId: defaultFin }
}
