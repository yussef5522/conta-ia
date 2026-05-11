import { describe, it, expect } from 'vitest'
import {
  calculateByAccountCashflow,
  type CashflowByAccountTransaction,
} from '@/lib/cashflow/by-account'
import type { CashflowPeriod } from '@/lib/cashflow/consolidated'

function bt(id: string, signedAmount: number, date: string): CashflowByAccountTransaction {
  return { id, signedAmount, date: new Date(date) }
}

const PERIODO_MAIO: CashflowPeriod = {
  startDate: new Date('2026-05-01T00:00:00Z'),
  endDate: new Date('2026-05-31T23:59:59Z'),
  groupBy: 'day',
}

describe('calculateByAccountCashflow — INCLUI TRANSFER via signedAmount', () => {
  it('signedAmount positivo vira income; negativo vira expense', () => {
    const r = calculateByAccountCashflow(
      [bt('t1', 1000, '2026-05-15'), bt('t2', -300, '2026-05-15')],
      PERIODO_MAIO,
      'acc-1',
    )
    expect(r.totals.income).toBe(1000)
    expect(r.totals.expense).toBe(300)
    expect(r.totals.net).toBe(700)
  })

  it('TRANSFER de saída (signedAmount=-200) vira expense — diferente do consolidado', () => {
    const r = calculateByAccountCashflow(
      [
        bt('credit', 500, '2026-05-15'),
        bt('transfer-out', -200, '2026-05-16'),
      ],
      PERIODO_MAIO,
      'acc-1',
    )
    expect(r.totals.income).toBe(500)
    expect(r.totals.expense).toBe(200)
    expect(r.totals.transactionCount).toBe(2) // TRANSFER conta aqui
  })

  it('TRANSFER de entrada (signedAmount=+500) vira income', () => {
    const r = calculateByAccountCashflow(
      [bt('transfer-in', 500, '2026-05-15')],
      PERIODO_MAIO,
      'acc-1',
    )
    expect(r.totals.income).toBe(500)
    expect(r.totals.expense).toBe(0)
  })

  it('zero signedAmount não conta nem income nem expense', () => {
    const r = calculateByAccountCashflow(
      [bt('zero', 0, '2026-05-15'), bt('real', 100, '2026-05-15')],
      PERIODO_MAIO,
      'acc-1',
    )
    expect(r.totals.income).toBe(100)
    expect(r.totals.transactionCount).toBe(2)
  })

  it('agrupa por dia ordenado ASC', () => {
    const r = calculateByAccountCashflow(
      [
        bt('a', 100, '2026-05-20'),
        bt('b', 50, '2026-05-15'),
        bt('c', -30, '2026-05-15'),
      ],
      PERIODO_MAIO,
      'acc-1',
    )
    expect(r.byPeriod).toHaveLength(2)
    expect(r.byPeriod[0].bucketStart < r.byPeriod[1].bucketStart).toBe(true)
    expect(r.byPeriod[0].net).toBe(20) // 50 - 30 em 15-mai
    expect(r.byPeriod[1].net).toBe(100) // 100 em 20-mai
  })

  it('range filter: fora do período é IGNORADO', () => {
    const r = calculateByAccountCashflow(
      [
        bt('out', 9999, '2026-04-15'),
        bt('in', 100, '2026-05-15'),
      ],
      PERIODO_MAIO,
      'acc-1',
    )
    expect(r.totals.income).toBe(100)
  })

  it('bankAccountId aparece no result', () => {
    const r = calculateByAccountCashflow([], PERIODO_MAIO, 'acc-banrisul-123')
    expect(r.bankAccountId).toBe('acc-banrisul-123')
  })

  it('bankAccountId vazio LANÇA', () => {
    expect(() => calculateByAccountCashflow([], PERIODO_MAIO, '')).toThrow(/bankAccountId/i)
  })

  it('startDate > endDate LANÇA', () => {
    expect(() =>
      calculateByAccountCashflow(
        [],
        {
          startDate: new Date('2026-05-31'),
          endDate: new Date('2026-05-01'),
          groupBy: 'day',
        },
        'acc-1',
      ),
    ).toThrow(/startDate/i)
  })

  it('cenário 13 academias: par TRANSFER + receita + despesa = nets corretos', () => {
    // Esta é a conta Banrisul: recebeu receita 10k, fez transfer-out 5k pra Sicoob, pagou folha 2k
    const r = calculateByAccountCashflow(
      [
        bt('receita', 10_000, '2026-05-15'),
        bt('transfer-out', -5_000, '2026-05-16'),
        bt('folha', -2_000, '2026-05-17'),
      ],
      PERIODO_MAIO,
      'acc-banrisul',
    )
    expect(r.totals.income).toBe(10_000)
    expect(r.totals.expense).toBe(7_000) // 5k transfer + 2k folha
    expect(r.totals.net).toBe(3_000)
  })
})
