// Auto-classify in-memory engine (sem DB) — Fase 3 Etapa 1.

import { describe, it, expect } from 'vitest'
import {
  autoClassifyTransactions,
  buildRuleIndex,
} from '@/lib/ai-categorizer/apply'
import type { RuleSnapshot } from '@/lib/ai-categorizer/types'

function rule(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    id: 'rule-1',
    companyId: 'comp-1',
    tipoMatch: 'EXACT',
    padrao: 'pagamento titulo',
    categoryId: 'cat-fornec',
    supplierId: null,
    confianca: 1.0,
    vezesAplicada: 0,
    isActive: true,
    fonte: 'MANUAL',
    ...overrides,
  }
}

function tx(description: string) {
  return {
    bankAccountId: 'acc-1',
    date: new Date('2026-05-15T12:00:00Z'),
    description,
    amount: 100,
    type: 'DEBIT',
    externalId: null,
    dedupHash: 'hash-' + Math.random(),
    origin: 'OFX',
  }
}

describe('autoClassifyTransactions — pipeline OFX', () => {
  it('auto-classifica via regra EXACT (confianca=1.0 ≥ 0.95)', () => {
    const idx = buildRuleIndex('comp-1', [rule()])
    const result = autoClassifyTransactions(
      [tx('PAGAMENTO TITULO'), tx('NAO TEM REGRA')],
      idx,
    )
    expect(result.autoCount).toBe(1)
    expect(result.classified[0].status).toBe('RECONCILED')
    expect(result.classified[0].categoryId).toBe('cat-fornec')
    expect(result.classified[0].classificationSource).toBe('RULE')
    expect(result.classified[0].classifiedByRuleId).toBe('rule-1')
    expect(result.classified[0].aiConfidence).toBe(1.0)

    expect(result.classified[1].status).toBe('PENDING')
    expect(result.classified[1].categoryId).toBeUndefined()
  })

  it('NÃO auto-classifica regra NORMALIZED com confianca=1.0 (penalidade derruba pra 0.9)', () => {
    // Garantia: NORMALIZED nunca dispara AUTO no import (vira sugestão pendente)
    const idx = buildRuleIndex('comp-1', [
      rule({
        tipoMatch: 'NORMALIZED',
        padrao: 'pix | maquininha',
        confianca: 1.0,
      }),
    ])
    const result = autoClassifyTransactions(
      [tx('FABIO - Pix | Maquininha')],
      idx,
    )
    expect(result.autoCount).toBe(0)
    expect(result.classified[0].status).toBe('PENDING')
  })

  it('conta vezes que cada regra disparou em rulesFired Map', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ id: 'r-titulo', padrao: 'pagamento titulo' }),
      rule({ id: 'r-iof', padrao: 'iof', categoryId: 'cat-juros' }),
    ])
    const result = autoClassifyTransactions(
      [
        tx('PAGAMENTO TITULO'),
        tx('PAGAMENTO TITULO'),
        tx('PAGAMENTO TITULO'),
        tx('IOF'),
        tx('SEM REGRA'),
      ],
      idx,
    )
    expect(result.autoCount).toBe(4)
    expect(result.rulesFired.get('r-titulo')).toBe(3)
    expect(result.rulesFired.get('r-iof')).toBe(1)
  })

  it('regra inativa NÃO classifica (filtrada em buildRuleIndex)', () => {
    const idx = buildRuleIndex('comp-1', [rule({ isActive: false })])
    const result = autoClassifyTransactions([tx('PAGAMENTO TITULO')], idx)
    expect(result.autoCount).toBe(0)
  })

  it('regra de outra empresa NÃO classifica (defesa multi-tenant)', () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ companyId: 'comp-OUTRO' }),
    ])
    const result = autoClassifyTransactions([tx('PAGAMENTO TITULO')], idx)
    expect(result.autoCount).toBe(0)
  })

  it('lista vazia → resultado vazio sem crash', () => {
    const idx = buildRuleIndex('comp-1', [])
    const result = autoClassifyTransactions([], idx)
    expect(result.autoCount).toBe(0)
    expect(result.classified).toEqual([])
    expect(result.rulesFired.size).toBe(0)
  })
})
