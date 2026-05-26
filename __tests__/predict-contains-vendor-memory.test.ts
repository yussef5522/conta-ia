// Sprint 5.0.2.m — Predict CONTAINS (Vendor Memory) no pipeline OFX.

import { describe, it, expect } from 'vitest'
import { buildRuleIndex, predictCategory } from '@/lib/ai-categorizer/predict'
import type { RuleSnapshot } from '@/lib/ai-categorizer/types'

function rule(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    id: 'rule-x',
    companyId: 'comp-1',
    tipoMatch: 'CONTAINS',
    padrao: 'TECOPONTO',
    categoryId: 'cat-software',
    supplierId: null,
    confianca: 1.0,
    vezesAplicada: 0,
    isActive: true,
    fonte: 'AUTO_FROM_MANUAL',
    ...overrides,
  }
}

describe('buildRuleIndex — CONTAINS rules indexed (Sprint 5.0.2.m)', () => {
  it('indexa CONTAINS no array containsRules', () => {
    const idx = buildRuleIndex('comp-1', [rule()])
    expect(idx.containsRules.length).toBe(1)
    expect(idx.containsRules[0].padrao).toBe('TECOPONTO')
  })

  it('ordena por vezesAplicada DESC (high-confidence primeiro)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r-low', padrao: 'AMBEV', vezesAplicada: 2 }),
      rule({ id: 'r-high', padrao: 'STONE', vezesAplicada: 50 }),
      rule({ id: 'r-mid', padrao: 'JBS', vezesAplicada: 10 }),
    ])
    expect(idx.containsRules.map((r) => r.padrao)).toEqual(['STONE', 'JBS', 'AMBEV'])
  })

  it('desempata por length(padrao) DESC (mais específico ganha)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r-curto', padrao: 'BRF', vezesAplicada: 5 }),
      rule({ id: 'r-longo', padrao: 'BRF FOODS', vezesAplicada: 5 }),
    ])
    expect(idx.containsRules[0].padrao).toBe('BRF FOODS')
  })

  it('multi-tenant: regra de outra empresa NÃO entra', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ companyId: 'comp-OUTRO' }),
    ])
    expect(idx.containsRules.length).toBe(0)
  })

  it('regra inativa NÃO entra', () => {
    const idx = buildRuleIndex('comp-1', [rule({ isActive: false })])
    expect(idx.containsRules.length).toBe(0)
  })

  it('regra sem categoryId NÃO entra', () => {
    const idx = buildRuleIndex('comp-1', [rule({ categoryId: null })])
    expect(idx.containsRules.length).toBe(0)
  })

  it('mix EXACT + NORMALIZED + CONTAINS → todos indexados separadamente', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r-ex', tipoMatch: 'EXACT', padrao: 'FATURA STONE' }),
      rule({ id: 'r-norm', tipoMatch: 'NORMALIZED', padrao: 'pix | maquininha' }),
      rule({ id: 'r-cont', tipoMatch: 'CONTAINS', padrao: 'TECOPONTO' }),
    ])
    expect(idx.exactByPattern.size).toBe(1)
    expect(idx.normalizedByPattern.size).toBe(1)
    expect(idx.containsRules.length).toBe(1)
  })
})

describe('predictCategory — CONTAINS match (Vendor Memory pipeline)', () => {
  it('descrição com substring → bate CONTAINS', () => {
    const idx = buildRuleIndex('comp-1', [rule()])
    const p = predictCategory({ description: 'PAG TECOPONTO NF 47' }, idx)
    expect(p?.tipoMatch).toBe('CONTAINS')
    expect(p?.categoryId).toBe('cat-software')
    expect(p?.confidence).toBe(1.0)
  })

  it('case-insensitive', () => {
    const idx = buildRuleIndex('comp-1', [rule()])
    const p = predictCategory({ description: 'pag tecoponto solucoes' }, idx)
    expect(p?.tipoMatch).toBe('CONTAINS')
  })

  it('EXACT tem prioridade sobre CONTAINS', () => {
    // Se uma descrição bate em EXACT E CONTAINS, EXACT ganha
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r-exact', tipoMatch: 'EXACT', padrao: 'pag tecoponto', categoryId: 'cat-exact' }),
      rule({ id: 'r-cont', tipoMatch: 'CONTAINS', padrao: 'TECOPONTO', categoryId: 'cat-cont' }),
    ])
    const p = predictCategory({ description: 'pag tecoponto' }, idx)
    expect(p?.tipoMatch).toBe('EXACT')
    expect(p?.categoryId).toBe('cat-exact')
  })

  it('sem match → null', () => {
    const idx = buildRuleIndex('comp-1', [rule()])
    const p = predictCategory({ description: 'TRANSACAO ALEATORIA' }, idx)
    expect(p).toBeNull()
  })

  it('confidence vem da rule.confianca', () => {
    const idx = buildRuleIndex('comp-1', [rule({ confianca: 0.8 })])
    const p = predictCategory({ description: 'PAG TECOPONTO' }, idx)
    expect(p?.confidence).toBe(0.8)
  })

  it('primeiro CONTAINS mais específico ganha (sort)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r-brf', padrao: 'BRF', categoryId: 'cat-generic', vezesAplicada: 10 }),
      rule({
        id: 'r-brf-foods',
        padrao: 'BRF FOODS',
        categoryId: 'cat-specific',
        vezesAplicada: 10,
      }),
    ])
    // Tied vezesAplicada → length desc → BRF FOODS primeiro
    const p = predictCategory({ description: 'PAGAMENTO BRF FOODS S/A' }, idx)
    expect(p?.categoryId).toBe('cat-specific')
  })

  it('AUTO_FROM_MANUAL com confianca=1.0 → AUTO no import (≥0.95)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ fonte: 'AUTO_FROM_MANUAL', confianca: 1.0 }),
    ])
    const p = predictCategory({ description: 'PAG TECOPONTO' }, idx)
    expect(p?.confidence).toBeGreaterThanOrEqual(0.95)
  })
})
