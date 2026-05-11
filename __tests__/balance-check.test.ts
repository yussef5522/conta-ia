import { describe, it, expect } from 'vitest'
import { checkBalance, BalanceCheckError } from '@/lib/balance/check'

describe('checkBalance — cenários REAIS do Yussef (Sprint 0.5 Dia 3)', () => {
  it('Banrisul creditLimit=600k, saldo=-550k, despesa=30k → ALLOWED (-580k dentro de -600k)', () => {
    const r = checkBalance({
      currentBalance: -550_000,
      allowNegativeBalance: true,
      creditLimit: 600_000,
      amountChange: -30_000,
      accountName: 'Banrisul',
    })
    expect(r.allowed).toBe(true)
    expect(r.projectedBalance).toBe(-580_000)
    expect(r.effectiveFloor).toBe(-600_000)
    expect(r.reason).toBeUndefined()
  })

  it('Banrisul creditLimit=600k, saldo=-550k, despesa=100k → BLOQUEADO (-650k estoura -600k)', () => {
    const r = checkBalance({
      currentBalance: -550_000,
      allowNegativeBalance: true,
      creditLimit: 600_000,
      amountChange: -100_000,
      accountName: 'Banrisul',
    })
    expect(r.allowed).toBe(false)
    expect(r.projectedBalance).toBe(-650_000)
    expect(r.effectiveFloor).toBe(-600_000)
    expect(r.reason).toContain('Banrisul')
    expect(r.reason).toContain('cheque especial')
  })

  it('Sicredi creditLimit=80k, saldo=-70k, despesa=20k → BLOQUEADO (-90k estoura -80k)', () => {
    const r = checkBalance({
      currentBalance: -70_000,
      allowNegativeBalance: true,
      creditLimit: 80_000,
      amountChange: -20_000,
      accountName: 'Sicredi',
    })
    expect(r.allowed).toBe(false)
    expect(r.projectedBalance).toBe(-90_000)
    expect(r.effectiveFloor).toBe(-80_000)
    expect(r.reason).toContain('Sicredi')
  })

  it('Poupança allowNegativeBalance=false, saldo=100, despesa=200 → BLOQUEADO (-100 não permitido)', () => {
    const r = checkBalance({
      currentBalance: 100,
      allowNegativeBalance: false,
      creditLimit: 0,
      amountChange: -200,
      accountName: 'Poupança Caixa',
    })
    expect(r.allowed).toBe(false)
    expect(r.projectedBalance).toBe(-100)
    expect(r.effectiveFloor).toBe(0)
    expect(r.reason).toContain('Poupança Caixa')
    expect(r.reason).toContain('não permite saldo negativo')
  })

  it('Conta nova creditLimit=0 mas allowNegativeBalance=true, saldo=50, despesa=100 → BLOQUEADO', () => {
    const r = checkBalance({
      currentBalance: 50,
      allowNegativeBalance: true,
      creditLimit: 0,
      amountChange: -100,
    })
    expect(r.allowed).toBe(false)
    expect(r.effectiveFloor).toBe(0)
  })
})

describe('checkBalance — entradas (CREDIT) sempre passam', () => {
  it('CREDIT 1000 em conta com saldo zero → ALLOWED', () => {
    const r = checkBalance({
      currentBalance: 0,
      allowNegativeBalance: false,
      creditLimit: 0,
      amountChange: 1000,
    })
    expect(r.allowed).toBe(true)
    expect(r.projectedBalance).toBe(1000)
  })

  it('CREDIT 5000 em conta MUITO negativa (-600k) → ALLOWED (não piora)', () => {
    const r = checkBalance({
      currentBalance: -600_000,
      allowNegativeBalance: true,
      creditLimit: 600_000,
      amountChange: 5000,
    })
    expect(r.allowed).toBe(true)
    expect(r.projectedBalance).toBe(-595_000)
  })
})

describe('checkBalance — edge cases', () => {
  it('exatamente NO LIMITE: saldo=-600k + despesa=0 → ALLOWED (>= floor)', () => {
    const r = checkBalance({
      currentBalance: -600_000,
      allowNegativeBalance: true,
      creditLimit: 600_000,
      amountChange: 0,
    })
    expect(r.allowed).toBe(true)
  })

  it('exatamente NO LIMITE com despesa que pousa em -600k → ALLOWED', () => {
    const r = checkBalance({
      currentBalance: -595_000,
      allowNegativeBalance: true,
      creditLimit: 600_000,
      amountChange: -5_000,
    })
    expect(r.allowed).toBe(true)
    expect(r.projectedBalance).toBe(-600_000)
  })

  it('1 centavo abaixo do limite → BLOQUEADO', () => {
    const r = checkBalance({
      currentBalance: -595_000,
      allowNegativeBalance: true,
      creditLimit: 600_000,
      amountChange: -5_000.01,
    })
    expect(r.allowed).toBe(false)
  })

  it('creditLimit negativo lança erro (input inválido)', () => {
    expect(() =>
      checkBalance({
        currentBalance: 0,
        allowNegativeBalance: true,
        creditLimit: -1,
        amountChange: 0,
      }),
    ).toThrow(/creditLimit/i)
  })

  it('mensagem sem accountName usa fallback "conta"', () => {
    const r = checkBalance({
      currentBalance: 0,
      allowNegativeBalance: false,
      creditLimit: 0,
      amountChange: -100,
    })
    expect(r.reason).toContain('conta')
  })
})

describe('BalanceCheckError', () => {
  it('tem status 422', () => {
    const err = new BalanceCheckError({
      allowed: false,
      reason: 'Saldo insuficiente',
      projectedBalance: -100,
      effectiveFloor: 0,
    })
    expect(err.status).toBe(422)
  })

  it('preserva o result completo pra rota retornar', () => {
    const result = {
      allowed: false,
      reason: 'Limite estourado',
      projectedBalance: -650_000,
      effectiveFloor: -600_000,
    }
    const err = new BalanceCheckError(result)
    expect(err.result).toEqual(result)
    expect(err.message).toBe('Limite estourado')
  })

  it('name é BalanceCheckError', () => {
    const err = new BalanceCheckError({
      allowed: false,
      projectedBalance: 0,
      effectiveFloor: 0,
    })
    expect(err.name).toBe('BalanceCheckError')
  })
})
