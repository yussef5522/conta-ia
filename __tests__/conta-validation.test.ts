// Validação do schema de conta bancária — campos novos do Sprint 0.5 Dia 4
// (allowNegativeBalance, creditLimit, lowBalanceThreshold).

import { describe, it, expect } from 'vitest'
import { contaBancariaSchema } from '@/lib/validations/conta-bancaria'

const BASE = {
  name: 'Banrisul Matriz',
  accountType: 'CHECKING',
}

describe('contaBancariaSchema — campos novos cheque especial', () => {
  it('defaults: allowNegativeBalance=true, creditLimit=0, lowBalanceThreshold=undefined', () => {
    const r = contaBancariaSchema.parse(BASE)
    expect(r.allowNegativeBalance).toBe(true)
    expect(r.creditLimit).toBe(0)
    expect(r.lowBalanceThreshold).toBeUndefined()
  })

  it('aceita allowNegativeBalance=false (conta poupança)', () => {
    const r = contaBancariaSchema.parse({ ...BASE, allowNegativeBalance: false })
    expect(r.allowNegativeBalance).toBe(false)
  })

  it('aceita creditLimit numérico (Banrisul 600k)', () => {
    const r = contaBancariaSchema.parse({ ...BASE, creditLimit: 600_000 })
    expect(r.creditLimit).toBe(600_000)
  })

  it('coerce de string vira number em creditLimit', () => {
    const r = contaBancariaSchema.parse({ ...BASE, creditLimit: '80000' })
    expect(r.creditLimit).toBe(80_000)
  })

  it('rejeita creditLimit negativo', () => {
    expect(() =>
      contaBancariaSchema.parse({ ...BASE, creditLimit: -1 }),
    ).toThrow(/>= 0/)
  })

  it('aceita lowBalanceThreshold null', () => {
    const r = contaBancariaSchema.parse({ ...BASE, lowBalanceThreshold: null })
    expect(r.lowBalanceThreshold).toBeNull()
  })

  it('rejeita lowBalanceThreshold negativo', () => {
    expect(() =>
      contaBancariaSchema.parse({ ...BASE, lowBalanceThreshold: -5 }),
    ).toThrow(/>= 0/)
  })
})
