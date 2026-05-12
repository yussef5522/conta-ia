import { describe, it, expect } from 'vitest'
import { calculateBalance } from '@/lib/balance/calculate'
import type { SignedBalanceTransaction } from '@/lib/balance/prepare'

function st(date: string, signedAmount: number, id = `t-${date}-${signedAmount}`): SignedBalanceTransaction {
  return { id, date: new Date(date), signedAmount, rawType: 'CREDIT' }
}

describe('calculateBalance — saldo simples (Sprint 0.5 Dia 3)', () => {
  it('lista vazia: saldo 0', () => {
    const r = calculateBalance([], 0)
    expect(r.current).toBe(0)
    expect(r.available).toBe(0)
    expect(r.inNegativeSince).toBeNull()
    expect(r.daysInNegative).toBe(0)
  })

  it('soma simples: 1000 entrada - 300 saída = 700', () => {
    const r = calculateBalance([st('2026-05-01', 1000), st('2026-05-02', -300)], 0)
    expect(r.current).toBe(700)
  })

  it('available = current + creditLimit', () => {
    const r = calculateBalance([st('2026-05-01', 500)], 100_000)
    expect(r.current).toBe(500)
    expect(r.available).toBe(100_500)
  })

  it('available cobre cheque especial: saldo -50k com limite 600k → available 550k', () => {
    const r = calculateBalance(
      [st('2026-05-01', 100_000), st('2026-05-02', -150_000)],
      600_000,
    )
    expect(r.current).toBe(-50_000)
    expect(r.available).toBe(550_000)
  })
})

describe('calculateBalance — inNegativeSince + daysInNegative', () => {
  it('conta NUNCA negativa: inNegativeSince=null, daysInNegative=0', () => {
    const r = calculateBalance(
      [st('2026-05-01', 1000), st('2026-05-02', -500)],
      0,
      new Date('2026-05-10'),
    )
    expect(r.inNegativeSince).toBeNull()
    expect(r.daysInNegative).toBe(0)
  })

  it('conta entra negativa numa data e fica → inNegativeSince = essa data', () => {
    const r = calculateBalance(
      [st('2026-05-01', 1000), st('2026-05-05', -1500)],
      10_000,
      new Date('2026-05-10T00:00:00Z'),
    )
    expect(r.current).toBe(-500)
    expect(r.inNegativeSince).toEqual(new Date('2026-05-05'))
    expect(r.daysInNegative).toBe(5) // 05 → 10
  })

  it('conta volta a positivo e fica negativa de novo: inNegativeSince RESETA pra ultima run', () => {
    // 01: +1000 → 1000
    // 05: -1500 → -500 (negativa)
    // 10: +800 → 300 (volta positiva — reseta)
    // 20: -500 → -200 (negativa de novo)
    const r = calculateBalance(
      [
        st('2026-05-01', 1000),
        st('2026-05-05', -1500),
        st('2026-05-10', 800),
        st('2026-05-20', -500),
      ],
      10_000,
      new Date('2026-06-01T00:00:00Z'),
    )
    expect(r.current).toBe(-200)
    expect(r.inNegativeSince).toEqual(new Date('2026-05-20')) // reset pra run mais recente
    expect(r.daysInNegative).toBe(12) // 20/mai → 01/jun
  })

  it('conta positiva HOJE mesmo tendo ficado negativa no passado', () => {
    const r = calculateBalance(
      [
        st('2026-05-01', -100),
        st('2026-05-02', 500),
      ],
      1000,
      new Date('2026-05-10'),
    )
    expect(r.current).toBe(400)
    expect(r.inNegativeSince).toBeNull()
    expect(r.daysInNegative).toBe(0)
  })
})

describe('calculateBalance — lowestBalance', () => {
  it('registra pior saldo durante o período', () => {
    const r = calculateBalance(
      [
        st('2026-05-01', 1000),
        st('2026-05-05', -1500),
        st('2026-05-10', 2000), // sobe pra 1500, mas pior já foi -500
      ],
      10_000,
    )
    expect(r.lowestBalance).toBe(-500)
    expect(r.lowestBalanceDate).toEqual(new Date('2026-05-05'))
  })

  it('lowestBalance pode ser 0 se conta nunca for negativa', () => {
    const r = calculateBalance([st('2026-05-01', 1000), st('2026-05-02', 500)], 0)
    expect(r.lowestBalance).toBe(1000) // primeiro running após primeira tx
  })
})

describe('calculateBalance — ordering e edge cases', () => {
  it('ordena por data ASC mesmo se input vier fora de ordem', () => {
    const r = calculateBalance(
      [st('2026-05-10', -300), st('2026-05-01', 1000)],
      0,
    )
    expect(r.current).toBe(700)
  })

  it('creditLimit negativo lança erro', () => {
    expect(() => calculateBalance([], -1)).toThrow(/creditLimit/i)
  })
})
