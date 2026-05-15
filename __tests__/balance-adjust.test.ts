import { describe, it, expect } from 'vitest'
import { buildBalanceAdjustment } from '@/lib/balance/adjust'

describe('buildBalanceAdjustment — Sprint 1.5', () => {
  it('ajuste positivo: saldo sobe → CREDIT', () => {
    const r = buildBalanceAdjustment({ currentBalance: 1000, targetBalance: 1500 })
    expect(r.needed).toBe(true)
    expect(r.difference).toBe(500)
    expect(r.type).toBe('CREDIT')
    expect(r.amount).toBe(500)
    expect(r.balanceDelta).toBe(500)
  })

  it('ajuste negativo: saldo desce → DEBIT', () => {
    const r = buildBalanceAdjustment({ currentBalance: 1000, targetBalance: 200 })
    expect(r.needed).toBe(true)
    expect(r.difference).toBe(-800)
    expect(r.type).toBe('DEBIT')
    expect(r.amount).toBe(800)
    expect(r.balanceDelta).toBe(-800)
  })

  it('saldo já correto → needed=false, sem ajuste', () => {
    const r = buildBalanceAdjustment({ currentBalance: 1000, targetBalance: 1000 })
    expect(r.needed).toBe(false)
    expect(r.difference).toBe(0)
    expect(r.amount).toBe(0)
    expect(r.balanceDelta).toBe(0)
  })

  it('diferença menor que 1 centavo → tratada como zero (ruído de Float)', () => {
    const r = buildBalanceAdjustment({
      currentBalance: 5821.079999999997,
      targetBalance: 5821.08,
    })
    expect(r.needed).toBe(false)
  })

  it('CENÁRIO REAL Cacula Mix: saldo 5.821,08 → -444.178,92 = DEBIT 450.000', () => {
    // Banrisul era -450k antes do OFX. Sistema mostra só os movimentos (5.821,08).
    // Saldo correto hoje = -450.000 + 5.821,08 = -444.178,92
    const r = buildBalanceAdjustment({
      currentBalance: 5821.08,
      targetBalance: -444178.92,
    })
    expect(r.needed).toBe(true)
    expect(r.type).toBe('DEBIT')
    expect(r.amount).toBe(450000)
    expect(r.balanceDelta).toBe(-450000)
    // Aplicar o delta leva ao targetBalance
    expect(roundCents(5821.08 + r.balanceDelta)).toBe(-444178.92)
  })

  it('CENÁRIO REAL STONE: saldo 1.260,47 → -68.739,53 = DEBIT 70.000', () => {
    const r = buildBalanceAdjustment({
      currentBalance: 1260.47,
      targetBalance: -68739.53,
    })
    expect(r.needed).toBe(true)
    expect(r.type).toBe('DEBIT')
    expect(r.amount).toBe(70000)
    expect(roundCents(1260.47 + r.balanceDelta)).toBe(-68739.53)
  })

  it('ajuste de saldo negativo PRA saldo positivo: -5000 → 3000 = CREDIT 8000', () => {
    const r = buildBalanceAdjustment({ currentBalance: -5000, targetBalance: 3000 })
    expect(r.type).toBe('CREDIT')
    expect(r.amount).toBe(8000)
    expect(r.balanceDelta).toBe(8000)
  })

  it('ajuste de zero pra negativo: 0 → -450000 = DEBIT 450000', () => {
    // Caso clássico: conta criada com saldo 0, era -450k de cheque especial
    const r = buildBalanceAdjustment({ currentBalance: 0, targetBalance: -450000 })
    expect(r.type).toBe('DEBIT')
    expect(r.amount).toBe(450000)
  })

  it('arredonda centavos: 100.005 - 0 → 100.01 (não 100.005)', () => {
    const r = buildBalanceAdjustment({ currentBalance: 0, targetBalance: 100.005 })
    expect(r.difference).toBe(100.01)
    expect(r.amount).toBe(100.01)
  })

  it('balanceDelta sempre leva currentBalance ao targetBalance exato', () => {
    const cases = [
      { currentBalance: 1234.56, targetBalance: 7890.12 },
      { currentBalance: -1000, targetBalance: -2500.75 },
      { currentBalance: 0, targetBalance: 999999.99 },
    ]
    for (const c of cases) {
      const r = buildBalanceAdjustment(c)
      expect(roundCents(c.currentBalance + r.balanceDelta)).toBe(
        roundCents(c.targetBalance),
      )
    }
  })
})

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}
