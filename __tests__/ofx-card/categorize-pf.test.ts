// Sprint PF Fatia 3 — categorizePf pipeline puro.

import { describe, expect, test } from 'vitest'
import {
  categorizePf,
  type PfRuleSnapshot,
} from '@/lib/ai-categorizer/categorize-pf'

function makeCats(): Map<string, { id: string; type: 'INCOME' | 'EXPENSE' }> {
  return new Map([
    ['Alimentação', { id: 'cat-aliment', type: 'EXPENSE' }],
    ['Transporte', { id: 'cat-transp', type: 'EXPENSE' }],
    ['Lazer', { id: 'cat-lazer', type: 'EXPENSE' }],
    ['Saúde', { id: 'cat-saude', type: 'EXPENSE' }],
    ['Cartão de crédito', { id: 'cat-cartao', type: 'EXPENSE' }],
    ['Educação', { id: 'cat-edu', type: 'EXPENSE' }],
    ['Outros', { id: 'cat-outros', type: 'EXPENSE' }],
    ['Salário', { id: 'cat-salario', type: 'INCOME' }],
  ])
}

describe('categorizePf — SPECIAL_TX prevalece', () => {
  test('"Pagamento recebido" CREDIT → SPECIAL_TX + shouldSkip', () => {
    const r = categorizePf({
      description: 'Pagamento recebido',
      amount: 2800,
      type: 'CREDIT',
      rules: [],
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('SPECIAL_TX')
    expect(r.specialKind).toBe('INVOICE_PAYMENT')
    expect(r.shouldSkipImport).toBe(true)
  })

  test('"Multa por fatura atrasada" → Cartão de crédito', () => {
    const r = categorizePf({
      description: 'Multa por fatura atrasada',
      amount: 15,
      type: 'DEBIT',
      rules: [],
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('SPECIAL_TX')
    expect(r.categoryId).toBe('cat-cartao')
  })

  test('"IOF de compra internacional" → isInternational=true', () => {
    const r = categorizePf({
      description: 'IOF de compra internacional',
      amount: 4.2,
      type: 'DEBIT',
      rules: [],
      categoriesByName: makeCats(),
    })
    expect(r.isInternational).toBe(true)
  })
})

describe('categorizePf — RULE > KEYWORD', () => {
  test('regra EXACT bate antes do keyword', () => {
    const rules: PfRuleSnapshot[] = [
      {
        id: 'rule-1',
        tipoMatch: 'EXACT',
        padrao: 'Netflix',
        personalCategoryId: 'cat-outros',
        confianca: 0.95,
      },
    ]
    const r = categorizePf({
      description: 'Netflix',
      amount: 55.9,
      type: 'DEBIT',
      rules,
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('RULE')
    expect(r.categoryId).toBe('cat-outros') // overrides keyword "Lazer"
    expect(r.ruleIdApplied).toBe('rule-1')
  })

  test('regra CONTAINS bate', () => {
    const rules: PfRuleSnapshot[] = [
      {
        id: 'rule-2',
        tipoMatch: 'CONTAINS',
        padrao: 'posto',
        personalCategoryId: 'cat-transp',
        confianca: 0.9,
      },
    ]
    const r = categorizePf({
      description: 'Posto Pitangueira',
      amount: 85.5,
      type: 'DEBIT',
      rules,
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('RULE')
    expect(r.categoryId).toBe('cat-transp')
  })
})

describe('categorizePf — KEYWORD', () => {
  test('"iFood Restaurante" → KEYWORD Alimentação', () => {
    const r = categorizePf({
      description: 'iFood Restaurante',
      amount: 50,
      type: 'DEBIT',
      rules: [],
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('KEYWORD')
    expect(r.categoryId).toBe('cat-aliment')
    expect(r.confidence).toBe(0.85)
  })

  test('"Claude.Ai" → KEYWORD Educação', () => {
    const r = categorizePf({
      description: 'Claude.Ai Subscription',
      amount: 100,
      type: 'DEBIT',
      rules: [],
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('KEYWORD')
    expect(r.categoryId).toBe('cat-edu')
  })

  test('parcela: descrição usa baseDescription pra match', () => {
    const r = categorizePf({
      description: 'Airbnb * Hm9z23za5s - Parcela 5/6',
      amount: 380,
      type: 'DEBIT',
      rules: [],
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('KEYWORD')
    expect(r.categoryId).toBe('cat-lazer') // Airbnb
    expect(r.isInstallment).toBe(true)
    expect(r.installmentNumber).toBe(5)
    expect(r.installmentTotal).toBe(6)
  })
})

describe('categorizePf — NONE (fallback Claude)', () => {
  test('descrição obscura → NONE (esperando Claude)', () => {
    const r = categorizePf({
      description: 'Loja XPTO123 Inexistente Inc',
      amount: 50,
      type: 'DEBIT',
      rules: [],
      categoriesByName: makeCats(),
    })
    expect(r.layer).toBe('NONE')
    expect(r.categoryId).toBe(null)
  })
})
