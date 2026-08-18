import { describe, it, expect } from 'vitest'
import { filterToReconcileMissing } from '../filter-new-by-reconcile'

// Filtro-verdade do preview (bug Stone 17/08). Cenário real: o gate marcou 61 novas
// (11 transferências IN que JÁ existiam + 50 legítimas); o reconcile diz 50 missing.
// O filtro tem que sobrar exatamente as 50 e remover as 11.

type Nova = { id: string; key: string }
const keyOf = (n: Nova) => n.key

describe('filterToReconcileMissing', () => {
  it('Stone: 61 novas do gate, 50 no reconcile → sobram 50, removem 11', () => {
    const transferencias = Array.from({ length: 11 }, (_, i) => ({ id: `transf${i}`, key: `k-transf-${i}` }))
    const legitimas = Array.from({ length: 50 }, (_, i) => ({ id: `nova${i}`, key: `k-nova-${i}` }))
    const gate = [...transferencias, ...legitimas]
    // reconcile.missing = só as 50 legítimas
    const missing = new Map(legitimas.map((n) => [n.key, 1]))
    const { kept, removed } = filterToReconcileMissing(gate, keyOf, missing)
    expect(kept).toHaveLength(50)
    expect(removed).toBe(11)
    expect(kept.every((n) => n.id.startsWith('nova'))).toBe(true)
  })

  it('repeat legítimo: gate tem 2 do mesmo key, reconcile diz 2 → mantém os 2', () => {
    const gate: Nova[] = [{ id: 'a', key: 'k' }, { id: 'b', key: 'k' }]
    const missing = new Map([['k', 2]])
    const { kept, removed } = filterToReconcileMissing(gate, keyOf, missing)
    expect(kept).toHaveLength(2)
    expect(removed).toBe(0)
  })

  it('repeat parcial: gate tem 2 do mesmo key, reconcile diz 1 → mantém 1, remove 1', () => {
    const gate: Nova[] = [{ id: 'a', key: 'k' }, { id: 'b', key: 'k' }]
    const missing = new Map([['k', 1]])
    const { kept, removed } = filterToReconcileMissing(gate, keyOf, missing)
    expect(kept).toHaveLength(1)
    expect(removed).toBe(1)
  })

  it('reconcile vazio (nada é novo) → remove tudo', () => {
    const gate: Nova[] = [{ id: 'a', key: 'k1' }, { id: 'b', key: 'k2' }]
    const { kept, removed } = filterToReconcileMissing(gate, keyOf, new Map())
    expect(kept).toHaveLength(0)
    expect(removed).toBe(2)
  })
})
