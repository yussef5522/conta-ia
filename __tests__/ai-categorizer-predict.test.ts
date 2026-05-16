// Predict — Fase 3 Etapa 1.

import { describe, it, expect } from 'vitest'
import {
  buildRuleIndex,
  predictCategory,
  predictBatch,
} from '@/lib/ai-categorizer/predict'
import type { RuleSnapshot, TxSnapshot } from '@/lib/ai-categorizer/types'
import { tierFor } from '@/lib/ai-categorizer/types'

function rule(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    id: 'rule-x',
    companyId: 'comp-1',
    tipoMatch: 'NORMALIZED',
    padrao: 'pix | maquininha',
    categoryId: 'cat-vendas',
    supplierId: null,
    confianca: 1.0,
    vezesAplicada: 0,
    isActive: true,
    fonte: 'MANUAL',
    ...overrides,
  }
}

function tx(description: string): { description: string } {
  return { description }
}

describe('buildRuleIndex — multi-tenant + filtros', () => {
  it('ISOLA companyId (defesa em profundidade)', () => {
    const rules = [
      rule({ id: 'r1', companyId: 'comp-1', padrao: 'pix | maquininha' }),
      rule({ id: 'r2', companyId: 'comp-OUTRO', padrao: 'pix | maquininha' }),
    ]
    const idx = buildRuleIndex('comp-1', rules)
    expect(idx.normalizedByPattern.size).toBe(1)
    expect(idx.normalizedByPattern.get('pix | maquininha')?.id).toBe('r1')
  })

  it('IGNORA regras inativas', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r1', isActive: false, padrao: 'pix | maquininha' }),
    ])
    expect(idx.normalizedByPattern.size).toBe(0)
  })

  it('IGNORA regras sem categoryId (futura supplier-only)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ categoryId: null }),
    ])
    expect(idx.normalizedByPattern.size).toBe(0)
  })

  it('LANÇA se companyId vazio (proteção)', () => {
    expect(() => buildRuleIndex('', [])).toThrow(/multi-tenant/i)
  })

  it('separa indexes EXACT e NORMALIZED', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r-e', tipoMatch: 'EXACT', padrao: 'pagamento titulo' }),
      rule({ id: 'r-n', tipoMatch: 'NORMALIZED', padrao: 'pix | maquininha' }),
    ])
    expect(idx.exactByPattern.size).toBe(1)
    expect(idx.normalizedByPattern.size).toBe(1)
  })
})

describe('predictCategory — match', () => {
  it('match EXACT prioritário e mantém confidence original (1.0)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({
        id: 'exact',
        tipoMatch: 'EXACT',
        padrao: 'pagamento titulo',
        confianca: 1.0,
      }),
    ])
    const p = predictCategory(tx('PAGAMENTO TITULO'), idx)
    expect(p).toBeTruthy()
    expect(p?.tipoMatch).toBe('EXACT')
    expect(p?.confidence).toBe(1.0)
    expect(p?.ruleId).toBe('exact')
    expect(tierFor(p!.confidence)).toBe('AUTO')
  })

  it('match NORMALIZED penalizado em 0.9× (não dispara AUTO no import)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({
        id: 'norm',
        tipoMatch: 'NORMALIZED',
        padrao: 'pix | maquininha',
        confianca: 1.0,
      }),
    ])
    const p = predictCategory(
      tx('Roberto Vargas - Pix | Maquininha'),
      idx,
    )
    expect(p?.tipoMatch).toBe('NORMALIZED')
    expect(p?.confidence).toBeCloseTo(0.9, 4)
    // 0.9 NÃO é AUTO (≥0.95), mas É SUGESTAO (≥0.75)
    expect(tierFor(p!.confidence)).toBe('SUGESTAO')
  })

  it('EXACT > NORMALIZED quando ambos casam', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({
        id: 'norm',
        tipoMatch: 'NORMALIZED',
        padrao: 'pagamento titulo',
        confianca: 1.0,
      }),
      rule({
        id: 'exact',
        tipoMatch: 'EXACT',
        padrao: 'pagamento titulo',
        confianca: 0.99,
      }),
    ])
    const p = predictCategory(tx('PAGAMENTO TITULO'), idx)
    expect(p?.ruleId).toBe('exact')
    expect(p?.tipoMatch).toBe('EXACT')
  })

  it('sem match retorna null', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ padrao: 'pix | maquininha' }),
    ])
    const p = predictCategory(tx('ALUGUEL ABRIL'), idx)
    expect(p).toBeNull()
  })

  it('descrição vazia retorna null', () => {
    const idx = buildRuleIndex('comp-1', [rule()])
    expect(predictCategory(tx(''), idx)).toBeNull()
  })
})

describe('predictBatch — performance + map', () => {
  it('retorna Map<txId, prediction|null>', () => {
    const idx = buildRuleIndex('comp-1', [rule({ padrao: 'pix | maquininha' })])
    const txs: TxSnapshot[] = [
      {
        id: 't1',
        description: 'FABIO UECKER - Pix | Maquininha',
        amount: 50,
        type: 'CREDIT',
        bankAccountId: 'acc-1',
        status: 'PENDING',
        categoryId: null,
      },
      {
        id: 't2',
        description: 'ALUGUEL JANEIRO',
        amount: 1500,
        type: 'DEBIT',
        bankAccountId: 'acc-1',
        status: 'PENDING',
        categoryId: null,
      },
    ]
    const result = predictBatch(txs, idx)
    expect(result.get('t1')).toBeTruthy()
    expect(result.get('t2')).toBeNull()
  })
})

describe('tierFor — thresholds AUTO/SUGESTAO/IGNORAR', () => {
  it('≥ 0.95 → AUTO', () => {
    expect(tierFor(0.95)).toBe('AUTO')
    expect(tierFor(1.0)).toBe('AUTO')
  })
  it('0.75 - 0.949 → SUGESTAO', () => {
    expect(tierFor(0.9)).toBe('SUGESTAO')
    expect(tierFor(0.75)).toBe('SUGESTAO')
  })
  it('< 0.75 → IGNORAR', () => {
    expect(tierFor(0.74)).toBe('IGNORAR')
    expect(tierFor(0)).toBe('IGNORAR')
  })
})
