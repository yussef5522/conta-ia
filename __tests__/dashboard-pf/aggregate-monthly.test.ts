// Sprint Dashboard PF — Testes puros da agregação mensal.

import { describe, expect, test } from 'vitest'
import { aggregateMonthly, type RawTx } from '@/lib/dashboard-pf/aggregate-monthly'

describe('aggregateMonthly — caso vazio', () => {
  test('Zero tx + 12 meses → 12 pontos com tudo zerado', () => {
    const r = aggregateMonthly({
      transactions: [],
      months: 12,
      currentBalance: 0,
      referenceDate: new Date('2026-05-15T00:00:00Z'),
    })
    expect(r.months).toHaveLength(12)
    for (const p of r.months) {
      expect(p.income).toBe(0)
      expect(p.expense).toBe(0)
      expect(p.net).toBe(0)
      expect(p.cumulativeBalance).toBe(0)
    }
    expect(r.finalBalance).toBe(0)
  })

  test('Último ponto = mês de referência', () => {
    const r = aggregateMonthly({
      transactions: [],
      months: 12,
      currentBalance: 0,
      referenceDate: new Date('2026-05-15T00:00:00Z'),
    })
    expect(r.months[11].month).toBe('2026-05')
    expect(r.months[11].label).toBe('Mai/26')
  })

  test('Primeiro ponto = N-1 meses atrás', () => {
    const r = aggregateMonthly({
      transactions: [],
      months: 12,
      currentBalance: 0,
      referenceDate: new Date('2026-05-15T00:00:00Z'),
    })
    // 11 meses antes de mai/26 = jun/25
    expect(r.months[0].month).toBe('2025-06')
    expect(r.months[0].label).toBe('Jun/25')
  })
})

describe('aggregateMonthly — virada de ano', () => {
  test('Janeiro referência → 12 meses retrocede pra fev/25', () => {
    const r = aggregateMonthly({
      transactions: [],
      months: 12,
      currentBalance: 0,
      referenceDate: new Date('2026-01-15T00:00:00Z'),
    })
    expect(r.months[0].month).toBe('2025-02')
    expect(r.months[11].month).toBe('2026-01')
  })

  test('Dezembro referência → próximo bucket é jan/26', () => {
    const r = aggregateMonthly({
      transactions: [],
      months: 6,
      currentBalance: 0,
      referenceDate: new Date('2025-12-15T00:00:00Z'),
    })
    expect(r.months[0].month).toBe('2025-07')
    expect(r.months[5].month).toBe('2025-12')
  })
})

describe('aggregateMonthly — agregação com tx', () => {
  const txs: RawTx[] = [
    { date: new Date('2026-05-10T00:00:00Z'), amount: 5000, type: 'CREDIT' },
    { date: new Date('2026-05-15T00:00:00Z'), amount: 1200, type: 'DEBIT' },
    { date: new Date('2026-05-20T00:00:00Z'), amount: 800, type: 'DEBIT' },
    { date: new Date('2026-04-10T00:00:00Z'), amount: 4500, type: 'CREDIT' },
    { date: new Date('2026-04-20T00:00:00Z'), amount: 1500, type: 'DEBIT' },
    // Fora da janela (mais antigo)
    { date: new Date('2025-04-01T00:00:00Z'), amount: 9999, type: 'CREDIT' },
  ]

  test('Soma income e expense corretamente por mês', () => {
    const r = aggregateMonthly({
      transactions: txs,
      months: 12,
      currentBalance: 0,
      referenceDate: new Date('2026-05-31T00:00:00Z'),
    })
    const may = r.months.find((p) => p.month === '2026-05')!
    expect(may.income).toBe(5000)
    expect(may.expense).toBe(2000)
    expect(may.net).toBe(3000)
    const apr = r.months.find((p) => p.month === '2026-04')!
    expect(apr.income).toBe(4500)
    expect(apr.expense).toBe(1500)
    expect(apr.net).toBe(3000)
  })

  test('Tx fora da janela é ignorada', () => {
    const r = aggregateMonthly({
      transactions: txs,
      months: 12,
      currentBalance: 0,
      referenceDate: new Date('2026-05-31T00:00:00Z'),
    })
    // 2025-04 não está na janela jun/25→mai/26
    const apr25 = r.months.find((p) => p.month === '2025-04')
    expect(apr25).toBeUndefined()
  })

  test('maxIncome e maxExpense refletem o maior bucket', () => {
    const r = aggregateMonthly({
      transactions: txs,
      months: 12,
      currentBalance: 0,
      referenceDate: new Date('2026-05-31T00:00:00Z'),
    })
    expect(r.maxIncome).toBe(5000)
    expect(r.maxExpense).toBe(2000)
  })
})

describe('aggregateMonthly — saldo cumulativo retrocedendo', () => {
  test('currentBalance = 100, último mês net=30 → saldo no fim do penúltimo = 70', () => {
    const r = aggregateMonthly({
      transactions: [
        { date: new Date('2026-05-15T00:00:00Z'), amount: 30, type: 'CREDIT' },
      ],
      months: 3,
      currentBalance: 100,
      referenceDate: new Date('2026-05-31T00:00:00Z'),
    })
    expect(r.months[2].cumulativeBalance).toBe(100)
    expect(r.months[1].cumulativeBalance).toBe(70) // 100 - 30
    expect(r.months[0].cumulativeBalance).toBe(70) // sem tx em mar
  })

  test('Saldo negativo é preservado', () => {
    const r = aggregateMonthly({
      transactions: [
        { date: new Date('2026-05-15T00:00:00Z'), amount: 1000, type: 'DEBIT' },
      ],
      months: 2,
      currentBalance: -500,
      referenceDate: new Date('2026-05-31T00:00:00Z'),
    })
    expect(r.months[1].cumulativeBalance).toBe(-500)
    // saldo em fim de abr = -500 - (-1000) = 500
    expect(r.months[0].cumulativeBalance).toBe(500)
  })
})

describe('aggregateMonthly — months parameter variável', () => {
  test('months=1 → 1 ponto (mês atual)', () => {
    const r = aggregateMonthly({
      transactions: [],
      months: 1,
      currentBalance: 0,
      referenceDate: new Date('2026-05-15T00:00:00Z'),
    })
    expect(r.months).toHaveLength(1)
    expect(r.months[0].month).toBe('2026-05')
  })

  test('months=6 → 6 pontos retrocedendo', () => {
    const r = aggregateMonthly({
      transactions: [],
      months: 6,
      currentBalance: 0,
      referenceDate: new Date('2026-05-15T00:00:00Z'),
    })
    expect(r.months).toHaveLength(6)
    expect(r.months[0].month).toBe('2025-12')
    expect(r.months[5].month).toBe('2026-05')
  })
})
