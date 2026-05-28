// Sprint 5.0.4.0a (a3) — Tests do Top N Categorias.

import { describe, it, expect } from 'vitest'
import {
  computeTopCategorias,
  colorForIndex,
  BAR_COLORS,
  type CategoriaInputTx,
} from '@/lib/relatorios/categorias'

function tx(
  date: string,
  amount: number,
  catId: string | null,
  catName: string,
  type: 'DEBIT' | 'CREDIT' = 'DEBIT',
): CategoriaInputTx {
  return {
    date,
    amount,
    type,
    categoryId: catId,
    categoryName: catName,
    dreGroup: null,
  }
}

const START = new Date('2026-05-01T00:00:00.000Z')
const END = new Date('2026-05-31T23:59:59.999Z')

describe('computeTopCategorias — básico', () => {
  it('agrupa por categoryId e soma amount + count', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-10', 100, 'a', 'A'),
        tx('2026-05-15', 200, 'a', 'A'),
        tx('2026-05-20', 50, 'b', 'B'),
      ],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ categoryId: 'a', amount: 300, count: 2 })
    expect(r.rows[1]).toMatchObject({ categoryId: 'b', amount: 50, count: 1 })
  })

  it('ordena por amount DESC', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-01', 100, 'small', 'Small'),
        tx('2026-05-01', 5000, 'big', 'Big'),
        tx('2026-05-01', 1000, 'mid', 'Mid'),
      ],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows.map((x) => x.categoryName)).toEqual(['Big', 'Mid', 'Small'])
  })

  it('percent calcula corretamente', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-01', 700, 'a', 'A'),
        tx('2026-05-01', 300, 'b', 'B'),
      ],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows[0].percent).toBe(70)
    expect(r.rows[1].percent).toBe(30)
  })
})

describe('computeTopCategorias — Top N + Outras', () => {
  it('topN=2 com 5 categorias: rows.length=2 + outras agrega resto', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-01', 100, 'a', 'A'),
        tx('2026-05-01', 200, 'b', 'B'),
        tx('2026-05-01', 300, 'c', 'C'),
        tx('2026-05-01', 400, 'd', 'D'),
        tx('2026-05-01', 500, 'e', 'E'),
      ],
      start: START,
      end: END,
      tipo: 'DESPESA',
      topN: 2,
    })
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].categoryName).toBe('E') // 500
    expect(r.rows[1].categoryName).toBe('D') // 400
    expect(r.outras).not.toBeNull()
    expect(r.outras!.amount).toBe(100 + 200 + 300) // A+B+C
    expect(r.outras!.categoryName).toBe('Outras 3 categorias')
  })

  it('topN cabe tudo: outras é null', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-01', 100, 'a', 'A'),
        tx('2026-05-01', 200, 'b', 'B'),
      ],
      start: START,
      end: END,
      tipo: 'DESPESA',
      topN: 10,
    })
    expect(r.outras).toBeNull()
  })

  it('default topN=10', () => {
    const txs = Array.from({ length: 12 }).map((_, i) =>
      tx('2026-05-01', (i + 1) * 100, `cat${i}`, `Cat${i}`),
    )
    const r = computeTopCategorias({ txs, start: START, end: END, tipo: 'DESPESA' })
    expect(r.rows).toHaveLength(10)
    expect(r.outras).not.toBeNull()
    expect(r.outras!.categoryName).toBe('Outras 2 categorias')
  })
})

describe('computeTopCategorias — filtros', () => {
  it('filtra por tipo DESPESA ignora CREDIT', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-01', 100, 'a', 'A', 'DEBIT'),
        tx('2026-05-01', 9999, 'b', 'B', 'CREDIT'),
      ],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].categoryName).toBe('A')
  })

  it('filtra por tipo RECEITA ignora DEBIT', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-01', 100, 'a', 'A', 'DEBIT'),
        tx('2026-05-01', 9999, 'b', 'B', 'CREDIT'),
      ],
      start: START,
      end: END,
      tipo: 'RECEITA',
    })
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].categoryName).toBe('B')
  })

  it('tipo TODOS soma ambos (em módulo)', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-05-01', 100, 'a', 'A', 'DEBIT'),
        tx('2026-05-01', 200, 'b', 'B', 'CREDIT'),
      ],
      start: START,
      end: END,
      tipo: 'TODOS',
    })
    expect(r.rows).toHaveLength(2)
    expect(r.totalAmount).toBe(300)
  })

  it('filtra fora do período', () => {
    const r = computeTopCategorias({
      txs: [
        tx('2026-04-30', 9999, 'before', 'Before'), // 1 dia ANTES
        tx('2026-06-01', 9999, 'after', 'After'), // 1 dia DEPOIS
        tx('2026-05-15', 100, 'in', 'In'),
      ],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].categoryName).toBe('In')
  })

  it('sem categoria → bucket "Sem categoria"', () => {
    const r = computeTopCategorias({
      txs: [tx('2026-05-01', 100, null, 'whatever')],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows[0].categoryId).toBeNull()
  })
})

describe('Empty cases', () => {
  it('Sem transactions → totais zero, rows vazio', () => {
    const r = computeTopCategorias({
      txs: [],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows).toHaveLength(0)
    expect(r.totalAmount).toBe(0)
    expect(r.totalCount).toBe(0)
    expect(r.outras).toBeNull()
  })

  it('Apenas RECEITA, filtro DESPESA: rows vazio, percent=0', () => {
    const r = computeTopCategorias({
      txs: [tx('2026-05-01', 100, 'a', 'A', 'CREDIT')],
      start: START,
      end: END,
      tipo: 'DESPESA',
    })
    expect(r.rows).toHaveLength(0)
  })
})

describe('colorForIndex', () => {
  it('retorna cores diferentes pros primeiros 10', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 10; i++) seen.add(colorForIndex(i))
    expect(seen.size).toBe(10)
  })

  it('cicla após 10', () => {
    expect(colorForIndex(0)).toBe(colorForIndex(10))
    expect(colorForIndex(1)).toBe(colorForIndex(11))
  })

  it('BAR_COLORS tem 10 cores', () => {
    expect(BAR_COLORS).toHaveLength(10)
  })
})
