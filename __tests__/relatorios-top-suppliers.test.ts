// Sprint 5.0.4.0b Fase 4 — Testes Top Fornecedores (puros).

import { describe, it, expect } from 'vitest'
import { computeTopSuppliers } from '@/lib/relatorios/top-suppliers'

describe('computeTopSuppliers', () => {
  const suppliers = [
    { id: 's1', nome: 'COMPESA', cnpj: '11.111.111/0001-11' },
    { id: 's2', nome: 'ENERGISA', cnpj: null },
    { id: 's3', nome: 'GESTRA', cnpj: '33.333.333/0001-33' },
    { id: 's4', nome: 'ACADGEAR', cnpj: null },
    { id: 's5', nome: 'CAIXA', cnpj: null },
    { id: 's6', nome: 'SEXTO', cnpj: null },
    { id: 's7', nome: 'SÉTIMO', cnpj: null },
  ]

  it('ordena por amount desc e calcula rank', () => {
    const r = computeTopSuppliers({
      current: [
        { supplierId: 's2', amount: 5000, count: 1 },
        { supplierId: 's1', amount: 18000, count: 3 },
        { supplierId: 's3', amount: 9500, count: 5 },
      ],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.rows.map((row) => row.nome)).toEqual([
      'COMPESA',
      'GESTRA',
      'ENERGISA',
    ])
    expect(r.rows[0].rank).toBe(1)
    expect(r.rows[1].rank).toBe(2)
  })

  it('calcula % do total corretamente', () => {
    const r = computeTopSuppliers({
      current: [
        { supplierId: 's1', amount: 6000, count: 1 },
        { supplierId: 's2', amount: 4000, count: 1 },
      ],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.totalAmount).toBe(10_000)
    expect(r.rows[0].percentDoTotal).toBe(60)
    expect(r.rows[1].percentDoTotal).toBe(40)
  })

  it('aplica topN como cap', () => {
    const r = computeTopSuppliers({
      current: suppliers.map((s, i) => ({
        supplierId: s.id,
        amount: 1000 * (suppliers.length - i),
        count: 1,
      })),
      previous: [],
      suppliers,
      topN: 3,
    })
    expect(r.rows).toHaveLength(3)
    expect(r.totalSuppliersUnique).toBe(7) // todos
  })

  it('trend NEW quando supplier não existia mês anterior', () => {
    const r = computeTopSuppliers({
      current: [{ supplierId: 's1', amount: 5000, count: 1 }],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.rows[0].trend).toBe('NEW')
    expect(r.rows[0].trendPct).toBeNull()
  })

  it('trend UP_STRONG quando crescimento > 50%', () => {
    const r = computeTopSuppliers({
      current: [{ supplierId: 's1', amount: 1500, count: 1 }],
      previous: [{ supplierId: 's1', amount: 1000, count: 1 }],
      suppliers,
      topN: 10,
    })
    // delta = 50%, threshold > 0.5 = NÃO UP_STRONG, é UP
    expect(r.rows[0].trend).toBe('UP')
  })

  it('trend UP_STRONG quando > 50% (ex: 60%)', () => {
    const r = computeTopSuppliers({
      current: [{ supplierId: 's1', amount: 1600, count: 1 }],
      previous: [{ supplierId: 's1', amount: 1000, count: 1 }],
      suppliers,
      topN: 10,
    })
    expect(r.rows[0].trend).toBe('UP_STRONG')
    expect(r.rows[0].trendPct).toBe(60)
  })

  it('trend STABLE quando variação ±15%', () => {
    const r = computeTopSuppliers({
      current: [{ supplierId: 's1', amount: 1050, count: 1 }],
      previous: [{ supplierId: 's1', amount: 1000, count: 1 }],
      suppliers,
      topN: 10,
    })
    expect(r.rows[0].trend).toBe('STABLE')
  })

  it('trend DOWN_STRONG quando queda > 50%', () => {
    const r = computeTopSuppliers({
      current: [{ supplierId: 's1', amount: 400, count: 1 }],
      previous: [{ supplierId: 's1', amount: 1000, count: 1 }],
      suppliers,
      topN: 10,
    })
    expect(r.rows[0].trend).toBe('DOWN_STRONG')
  })

  it('concentração top 5 calculada corretamente', () => {
    const r = computeTopSuppliers({
      current: [
        { supplierId: 's1', amount: 30000, count: 1 },
        { supplierId: 's2', amount: 20000, count: 1 },
        { supplierId: 's3', amount: 15000, count: 1 },
        { supplierId: 's4', amount: 10000, count: 1 },
        { supplierId: 's5', amount: 5000, count: 1 },
        { supplierId: 's6', amount: 10000, count: 1 },
        { supplierId: 's7', amount: 10000, count: 1 },
      ],
      previous: [],
      suppliers,
      topN: 10,
    })
    // Sort desc: 30, 20, 15, 10, 10, 10, 5
    // Top 5 = 30+20+15+10+10 = 85
    // Total = 100
    // Concentração = 85%
    expect(r.concentracaoTop5).toBe(85)
  })

  it('concentração top 5 com <5 fornecedores = 100%', () => {
    const r = computeTopSuppliers({
      current: [
        { supplierId: 's1', amount: 5000, count: 1 },
        { supplierId: 's2', amount: 3000, count: 1 },
      ],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.concentracaoTop5).toBe(100)
  })

  it('lista vazia retorna result zero', () => {
    const r = computeTopSuppliers({
      current: [],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.rows).toHaveLength(0)
    expect(r.totalAmount).toBe(0)
    expect(r.concentracaoTop5).toBe(0)
  })

  it('supplier sem metadata usa fallback', () => {
    const r = computeTopSuppliers({
      current: [{ supplierId: 'inexistente', amount: 500, count: 1 }],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.rows[0].nome).toBe('Fornecedor sem nome')
  })

  it('soma totalCount de todas as agregações', () => {
    const r = computeTopSuppliers({
      current: [
        { supplierId: 's1', amount: 100, count: 3 },
        { supplierId: 's2', amount: 200, count: 5 },
      ],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.totalCount).toBe(8)
  })

  it('trendVisual inclui símbolo + colorClass + label', () => {
    const r = computeTopSuppliers({
      current: [{ supplierId: 's1', amount: 5000, count: 1 }],
      previous: [],
      suppliers,
      topN: 10,
    })
    expect(r.rows[0].trendVisual.symbol).toBe('🆕')
    expect(r.rows[0].trendVisual.colorClass).toContain('purple')
  })
})
