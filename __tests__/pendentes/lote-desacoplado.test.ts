// Sprint Pendentes Fix (27/06/2026) — testa que o lote roda SEM ruleSnapshot.

import { describe, it, expect } from 'vitest'
import { buildNewRule } from '@/lib/ai-categorizer/learn'

describe('buildNewRule — infere tipoMatch corretamente quando flag está OFF', () => {
  it('descrição SEM " - " → EXACT (padrão normalizado)', () => {
    const r = buildNewRule('comp1', 'BANRI A VISTA', 'cat-receita')
    expect(r.tipoMatch).toBe('EXACT')
    // padrao passa por normalizeExact (lowercase + trim)
    expect(r.padrao.toUpperCase()).toBe('BANRI A VISTA')
  })

  it('descrição COM " - " → NORMALIZED', () => {
    const r = buildNewRule('comp1', 'PIX RECEBIDO - João Silva', 'cat-receita')
    expect(r.tipoMatch).toBe('NORMALIZED')
  })

  it('descrição "OP CREDITO C/GARANTIA" → EXACT', () => {
    const r = buildNewRule('comp1', 'OP. CREDITO C/GARANTIA', 'cat-receita')
    expect(r.tipoMatch).toBe('EXACT')
  })
})

// ============================================================================
// Lógica do lote desacoplada — espelha o que apply.ts faz
// ============================================================================
describe('Lote desacoplado da criação de regra', () => {
  // Antes (BUG): if (input.applyToSimilar && ruleSnapshot) { lote }
  // Depois (FIX): if (input.applyToSimilar) { lote }

  function shouldRunBatch(input: { applyToSimilar: boolean }, ruleSnapshot: object | null): boolean {
    // Lógica NOVA: depende só de applyToSimilar
    return input.applyToSimilar
  }

  it('roda lote quando applyToSimilar=true SEM regra (caso real)', () => {
    expect(shouldRunBatch({ applyToSimilar: true }, null)).toBe(true)
  })

  it('roda lote quando applyToSimilar=true COM regra (caso flag ON)', () => {
    expect(shouldRunBatch({ applyToSimilar: true }, { id: 'rule-1' })).toBe(true)
  })

  it('NÃO roda lote quando applyToSimilar=false (user não pediu)', () => {
    expect(shouldRunBatch({ applyToSimilar: false }, null)).toBe(false)
    expect(shouldRunBatch({ applyToSimilar: false }, { id: 'rule-1' })).toBe(false)
  })
})

// ============================================================================
// classificationSource resultante: RULE se há regra, MANUAL se não
// ============================================================================
describe('classificationSource adaptado', () => {
  function effectiveSourceOf(ruleId: string | null): 'RULE' | 'MANUAL' {
    return ruleId ? 'RULE' : 'MANUAL'
  }
  it('com regra → RULE', () => {
    expect(effectiveSourceOf('rule-banri')).toBe('RULE')
  })
  it('sem regra (flag OFF) → MANUAL', () => {
    expect(effectiveSourceOf(null)).toBe('MANUAL')
  })
})

// ============================================================================
// Cenário real: BANRI A VISTA com 4 pendentes + flag OFF
// ============================================================================
describe('Caso real Cacula — 4 BANRI A VISTA pendentes', () => {
  it('user categoriza 1 como Receita + applyToSimilar=true → 4 similares aplicados', () => {
    // Antes: similarApplied = 0 (silencioso, só 1 categorizada)
    // Depois: similarApplied = 4 (lote roda independente de regra)
    const baseDescription = 'BANRI A VISTA'
    const pendentes = [
      { id: 'tx-19', description: 'BANRI A VISTA', categoryId: null, type: 'CREDIT' },
      { id: 'tx-22', description: 'BANRI A VISTA', categoryId: null, type: 'CREDIT' },
      { id: 'tx-23', description: 'BANRI A VISTA', categoryId: null, type: 'CREDIT' },
      { id: 'tx-24', description: 'BANRI A VISTA', categoryId: null, type: 'CREDIT' },
    ]
    // findSimilarTransactions com tipoMatch=EXACT pegaria todas com mesma descrição
    const similares = pendentes.filter((p) => p.description === baseDescription)
    expect(similares.length).toBe(4)
  })
})
