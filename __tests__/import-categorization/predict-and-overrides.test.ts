// Sprint Import Categoria Editável (18/06/2026) — testes da engine de
// sugestão + apply overrides + persist rules.

import { describe, it, expect, vi } from 'vitest'
import {
  predictSuggestionsForPreview,
  type PreviewSuggestionContext,
} from '../../lib/import-categorization/predict-for-preview'
import { applyCategoryOverrides, persistNewRules } from '../../lib/import-categorization/apply-overrides'

const ctxBase = (): PreviewSuggestionContext => ({
  ruleIndex: {
    exactByPattern: new Map(),
    normalizedByPattern: new Map(),
    containsRules: [],
  } as any,
  setorPatterns: [],
  setorCategoryByName: new Map(),
  categoryById: new Map([
    ['cat-energia', { name: 'Energia', dreGroup: 'DESPESAS_ADMINISTRATIVAS' }],
    ['cat-vendas', { name: 'Receita de Vendas', dreGroup: 'RECEITA_BRUTA' }],
  ]),
})

describe('predictSuggestionsForPreview — pipeline', () => {
  it('rule EXACT match -> ALTA + source=RULE', () => {
    const ctx = ctxBase()
    const ruleSnapshot: any = {
      id: 'r1',
      tipoMatch: 'EXACT',
      padrao: 'PAGAMENTO ENERGIA',
      categoryId: 'cat-energia',
      supplierId: null,
      confianca: 1.0,
      vezesAplicada: 5,
      companyId: 'c1',
      isActive: true,
      fonte: 'MANUAL',
    }
    ctx.ruleIndex.exactByPattern.set('pagamento energia', ruleSnapshot)

    const r = predictSuggestionsForPreview(
      [{ dedupHash: 'h1', description: 'PAGAMENTO ENERGIA', amount: 1500, type: 'DEBIT' }],
      ctx,
    )
    expect(r).toHaveLength(1)
    expect(r[0].confidence).toBe('ALTA')
    expect(r[0].source).toBe('RULE')
    expect(r[0].categoryId).toBe('cat-energia')
    expect(r[0].categoryName).toBe('Energia')
    expect(r[0].matchedRuleId).toBe('r1')
  })

  it('SetorPattern com confiança ≥0.90 -> ALTA + source=SETOR', () => {
    const ctx = ctxBase()
    ctx.setorPatterns = [
      {
        id: 'sp1',
        setor: 'RESTAURANTE',
        matchType: 'CONTAINS',
        pattern: 'STONE',
        categoryName: 'Receita de Vendas',
        type: 'INCOME',
        confidence: 0.95,
      } as any,
    ]
    ctx.setorCategoryByName.set('Receita de Vendas', {
      id: 'cat-vendas',
      dreGroup: 'RECEITA_BRUTA',
    })

    const r = predictSuggestionsForPreview(
      [{ dedupHash: 'h2', description: 'ANTECIP STONE', amount: 100, type: 'CREDIT' }],
      ctx,
    )
    expect(r[0].confidence).toBe('ALTA')
    expect(r[0].source).toBe('SETOR')
    expect(r[0].categoryId).toBe('cat-vendas')
  })

  it('SetorPattern com confiança <0.90 -> REVISAR + source=SETOR', () => {
    const ctx = ctxBase()
    ctx.setorPatterns = [
      {
        id: 'sp2',
        setor: 'RESTAURANTE',
        matchType: 'CONTAINS',
        pattern: 'STONE',
        categoryName: 'Receita de Vendas',
        type: 'INCOME',
        confidence: 0.7,
      } as any,
    ]
    ctx.setorCategoryByName.set('Receita de Vendas', {
      id: 'cat-vendas',
      dreGroup: 'RECEITA_BRUTA',
    })

    const r = predictSuggestionsForPreview(
      [{ dedupHash: 'h3', description: 'STONE PIX', amount: 100, type: 'CREDIT' }],
      ctx,
    )
    expect(r[0].confidence).toBe('REVISAR')
    expect(r[0].source).toBe('SETOR')
  })

  it('sem match -> DEFAULT + REVISAR + categoryId=null', () => {
    const ctx = ctxBase()
    const r = predictSuggestionsForPreview(
      [{ dedupHash: 'h4', description: 'COMPRA DESCONHECIDA XYZ', amount: 50, type: 'DEBIT' }],
      ctx,
    )
    expect(r[0].confidence).toBe('REVISAR')
    expect(r[0].source).toBe('DEFAULT')
    expect(r[0].categoryId).toBeNull()
  })

  it('rule vence SetorPattern (camada 1 prioritária)', () => {
    const ctx = ctxBase()
    ctx.ruleIndex.exactByPattern.set('stone pagamentos ltda', {
      id: 'r-stone',
      tipoMatch: 'EXACT',
      padrao: 'STONE PAGAMENTOS LTDA',
      categoryId: 'cat-energia', // categoria errada, mas rule manual prevalece
      supplierId: null,
      confianca: 1.0,
      vezesAplicada: 1,
    } as any)
    ctx.setorPatterns = [{
      id: 'sp', setor: 'RESTAURANTE', matchType: 'CONTAINS', pattern: 'STONE',
      categoryName: 'Receita de Vendas', type: 'INCOME', confidence: 0.95,
    } as any]
    ctx.setorCategoryByName.set('Receita de Vendas', { id: 'cat-vendas', dreGroup: 'RECEITA_BRUTA' })
    const r = predictSuggestionsForPreview(
      [{ dedupHash: 'h5', description: 'STONE PAGAMENTOS LTDA', amount: 100, type: 'CREDIT' }],
      ctx,
    )
    expect(r[0].source).toBe('RULE')
    expect(r[0].categoryId).toBe('cat-energia')
  })
})

describe('applyCategoryOverrides', () => {
  const classified: any[] = [
    { dedupHash: 'h1', categoryId: 'cat-A', status: 'RECONCILED', aiConfidence: 0.95, classificationSource: 'RULE', classifiedByRuleId: 'r1' },
    { dedupHash: 'h2', categoryId: null, status: 'PENDING', aiConfidence: null, classificationSource: null, classifiedByRuleId: null },
    { dedupHash: 'h3', categoryId: 'cat-X', status: 'RECONCILED', aiConfidence: 0.85, classificationSource: 'SETOR', classifiedByRuleId: null },
  ]

  it('override sobrescreve categoryId + source=MANUAL + confiança=1.0', () => {
    const r = applyCategoryOverrides(classified, [
      { dedupHash: 'h1', categoryId: 'cat-Z' },
    ])
    expect(r[0].categoryId).toBe('cat-Z')
    expect(r[0].classificationSource).toBe('MANUAL')
    expect(r[0].aiConfidence).toBe(1.0)
    expect(r[0].classifiedByRuleId).toBeNull()
    expect(r[0].status).toBe('RECONCILED')
    // Outras tx intactas
    expect(r[1].categoryId).toBeNull()
    expect(r[2].categoryId).toBe('cat-X')
  })

  it('override pra null mantém PENDING (sem categoria)', () => {
    const r = applyCategoryOverrides(classified, [
      { dedupHash: 'h3', categoryId: null },
    ])
    expect(r[2].categoryId).toBeNull()
    expect(r[2].status).toBe('PENDING')
    expect(r[2].classificationSource).toBe('MANUAL')
  })

  it('tx sem dedupHash ignorada', () => {
    const r = applyCategoryOverrides(
      [{ dedupHash: null, categoryId: 'X', status: 'RECONCILED', aiConfidence: 1, classificationSource: 'X', classifiedByRuleId: null }],
      [{ dedupHash: 'h1', categoryId: 'cat-Z' }],
    )
    expect(r[0].categoryId).toBe('X')
  })
})

describe('persistNewRules — UPSERT + validação', () => {
  it('cria regra nova quando não existe', async () => {
    const prisma: any = {
      category: { findMany: vi.fn(async () => [{ id: 'cat-1' }]) },
      aiLearningRule: {
        findFirst: vi.fn(async () => null),
        update: vi.fn(),
        create: vi.fn(async () => ({ id: 'rule-new' })),
      },
    }
    const r = await persistNewRules(prisma, 'company-1', [
      { tipoMatch: 'CONTAINS', padrao: 'STONE', categoryId: 'cat-1' },
    ])
    expect(r.created).toBe(1)
    expect(r.updated).toBe(0)
    expect(prisma.aiLearningRule.create).toHaveBeenCalled()
  })

  it('upsert quando regra mesma chave existe', async () => {
    const prisma: any = {
      category: { findMany: vi.fn(async () => [{ id: 'cat-1' }]) },
      aiLearningRule: {
        findFirst: vi.fn(async () => ({ id: 'rule-existing' })),
        update: vi.fn(),
        create: vi.fn(),
      },
    }
    const r = await persistNewRules(prisma, 'company-1', [
      { tipoMatch: 'CONTAINS', padrao: 'STONE', categoryId: 'cat-1' },
    ])
    expect(r.created).toBe(0)
    expect(r.updated).toBe(1)
    expect(prisma.aiLearningRule.update).toHaveBeenCalled()
  })

  it('skip quando categoria não pertence à empresa', async () => {
    const prisma: any = {
      category: { findMany: vi.fn(async () => []) }, // categoria não retornada = inválida
      aiLearningRule: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    }
    const r = await persistNewRules(prisma, 'company-1', [
      { tipoMatch: 'CONTAINS', padrao: 'STONE', categoryId: 'cat-alheia' },
    ])
    expect(r.skipped).toBe(1)
    expect(prisma.aiLearningRule.create).not.toHaveBeenCalled()
  })

  it('skip quando padrão vazio', async () => {
    const prisma: any = {
      category: { findMany: vi.fn(async () => [{ id: 'cat-1' }]) },
      aiLearningRule: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    }
    const r = await persistNewRules(prisma, 'company-1', [
      { tipoMatch: 'CONTAINS', padrao: '   ', categoryId: 'cat-1' },
    ])
    expect(r.skipped).toBe(1)
  })
})
