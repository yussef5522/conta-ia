import { describe, it, expect } from 'vitest'
import {
  calculateConsolidatedCashflow,
  type CashflowTransaction,
  type CashflowPeriod,
} from '@/lib/cashflow/consolidated'

function tx(
  id: string,
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER',
  amount: number,
  date: string,
): CashflowTransaction {
  return { id, type, amount, date: new Date(date) }
}

const PERIODO_MAIO: CashflowPeriod = {
  startDate: new Date('2026-05-01T00:00:00Z'),
  endDate: new Date('2026-05-31T23:59:59Z'),
  groupBy: 'day',
}

describe('calculateConsolidatedCashflow — happy paths', () => {
  it('soma simples por dia', () => {
    const r = calculateConsolidatedCashflow(
      [
        tx('t1', 'CREDIT', 1000, '2026-05-15T10:00:00Z'),
        tx('t2', 'DEBIT', 300, '2026-05-15T15:00:00Z'),
      ],
      PERIODO_MAIO,
      'comp-X',
    )
    expect(r.totals.income).toBe(1000)
    expect(r.totals.expense).toBe(300)
    expect(r.totals.net).toBe(700)
    expect(r.totals.transactionCount).toBe(2)
    expect(r.byPeriod).toHaveLength(1)
    expect(r.byPeriod[0].net).toBe(700)
  })

  it('IGNORA type=TRANSFER (defesa em profundidade)', () => {
    const r = calculateConsolidatedCashflow(
      [
        tx('t1', 'CREDIT', 1000, '2026-05-15T10:00:00Z'),
        tx('t2', 'TRANSFER', 50_000, '2026-05-15T11:00:00Z'),
        tx('t3', 'DEBIT', 200, '2026-05-15T12:00:00Z'),
      ],
      PERIODO_MAIO,
      'comp-X',
    )
    expect(r.totals.income).toBe(1000)
    expect(r.totals.expense).toBe(200)
    expect(r.totals.transactionCount).toBe(2) // TRANSFER não conta
  })

  it('agrupa por month corretamente', () => {
    const period: CashflowPeriod = {
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
      groupBy: 'month',
    }
    const r = calculateConsolidatedCashflow(
      [
        tx('jan', 'CREDIT', 1000, '2026-01-15T10:00:00Z'),
        tx('fev', 'CREDIT', 2000, '2026-02-15T10:00:00Z'),
        tx('jan2', 'DEBIT', 500, '2026-01-20T10:00:00Z'),
      ],
      period,
      'comp-X',
    )
    expect(r.byPeriod).toHaveLength(2)
    expect(r.byPeriod[0].bucketStart).toEqual(new Date('2026-01-01T00:00:00Z'))
    expect(r.byPeriod[0].net).toBe(500) // 1000 - 500
    expect(r.byPeriod[1].bucketStart).toEqual(new Date('2026-02-01T00:00:00Z'))
    expect(r.byPeriod[1].net).toBe(2000)
  })

  it('agrupa por week começando SEGUNDA (locale BR)', () => {
    const period: CashflowPeriod = {
      startDate: new Date('2026-05-01T00:00:00Z'),
      endDate: new Date('2026-05-31T23:59:59Z'),
      groupBy: 'week',
    }
    const r = calculateConsolidatedCashflow(
      [
        // Segunda 11-mai (mesma semana 11→17)
        tx('s1', 'CREDIT', 100, '2026-05-11T10:00:00Z'),
        // Sexta 15-mai (mesma semana 11→17)
        tx('s1b', 'CREDIT', 200, '2026-05-15T10:00:00Z'),
        // Segunda seguinte 18-mai (nova semana)
        tx('s2', 'CREDIT', 50, '2026-05-18T10:00:00Z'),
      ],
      period,
      'comp-X',
    )
    expect(r.byPeriod).toHaveLength(2)
    // Primeira semana começa numa segunda
    const firstWeek = r.byPeriod[0]
    expect(firstWeek.bucketStart.getUTCDay()).toBe(1) // segunda
    expect(firstWeek.income).toBe(300)
    expect(r.byPeriod[1].income).toBe(50)
  })

  it('lista vazia: zero tudo, byPeriod vazio', () => {
    const r = calculateConsolidatedCashflow([], PERIODO_MAIO, 'comp-X')
    expect(r.totals.income).toBe(0)
    expect(r.totals.expense).toBe(0)
    expect(r.byPeriod).toHaveLength(0)
  })

  it('filtra transações FORA do range mesmo se vierem no input (defensivo)', () => {
    const r = calculateConsolidatedCashflow(
      [
        tx('out', 'CREDIT', 9999, '2026-04-15T10:00:00Z'), // ABRIL — fora
        tx('in', 'CREDIT', 100, '2026-05-15T10:00:00Z'),
      ],
      PERIODO_MAIO,
      'comp-X',
    )
    expect(r.totals.income).toBe(100)
  })

  it('byPeriod vem ordenado por bucketStart ASC', () => {
    const period: CashflowPeriod = {
      startDate: new Date('2026-05-01T00:00:00Z'),
      endDate: new Date('2026-05-31T23:59:59Z'),
      groupBy: 'day',
    }
    const r = calculateConsolidatedCashflow(
      [
        tx('t3', 'CREDIT', 30, '2026-05-20T10:00:00Z'),
        tx('t1', 'CREDIT', 10, '2026-05-05T10:00:00Z'),
        tx('t2', 'CREDIT', 20, '2026-05-12T10:00:00Z'),
      ],
      period,
      'comp-X',
    )
    expect(r.byPeriod.map((b) => b.income)).toEqual([10, 20, 30])
  })
})

describe('calculateConsolidatedCashflow — multi-tenant guards', () => {
  it('companyId vazio LANÇA (isolamento inviolável)', () => {
    expect(() =>
      calculateConsolidatedCashflow([], PERIODO_MAIO, ''),
    ).toThrow(/multi-tenant/i)
  })

  it('companyId aparece no result (rastreabilidade)', () => {
    const r = calculateConsolidatedCashflow([], PERIODO_MAIO, 'comp-academia-3')
    expect(r.companyId).toBe('comp-academia-3')
  })

  it('startDate > endDate LANÇA', () => {
    expect(() =>
      calculateConsolidatedCashflow(
        [],
        {
          startDate: new Date('2026-05-31'),
          endDate: new Date('2026-05-01'),
          groupBy: 'day',
        },
        'comp-X',
      ),
    ).toThrow(/startDate/i)
  })
})
