// Sprint 5.0.3.0c (c4) — Tests do aging computation.

import { describe, it, expect } from 'vitest'
import {
  bucketFor,
  computeAging,
  AGING_BUCKET_IDS,
  AGING_COLORS,
} from '@/lib/contas-pagar/aging'

const NOW = new Date('2026-05-27T12:00:00.000Z')

function row(over: Record<string, unknown> = {}) {
  return {
    status: 'PENDING',
    dueDate: '2026-05-01', // 26 dias atrás
    paymentDate: null,
    amount: 100,
    ...over,
  } as Parameters<typeof bucketFor>[0]
}

describe('bucketFor — só conta vencidas PENDING', () => {
  it('PAID (paymentDate preenchido) → null', () => {
    expect(
      bucketFor(row({ paymentDate: '2026-04-15' }), NOW),
    ).toBeNull()
  })

  it('status RECONCILED → null (não é vencida ativa)', () => {
    expect(bucketFor(row({ status: 'RECONCILED' }), NOW)).toBeNull()
  })

  it('status IGNORED → null', () => {
    expect(bucketFor(row({ status: 'IGNORED' }), NOW)).toBeNull()
  })

  it('dueDate FUTURO → null (ainda não venceu)', () => {
    expect(bucketFor(row({ dueDate: '2026-06-15' }), NOW)).toBeNull()
  })

  it('dueDate HOJE → null (vence hoje, ainda no prazo)', () => {
    expect(bucketFor(row({ dueDate: '2026-05-27' }), NOW)).toBeNull()
  })

  it('dueDate nula → null', () => {
    expect(bucketFor(row({ dueDate: null }), NOW)).toBeNull()
  })
})

describe('bucketFor — faixas', () => {
  it('1 dia atrasada → 0-30', () => {
    expect(bucketFor(row({ dueDate: '2026-05-26' }), NOW)).toBe('0-30')
  })

  it('30 dias atrasada → 0-30 (limite superior)', () => {
    expect(bucketFor(row({ dueDate: '2026-04-27' }), NOW)).toBe('0-30')
  })

  it('31 dias atrasada → 31-60', () => {
    expect(bucketFor(row({ dueDate: '2026-04-26' }), NOW)).toBe('31-60')
  })

  it('60 dias atrasada → 31-60 (limite superior)', () => {
    expect(bucketFor(row({ dueDate: '2026-03-28' }), NOW)).toBe('31-60')
  })

  it('61 dias atrasada → 61-90', () => {
    expect(bucketFor(row({ dueDate: '2026-03-27' }), NOW)).toBe('61-90')
  })

  it('90 dias atrasada → 61-90 (limite superior)', () => {
    expect(bucketFor(row({ dueDate: '2026-02-26' }), NOW)).toBe('61-90')
  })

  it('91 dias atrasada → 90+', () => {
    expect(bucketFor(row({ dueDate: '2026-02-25' }), NOW)).toBe('90+')
  })

  it('365 dias atrasada → 90+', () => {
    expect(bucketFor(row({ dueDate: '2025-05-27' }), NOW)).toBe('90+')
  })
})

describe('computeAging', () => {
  it('lista vazia → todos buckets em 0', () => {
    const result = computeAging([], NOW)
    expect(result.total).toEqual({ count: 0, amount: 0 })
    for (const b of result.buckets) {
      expect(b.count).toBe(0)
      expect(b.amount).toBe(0)
      expect(b.percent).toBe(0)
    }
  })

  it('1 conta em cada bucket', () => {
    const result = computeAging(
      [
        row({ dueDate: '2026-05-15', amount: 100 }), // 12d → 0-30
        row({ dueDate: '2026-04-15', amount: 200 }), // 42d → 31-60
        row({ dueDate: '2026-03-15', amount: 300 }), // 73d → 61-90
        row({ dueDate: '2025-12-15', amount: 400 }), // 163d → 90+
      ],
      NOW,
    )
    expect(result.total).toEqual({ count: 4, amount: 1000 })
    const byId = Object.fromEntries(
      result.buckets.map((b) => [b.id, b]),
    )
    expect(byId['0-30'].count).toBe(1)
    expect(byId['0-30'].amount).toBe(100)
    expect(byId['31-60'].amount).toBe(200)
    expect(byId['61-90'].amount).toBe(300)
    expect(byId['90+'].amount).toBe(400)
  })

  it('percent = amount / totalAmount × 100', () => {
    const result = computeAging(
      [
        row({ dueDate: '2026-05-15', amount: 100 }), // 0-30
        row({ dueDate: '2026-03-15', amount: 300 }), // 61-90
      ],
      NOW,
    )
    const byId = Object.fromEntries(result.buckets.map((b) => [b.id, b]))
    expect(byId['0-30'].percent).toBe(25) // 100/400 × 100
    expect(byId['61-90'].percent).toBe(75) // 300/400 × 100
  })

  it('ignora pagas/RECONCILED no total', () => {
    const result = computeAging(
      [
        row({ dueDate: '2026-05-15', amount: 100 }), // vencida → conta
        row({ dueDate: '2026-04-15', amount: 200, paymentDate: '2026-04-20' }), // paga → ignora
        row({ status: 'RECONCILED', dueDate: '2026-03-15', amount: 999 }), // ignora
      ],
      NOW,
    )
    expect(result.total).toEqual({ count: 1, amount: 100 })
  })

  it('sums dentro do bucket', () => {
    const result = computeAging(
      [
        row({ dueDate: '2026-05-20', amount: 100 }), // 0-30
        row({ dueDate: '2026-05-15', amount: 250 }), // 0-30
        row({ dueDate: '2026-05-10', amount: 50 }), // 0-30
      ],
      NOW,
    )
    const bucket030 = result.buckets.find((b) => b.id === '0-30')!
    expect(bucket030.count).toBe(3)
    expect(bucket030.amount).toBe(400)
    expect(bucket030.percent).toBe(100)
  })

  it('total ÚNICO bucket → percent 100', () => {
    const result = computeAging(
      [row({ dueDate: '2026-05-15', amount: 999 })],
      NOW,
    )
    const bucket030 = result.buckets.find((b) => b.id === '0-30')!
    expect(bucket030.percent).toBe(100)
  })
})

describe('AGING_BUCKET_IDS + AGING_COLORS — estrutura', () => {
  it('4 buckets na ordem certa', () => {
    expect(AGING_BUCKET_IDS).toEqual(['0-30', '31-60', '61-90', '90+'])
  })

  it('cores definidas pros 4 buckets', () => {
    for (const id of AGING_BUCKET_IDS) {
      expect(AGING_COLORS[id]).toBeDefined()
      expect(AGING_COLORS[id].text).toMatch(/text-/)
      expect(AGING_COLORS[id].bg).toMatch(/bg-/)
      expect(AGING_COLORS[id].label).toContain('dias')
    }
  })

  it('90+ é o mais alarmante (bold)', () => {
    expect(AGING_COLORS['90+'].text).toContain('font-bold')
  })
})
