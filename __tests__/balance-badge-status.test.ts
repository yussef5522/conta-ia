import { describe, it, expect } from 'vitest'
import { computeBalanceBadgeStatus } from '@/lib/balance/badge-status'

describe('computeBalanceBadgeStatus — saldo NEGATIVO com cheque especial', () => {
  it('Banrisul: usou 90% do limite → vermelho com percentColor=red', () => {
    const r = computeBalanceBadgeStatus({
      balance: -540_000,
      creditLimit: 600_000,
      lowBalanceThreshold: null,
    })
    expect(r.variant).toBe('red')
    expect(r.label).toBe('Saldo negativo')
    expect(r.usagePercent).toBe(90)
    expect(r.percentColor).toBe('red') // > 80%
    expect(r.subtext).toContain('540')
    expect(r.subtext).toContain('600')
    expect(r.subtext).toContain('90%')
  })

  it('Sicredi: usou 70% do limite → vermelho com percentColor=yellow (50-80%)', () => {
    const r = computeBalanceBadgeStatus({
      balance: -56_000,
      creditLimit: 80_000,
      lowBalanceThreshold: null,
    })
    expect(r.variant).toBe('red')
    expect(r.usagePercent).toBe(70)
    expect(r.percentColor).toBe('yellow')
  })

  it('Conta usou 30% do limite → vermelho com percentColor=green (≤50%)', () => {
    const r = computeBalanceBadgeStatus({
      balance: -3_000,
      creditLimit: 10_000,
      lowBalanceThreshold: null,
    })
    expect(r.variant).toBe('red')
    expect(r.usagePercent).toBe(30)
    expect(r.percentColor).toBe('green')
  })

  it('limite usado em 50% exato → percentColor=green (borda ≤50)', () => {
    const r = computeBalanceBadgeStatus({
      balance: -5_000,
      creditLimit: 10_000,
      lowBalanceThreshold: null,
    })
    expect(r.usagePercent).toBe(50)
    expect(r.percentColor).toBe('green')
  })

  it('limite usado em 80% exato → percentColor=yellow (borda)', () => {
    const r = computeBalanceBadgeStatus({
      balance: -8_000,
      creditLimit: 10_000,
      lowBalanceThreshold: null,
    })
    expect(r.usagePercent).toBe(80)
    expect(r.percentColor).toBe('yellow')
  })

  it('limite usado em 100% (no limite) → percentColor=red', () => {
    const r = computeBalanceBadgeStatus({
      balance: -10_000,
      creditLimit: 10_000,
      lowBalanceThreshold: null,
    })
    expect(r.usagePercent).toBe(100)
    expect(r.percentColor).toBe('red')
  })
})

describe('computeBalanceBadgeStatus — saldo NEGATIVO sem cheque especial', () => {
  it('creditLimit=0: vermelho, subtext sem porcentagem', () => {
    const r = computeBalanceBadgeStatus({
      balance: -500,
      creditLimit: 0,
      lowBalanceThreshold: null,
    })
    expect(r.variant).toBe('red')
    expect(r.usagePercent).toBeNull()
    expect(r.percentColor).toBeNull()
    expect(r.subtext).toContain('-')
    expect(r.subtext).toContain('500')
  })
})

describe('computeBalanceBadgeStatus — saldo POSITIVO', () => {
  it('positivo confortável (sem threshold) → verde', () => {
    const r = computeBalanceBadgeStatus({
      balance: 50_000,
      creditLimit: 600_000,
      lowBalanceThreshold: null,
    })
    expect(r.variant).toBe('green')
    expect(r.label).toBe('Normal')
    expect(r.subtext).toContain('50.000')
  })

  it('positivo MUITO acima do threshold → verde', () => {
    const r = computeBalanceBadgeStatus({
      balance: 50_000,
      creditLimit: 0,
      lowBalanceThreshold: 5_000,
    })
    expect(r.variant).toBe('green')
  })

  it('positivo mas ≤ threshold → amarelo "Atenção"', () => {
    const r = computeBalanceBadgeStatus({
      balance: 3_000,
      creditLimit: 0,
      lowBalanceThreshold: 5_000,
    })
    expect(r.variant).toBe('yellow')
    expect(r.label).toBe('Atenção')
    expect(r.subtext).toContain('Saldo baixo')
    expect(r.subtext).toContain('3.000')
  })

  it('positivo exatamente IGUAL ao threshold → amarelo', () => {
    const r = computeBalanceBadgeStatus({
      balance: 5_000,
      creditLimit: 0,
      lowBalanceThreshold: 5_000,
    })
    expect(r.variant).toBe('yellow')
  })

  it('positivo com threshold=0 (desabilitado) → verde mesmo', () => {
    const r = computeBalanceBadgeStatus({
      balance: 100,
      creditLimit: 0,
      lowBalanceThreshold: 0,
    })
    expect(r.variant).toBe('green')
  })

  it('saldo zero → verde "Normal" (não vira atenção)', () => {
    const r = computeBalanceBadgeStatus({
      balance: 0,
      creditLimit: 0,
      lowBalanceThreshold: null,
    })
    expect(r.variant).toBe('green')
    expect(r.subtext).toContain('0,00')
  })
})

describe('computeBalanceBadgeStatus — edge cases', () => {
  it('creditLimit negativo LANÇA', () => {
    expect(() =>
      computeBalanceBadgeStatus({
        balance: 0,
        creditLimit: -1,
        lowBalanceThreshold: null,
      }),
    ).toThrow(/creditLimit/i)
  })

  it('subtext em vermelho NÃO tem porcentagem quando creditLimit=0', () => {
    const r = computeBalanceBadgeStatus({
      balance: -100,
      creditLimit: 0,
      lowBalanceThreshold: null,
    })
    expect(r.subtext).not.toMatch(/\d%/)
  })
})
