// Learn — Fase 3 Etapa 1.

import { describe, it, expect } from 'vitest'
import {
  buildNewRule,
  updateRuleOnConfirm,
  updateRuleOnOverride,
  incrementApplied,
  INITIAL_CONFIDENCE_MANUAL,
  AUTO_DEACTIVATE_BELOW,
} from '@/lib/ai-categorizer/learn'
import type { RuleSnapshot } from '@/lib/ai-categorizer/types'

function makeRule(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    id: 'rule-1',
    companyId: 'comp-1',
    tipoMatch: 'NORMALIZED',
    padrao: 'pix | maquininha',
    categoryId: 'cat-vendas',
    supplierId: null,
    confianca: 0.9,
    vezesAplicada: 5,
    isActive: true,
    fonte: 'MANUAL',
    ...overrides,
  }
}

describe('buildNewRule', () => {
  it('descrição COM " - " → tipoMatch=NORMALIZED, padrao sem prefixo', () => {
    const r = buildNewRule(
      'comp-1',
      'FABIO UECKER - Pix | Maquininha',
      'cat-vendas',
    )
    expect(r.tipoMatch).toBe('NORMALIZED')
    expect(r.padrao).toBe('pix | maquininha')
    expect(r.companyId).toBe('comp-1')
    expect(r.categoryId).toBe('cat-vendas')
    expect(r.confianca).toBe(INITIAL_CONFIDENCE_MANUAL)
    expect(r.fonte).toBe('MANUAL')
  })

  it('descrição SEM " - " → tipoMatch=EXACT, padrao literal normalizado', () => {
    const r = buildNewRule('comp-1', 'PAGAMENTO TITULO', 'cat-fornec')
    expect(r.tipoMatch).toBe('EXACT')
    expect(r.padrao).toBe('pagamento titulo')
  })

  it('caso real Cacula Mix: nome próprio diverso vira mesmo padrão NORMALIZED', () => {
    const a = buildNewRule(
      'comp-1',
      'FABIO UECKER - Pix | Maquininha',
      'cat-vendas',
    )
    const b = buildNewRule(
      'comp-1',
      'Marcyelle da Silva dos Santos - Pix | Maquininha',
      'cat-vendas',
    )
    expect(a.padrao).toBe(b.padrao)
    expect(a.tipoMatch).toBe(b.tipoMatch)
  })
})

describe('updateRuleOnConfirm — user confirma sem mudar', () => {
  it('bump leve em confianca (+0.02) e increment vezesAplicada', () => {
    const r = makeRule({ confianca: 0.9, vezesAplicada: 10 })
    const u = updateRuleOnConfirm(r)
    expect(u.confianca).toBeCloseTo(0.92, 4)
    expect(u.vezesAplicada).toBe(11)
    expect(u.isActive).toBe(true)
  })

  it('capa em 1.0 (não passa)', () => {
    const r = makeRule({ confianca: 0.995 })
    const u = updateRuleOnConfirm(r)
    expect(u.confianca).toBe(1.0)
  })
})

describe('updateRuleOnOverride — user mudou categoria aplicada por regra', () => {
  it('drop em confianca (-0.1)', () => {
    const r = makeRule({ confianca: 0.9 })
    const u = updateRuleOnOverride(r)
    expect(u.confianca).toBeCloseTo(0.8, 4)
    expect(u.isActive).toBe(true)
  })

  it('desativa automaticamente quando cai abaixo do threshold', () => {
    const r = makeRule({ confianca: AUTO_DEACTIVATE_BELOW + 0.05 }) // 0.55
    const u = updateRuleOnOverride(r) // 0.45 → desativa
    expect(u.confianca).toBeCloseTo(0.45, 4)
    expect(u.isActive).toBe(false)
  })

  it('não vai negativo (min 0)', () => {
    const r = makeRule({ confianca: 0.05 })
    const u = updateRuleOnOverride(r)
    expect(u.confianca).toBe(0)
    expect(u.isActive).toBe(false)
  })
})

describe('incrementApplied — bulk apply ou auto-import', () => {
  it('só incrementa vezesAplicada (não mexe em confianca)', () => {
    const r = makeRule({ vezesAplicada: 100, confianca: 0.85 })
    const u = incrementApplied(r, 277)
    expect(u.vezesAplicada).toBe(377)
    expect(u.confianca).toBe(0.85)
    expect(u.isActive).toBe(true)
  })
})
