import { describe, it, expect } from 'vitest'
import {
  prepareBalanceTransactions,
  type RawBalanceTransaction,
} from '@/lib/balance/prepare'

const ACC = 'acc-target'
const OTHER = 'acc-other'

function tx(
  id: string,
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER',
  amount: number,
  bankAccountId: string,
  opts: Partial<RawBalanceTransaction> = {},
): RawBalanceTransaction {
  return {
    id,
    type,
    amount,
    bankAccountId,
    date: opts.date ?? new Date('2026-05-01T12:00:00Z'),
    createdAt: opts.createdAt ?? new Date('2026-05-01T12:00:00Z'),
    transferGroupId: opts.transferGroupId ?? null,
  }
}

describe('prepareBalanceTransactions (Sprint 0.5 Dia 3)', () => {
  it('CREDIT vira signedAmount positivo', () => {
    const r = prepareBalanceTransactions([tx('t1', 'CREDIT', 1000, ACC)], ACC)
    expect(r).toHaveLength(1)
    expect(r[0].signedAmount).toBe(1000)
    expect(r[0].rawType).toBe('CREDIT')
  })

  it('DEBIT vira signedAmount negativo', () => {
    const r = prepareBalanceTransactions([tx('t1', 'DEBIT', 500, ACC)], ACC)
    expect(r).toHaveLength(1)
    expect(r[0].signedAmount).toBe(-500)
    expect(r[0].rawType).toBe('DEBIT')
  })

  it('FILTRA transações de OUTRAS contas (isolamento multi-tenant)', () => {
    const r = prepareBalanceTransactions(
      [
        tx('t1', 'CREDIT', 1000, ACC),
        tx('t2', 'CREDIT', 9999, OTHER), // de outra conta — não deve vazar
      ],
      ACC,
    )
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('t1')
  })

  it('TRANSFER: primeira ponta criada (createdAt menor) é a SAÍDA', () => {
    const r = prepareBalanceTransactions(
      [
        tx('out', 'TRANSFER', 200, ACC, {
          transferGroupId: 'g1',
          createdAt: new Date('2026-05-01T10:00:00Z'),
        }),
        tx('in', 'TRANSFER', 200, OTHER, {
          transferGroupId: 'g1',
          createdAt: new Date('2026-05-01T10:00:01Z'),
        }),
      ],
      ACC,
    )
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('out')
    expect(r[0].signedAmount).toBe(-200) // saída
    expect(r[0].rawType).toBe('TRANSFER')
  })

  it('TRANSFER: segunda ponta criada (createdAt maior) é a ENTRADA', () => {
    const r = prepareBalanceTransactions(
      [
        tx('out', 'TRANSFER', 200, OTHER, {
          transferGroupId: 'g1',
          createdAt: new Date('2026-05-01T10:00:00Z'),
        }),
        tx('in', 'TRANSFER', 200, ACC, {
          transferGroupId: 'g1',
          createdAt: new Date('2026-05-01T10:00:01Z'),
        }),
      ],
      ACC,
    )
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('in')
    expect(r[0].signedAmount).toBe(200) // entrada
  })

  it('TRANSFER sem transferGroupId é skipada (estado inválido)', () => {
    const r = prepareBalanceTransactions(
      [tx('t1', 'TRANSFER', 100, ACC, { transferGroupId: null })],
      ACC,
    )
    expect(r).toHaveLength(0)
  })

  it('TRANSFER com par incompleto (só 1 ponta) é skipada', () => {
    const r = prepareBalanceTransactions(
      [tx('t1', 'TRANSFER', 100, ACC, { transferGroupId: 'g-orphan' })],
      ACC,
    )
    expect(r).toHaveLength(0)
  })

  it('targetAccountId vazio lança (multi-tenant guard)', () => {
    expect(() => prepareBalanceTransactions([], '')).toThrow(/multi-tenant/i)
  })

  it('preserva date original na saída', () => {
    const date = new Date('2026-04-15T08:30:00Z')
    const r = prepareBalanceTransactions([tx('t1', 'CREDIT', 100, ACC, { date })], ACC)
    expect(r[0].date).toEqual(date)
  })

  it('mix complexo: CREDIT + DEBIT + TRANSFER par completo', () => {
    const r = prepareBalanceTransactions(
      [
        tx('c1', 'CREDIT', 1000, ACC),
        tx('d1', 'DEBIT', 300, ACC),
        tx('out', 'TRANSFER', 200, ACC, {
          transferGroupId: 'g1',
          createdAt: new Date('2026-05-01T10:00:00Z'),
        }),
        tx('in', 'TRANSFER', 200, OTHER, {
          transferGroupId: 'g1',
          createdAt: new Date('2026-05-01T10:00:01Z'),
        }),
      ],
      ACC,
    )
    expect(r).toHaveLength(3)
    const sum = r.reduce((s, t) => s + t.signedAmount, 0)
    expect(sum).toBe(1000 - 300 - 200) // 500
  })
})
