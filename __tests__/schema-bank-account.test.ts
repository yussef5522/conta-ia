import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'

// Sprint 0.5 Dia 1 — valida os 3 campos novos em BankAccount pra cheque
// especial / saldo negativo. Testes contra DMMF (sem DB).
const bankAccountModel = Prisma.dmmf.datamodel.models.find(
  (m) => m.name === 'BankAccount'
)!

describe('BankAccount.allowNegativeBalance (Sprint 0.5)', () => {
  const field = () =>
    bankAccountModel.fields.find((f) => f.name === 'allowNegativeBalance')

  it('campo existe', () => {
    expect(field()).toBeDefined()
  })

  it('é Boolean obrigatório com default true', () => {
    const f = field()!
    expect(f.type).toBe('Boolean')
    expect(f.isRequired).toBe(true)
    expect(f.hasDefaultValue).toBe(true)
    expect(f.default).toBe(true)
  })
})

describe('BankAccount.creditLimit (Sprint 0.5)', () => {
  const field = () =>
    bankAccountModel.fields.find((f) => f.name === 'creditLimit')

  it('campo existe', () => {
    expect(field()).toBeDefined()
  })

  it('é Float obrigatório com default 0', () => {
    const f = field()!
    expect(f.type).toBe('Float')
    expect(f.isRequired).toBe(true)
    expect(f.hasDefaultValue).toBe(true)
    expect(f.default).toBe(0)
  })
})

describe('BankAccount.lowBalanceThreshold (Sprint 0.5)', () => {
  const field = () =>
    bankAccountModel.fields.find((f) => f.name === 'lowBalanceThreshold')

  it('campo existe', () => {
    expect(field()).toBeDefined()
  })

  it('é Float opcional sem default', () => {
    const f = field()!
    expect(f.type).toBe('Float')
    expect(f.isRequired).toBe(false)
    expect(f.hasDefaultValue).toBe(false)
  })
})
