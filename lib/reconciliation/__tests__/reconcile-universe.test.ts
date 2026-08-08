// A.7 (07/08) — GUARDA contra reintroduzir o bug de dedup filtrando o universo
// de reconcile só por EFFECTED. buildReconcileUniverse DEVE incluir os pending
// (PAYABLE/RECEIVABLE) preservando o lifecycle — é o que permite a linha real
// casar com a preview e ser PROMOVIDA em vez de recriada (duplicata).
// No código pré-fix esta função nem existia → import falha → VERMELHO.

import { describe, it, expect } from 'vitest'
import { buildReconcileUniverse } from '../reconcile-universe'

const D = (s: string) => new Date(`${s}T12:00:00Z`)

const effected = [
  { id: 'e1', date: D('2026-07-10'), type: 'DEBIT', amount: 12.5, externalId: 'F1', description: 'TARIFA' },
]
const pending = [
  { id: 'p1', date: D('2026-07-27'), type: 'DEBIT', amount: 4092.02, lifecycle: 'PAYABLE', externalId: null, description: 'EMPRESTIMO' },
  { id: 'p2', date: D('2026-07-28'), type: 'CREDIT', amount: 700, lifecycle: 'RECEIVABLE', externalId: null, description: 'RECEBIMENTO' },
]

describe('buildReconcileUniverse — pending NUNCA sai do universo', () => {
  it('inclui EFFECTED e os pending (PAYABLE/RECEIVABLE)', () => {
    const u = buildReconcileUniverse(effected, pending)
    expect(u).toHaveLength(3)
    const ids = u.map((t) => t.id)
    expect(ids).toContain('p1')
    expect(ids).toContain('p2')
  })

  it('preserva o lifecycle dos pending (senão o match não vira `promoted`)', () => {
    const u = buildReconcileUniverse(effected, pending)
    expect(u.find((t) => t.id === 'p1')!.lifecycle).toBe('PAYABLE')
    expect(u.find((t) => t.id === 'p2')!.lifecycle).toBe('RECEIVABLE')
    expect(u.find((t) => t.id === 'e1')!.lifecycle).toBe('EFFECTED')
  })

  it('sinal por tipo: DEBIT negativo, CREDIT positivo', () => {
    const u = buildReconcileUniverse(effected, pending)
    expect(u.find((t) => t.id === 'p1')!.signedAmount).toBe(-4092.02)
    expect(u.find((t) => t.id === 'p2')!.signedAmount).toBe(700)
  })

  it('signedById tem precedência p/ EFFECTED (transferências já resolvidas)', () => {
    const u = buildReconcileUniverse(effected, pending, new Map([['e1', 12.5]]))
    expect(u.find((t) => t.id === 'e1')!.signedAmount).toBe(12.5)
  })

  it('sem pending ⇒ universo = só EFFECTED (não quebra caminho antigo)', () => {
    expect(buildReconcileUniverse(effected, [])).toHaveLength(1)
  })
})
