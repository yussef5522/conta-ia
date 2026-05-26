// Sprint 5.0.2.f — Detect compras nas Transactions (heurística categoria).

import { describe, it, expect } from 'vitest'
import { detectComprasFromTransactions } from '@/lib/tax/detect-compras'

interface TxFix {
  amount: number
  type: string
  category: { name: string; dreGroup: string | null } | null
  supplier: { razaoSocial: string | null } | null
  description: string | null
}

function tx(o: Partial<TxFix>): TxFix {
  return {
    amount: 0,
    type: 'DEBIT',
    category: null,
    supplier: null,
    description: null,
    ...o,
  }
}

describe('detectComprasFromTransactions — categoria por keyword', () => {
  it('detecta "Fornecedores"', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 1000, category: { name: 'Fornecedores Bebidas', dreGroup: null } }),
    ])
    expect(r.totalCompras).toBe(1000)
  })

  it('detecta "Material" (case-insensitive)', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 500, category: { name: 'MATERIAL DE LIMPEZA', dreGroup: null } }),
    ])
    expect(r.totalCompras).toBe(500)
  })

  it('detecta "Insumos"', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 300, category: { name: 'Insumos diretos', dreGroup: null } }),
    ])
    expect(r.totalCompras).toBe(300)
  })

  it('detecta "Embalagens"', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 200, category: { name: 'Embalagens delivery', dreGroup: null } }),
    ])
    expect(r.totalCompras).toBe(200)
  })

  it('detecta "Bebidas"', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 800, category: { name: 'Bebidas alcoolicas', dreGroup: null } }),
    ])
    expect(r.totalCompras).toBe(800)
  })

  it('NÃO detecta categoria de despesa não-compra', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 1000, category: { name: 'Aluguel', dreGroup: 'DESPESAS_OCUPACAO' } }),
      tx({ amount: 500, category: { name: 'Energia Elétrica', dreGroup: 'DESPESAS_OCUPACAO' } }),
    ])
    expect(r.totalCompras).toBe(0)
  })
})

describe('detectComprasFromTransactions — dreGroup', () => {
  it('detecta dreGroup CUSTO_MERCADORIA mesmo sem keyword', () => {
    const r = detectComprasFromTransactions([
      tx({
        amount: 5000,
        category: { name: 'Compra revenda', dreGroup: 'CUSTO_MERCADORIA' },
      }),
    ])
    expect(r.totalCompras).toBe(5000)
  })

  it('detecta CUSTO_INSUMO', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 2000, category: { name: 'Insumos', dreGroup: 'CUSTO_INSUMO' } }),
    ])
    expect(r.totalCompras).toBe(2000)
  })
})

describe('detectComprasFromTransactions — agregados', () => {
  it('Top categorias ordenado desc com pct', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 1000, category: { name: 'Bebidas', dreGroup: null } }),
      tx({ amount: 500, category: { name: 'Bebidas', dreGroup: null } }),
      tx({ amount: 300, category: { name: 'Material', dreGroup: null } }),
    ])
    expect(r.totalCompras).toBe(1800)
    expect(r.topCategorias[0]).toMatchObject({ category: 'Bebidas', valor: 1500 })
    expect(r.topCategorias[0].pct).toBeCloseTo(83.33, 1)
  })

  it('Conta fornecedores únicos (via supplier OR description)', () => {
    const r = detectComprasFromTransactions([
      tx({
        amount: 100,
        category: { name: 'Fornecedores', dreGroup: null },
        supplier: { razaoSocial: 'Ambev' },
      }),
      tx({
        amount: 200,
        category: { name: 'Fornecedores', dreGroup: null },
        supplier: { razaoSocial: 'Ambev' }, // dup
      }),
      tx({
        amount: 300,
        category: { name: 'Fornecedores', dreGroup: null },
        supplier: null,
        description: 'PIX SADIA',
      }),
    ])
    expect(r.fornecedoresUnicos).toBe(2) // Ambev + SADIA
  })

  it('Soma receitas (CREDIT)', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 10_000, type: 'CREDIT' }),
      tx({ amount: 2000, type: 'CREDIT' }),
      tx({ amount: 500, type: 'DEBIT', category: { name: 'Fornecedores', dreGroup: null } }),
    ])
    expect(r.receitaTotal).toBe(12_000)
  })

  it('IGNORA TRANSFER', () => {
    const r = detectComprasFromTransactions([
      tx({ amount: 5000, type: 'TRANSFER' }),
      tx({ amount: 1000, type: 'CREDIT' }),
    ])
    expect(r.totalCompras).toBe(0)
    expect(r.receitaTotal).toBe(1000)
  })
})
