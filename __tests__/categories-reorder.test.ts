import { describe, it, expect } from 'vitest'
import { recalcularOrdens, moverParaPosicaoDe } from '../lib/categories/reorder'

describe('recalcularOrdens', () => {
  it('move último item pro topo', () => {
    const siblings = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 },
    ]
    const updates = recalcularOrdens(siblings, 'c', 0)
    // c vira primeiro (1), a vira 2, b vira 3
    expect(updates).toEqual([
      { id: 'c', order: 1 },
      { id: 'a', order: 2 },
      { id: 'b', order: 3 },
    ])
  })

  it('move primeiro item pro fim', () => {
    const siblings = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 },
    ]
    const updates = recalcularOrdens(siblings, 'a', 2)
    expect(updates).toEqual([
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
      { id: 'a', order: 3 },
    ])
  })

  it('move item pra mesma posição → sem updates', () => {
    const siblings = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 },
    ]
    const updates = recalcularOrdens(siblings, 'b', 1)
    expect(updates).toEqual([])
  })

  it('id não existe → retorna []', () => {
    const updates = recalcularOrdens([{ id: 'a', order: 1 }], 'inexistente', 0)
    expect(updates).toEqual([])
  })

  it('newIndex maior que length → fica no final (clamp)', () => {
    const siblings = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]
    const updates = recalcularOrdens(siblings, 'a', 99)
    expect(updates).toEqual([
      { id: 'b', order: 1 },
      { id: 'a', order: 2 },
    ])
  })

  it('newIndex negativo → fica no topo (clamp)', () => {
    const siblings = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]
    const updates = recalcularOrdens(siblings, 'b', -5)
    expect(updates).toEqual([
      { id: 'b', order: 1 },
      { id: 'a', order: 2 },
    ])
  })

  it('orders desordenados na entrada são normalizados', () => {
    // Entrada com gaps (10, 50, 100)
    const siblings = [
      { id: 'a', order: 100 },
      { id: 'b', order: 10 },
      { id: 'c', order: 50 },
    ]
    // b está em pos 0, c pos 1, a pos 2 — mover c pra pos 2
    const updates = recalcularOrdens(siblings, 'c', 2)
    // Resultado: b(1), a(2), c(3) — todos diferentes do original
    expect(updates).toContainEqual({ id: 'b', order: 1 })
    expect(updates).toContainEqual({ id: 'a', order: 2 })
    expect(updates).toContainEqual({ id: 'c', order: 3 })
  })
})

describe('moverParaPosicaoDe', () => {
  it('move A pra posição de B', () => {
    const siblings = [
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 },
    ]
    const updates = moverParaPosicaoDe(siblings, 'a', 'c')
    // A vai pra posição de C (index 2)
    expect(updates).toEqual([
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
      { id: 'a', order: 3 },
    ])
  })

  it('movedId === targetId → sem updates', () => {
    const updates = moverParaPosicaoDe([{ id: 'a', order: 1 }], 'a', 'a')
    expect(updates).toEqual([])
  })

  it('targetId não existe → []', () => {
    const updates = moverParaPosicaoDe([{ id: 'a', order: 1 }], 'a', 'fantasma')
    expect(updates).toEqual([])
  })
})
