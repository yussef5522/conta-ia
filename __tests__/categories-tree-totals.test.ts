// Sprint 3.0.2 B3 — totalAmount + totalAmountRollup em buildTree.

import { describe, it, expect } from 'vitest'
import { buildTree } from '@/lib/categories/buildTree'
import type { CategoryFlat } from '@/lib/categories/buildTree'

const COMMON = {
  type: 'EXPENSE',
  dreGroup: 'DESPESAS_ADMINISTRATIVAS',
  code: null,
  description: null,
  color: '#999',
  icon: null,
  order: 0,
  visibleInRegimes: null,
  isActive: true,
  isSystemDefault: false,
}

describe('buildTree — totalAmount + totalAmountRollup', () => {
  it('totalAmount default 0 quando ausente', () => {
    const flat: CategoryFlat[] = [
      { id: 'a', name: 'A', parentId: null, ...COMMON },
    ]
    const tree = buildTree(flat)
    expect(tree[0].totalAmount).toBe(0)
    expect(tree[0].totalAmountRollup).toBe(0)
  })

  it('totalAmount preservado de CategoryFlat', () => {
    const flat: CategoryFlat[] = [
      { id: 'a', name: 'A', parentId: null, totalAmount: 1000, ...COMMON },
    ]
    const tree = buildTree(flat)
    expect(tree[0].totalAmount).toBe(1000)
    expect(tree[0].totalAmountRollup).toBe(1000) // sem filhos = rollup = próprio
  })

  it('rollup soma próprio + filhos', () => {
    const flat: CategoryFlat[] = [
      { id: 'pai', name: 'CMV', parentId: null, totalAmount: 0, ...COMMON },
      { id: 'a', name: 'Matéria-Prima', parentId: 'pai', totalAmount: 500, ...COMMON },
      { id: 'b', name: 'Embalagens', parentId: 'pai', totalAmount: 300, ...COMMON },
    ]
    const tree = buildTree(flat)
    const pai = tree[0]
    expect(pai.totalAmount).toBe(0)
    expect(pai.totalAmountRollup).toBe(800) // 0 + 500 + 300
    // Children ordenados por nome (alfabético pt-BR): Embalagens vem antes
    const embalagens = pai.children.find((c) => c.id === 'b')
    const materiaPrima = pai.children.find((c) => c.id === 'a')
    expect(embalagens?.totalAmountRollup).toBe(300)
    expect(materiaPrima?.totalAmountRollup).toBe(500)
  })

  it('rollup recursivo em 3 níveis (pai → filho → neto)', () => {
    const flat: CategoryFlat[] = [
      { id: 'avo', name: 'Receita', parentId: null, totalAmount: 100, ...COMMON },
      { id: 'pai', name: 'Vendas', parentId: 'avo', totalAmount: 200, ...COMMON },
      { id: 'filho', name: 'Pix', parentId: 'pai', totalAmount: 500, ...COMMON },
      { id: 'filho2', name: 'Cartão', parentId: 'pai', totalAmount: 300, ...COMMON },
    ]
    const tree = buildTree(flat)
    const avo = tree[0]
    expect(avo.totalAmountRollup).toBe(1100) // 100 + 200 + 500 + 300
    expect(avo.children[0].totalAmountRollup).toBe(1000) // pai = 200 + 500 + 300
    // Children ordenados por nome: Cartão vem antes de Pix
    const pix = avo.children[0].children.find((c) => c.id === 'filho')
    const cartao = avo.children[0].children.find((c) => c.id === 'filho2')
    expect(pix?.totalAmountRollup).toBe(500)
    expect(cartao?.totalAmountRollup).toBe(300)
  })

  it('próprio ≠ rollup quando pai tem totalAmount E filhos', () => {
    const flat: CategoryFlat[] = [
      { id: 'pai', name: 'Pai', parentId: null, totalAmount: 100, ...COMMON },
      { id: 'filho', name: 'Filho', parentId: 'pai', totalAmount: 50, ...COMMON },
    ]
    const tree = buildTree(flat)
    expect(tree[0].totalAmount).toBe(100)
    expect(tree[0].totalAmountRollup).toBe(150)
  })
})
