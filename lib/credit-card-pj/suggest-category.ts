// Sprint Cartao Credito PJ (24/06/2026) — sugere categoria por linha da fatura.
//
// Reusa pipeline existente (lib/ai-categorizer/predict.ts) — mesmas regras
// AiLearningRule que o import OFX usa. Tudo SUGESTAO; user confirma na tela.

import { prisma } from '@/lib/db'
import { loadActiveRules, buildRuleIndex } from '@/lib/ai-categorizer/apply'
import { predictCategory } from '@/lib/ai-categorizer/predict'
import type { InvoiceLine } from './types'

export interface CategorySuggestion {
  /** Categoria sugerida (id) — null se a IA nao tem certeza */
  categoryId: string | null
  /** Origem da sugestao: RULE | KEYWORD | DEFAULT | NONE */
  source: 'RULE' | 'KEYWORD' | 'DEFAULT' | 'NONE'
  /** Confianca 0-1 */
  confidence: number
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

    // COMPRA: tenta regra do user
    const pred = predictCategory({ description: line.description }, ruleIndex)
    if (pred && pred.categoryId) {
      perIndex.set(i, {
        categoryId: pred.categoryId,
        source:
          pred.tipoMatch === 'EXACT' || pred.tipoMatch === 'NORMALIZED' ? 'RULE' : 'KEYWORD',
        confidence: pred.confidence,
      })
    } else {
      perIndex.set(i, { categoryId: null, source: 'NONE', confidence: 0 })
    }
  }

  return { perIndex, defaultFinancialExpenseCategoryId: defaultFin }
}
