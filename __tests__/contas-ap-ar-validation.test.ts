// Sprint 4.0.1.a — testes das validações Zod de Contas a Pagar/Receber + Customer.

import { describe, it, expect } from 'vitest'
import {
  customerSchema,
  contaAPagarCreateSchema,
  contaAReceberCreateSchema,
  efetivarSchema,
} from '@/lib/validations/contas-ap-ar'

describe('customerSchema', () => {
  it('aceita customer mínimo (só razaoSocial)', () => {
    const r = customerSchema.parse({ razaoSocial: 'CLIENTE TESTE LTDA' })
    expect(r.razaoSocial).toBe('CLIENTE TESTE LTDA')
  })

  it('aceita customer completo', () => {
    const r = customerSchema.parse({
      razaoSocial: 'CLIENTE LTDA',
      nomeFantasia: 'Cliente Fake',
      cnpj: '12345678000199',
      email: 'contato@cliente.com',
      phone: '11999998888',
      notes: 'Cliente VIP',
    })
    expect(r.cnpj).toBe('12345678000199')
    expect(r.email).toBe('contato@cliente.com')
  })

  it('CNPJ malformado → erro Zod', () => {
    expect(() => customerSchema.parse({ razaoSocial: 'X', cnpj: '12.345' })).toThrow()
    expect(() => customerSchema.parse({ razaoSocial: 'X', cnpj: 'abc' })).toThrow()
  })

  it('CPF 11 dígitos aceito', () => {
    const r = customerSchema.parse({ razaoSocial: 'PF Cliente', cpf: '12345678901' })
    expect(r.cpf).toBe('12345678901')
  })

  it('email inválido → erro', () => {
    expect(() => customerSchema.parse({ razaoSocial: 'X', email: 'not-an-email' })).toThrow()
  })

  it('razaoSocial vazia → erro', () => {
    expect(() => customerSchema.parse({ razaoSocial: '' })).toThrow()
  })

  it('razaoSocial >200 chars → erro', () => {
    expect(() => customerSchema.parse({ razaoSocial: 'a'.repeat(201) })).toThrow()
  })
})

describe('contaAPagarCreateSchema', () => {
  const validBase = {
    companyId: 'cmpgapyt402pg2006sr8ozzz8',
    description: 'Conta de luz ENERGISA',
    amount: 380.50,
    dueDate: '2026-06-10',
  }

  it('aceita conta mínima', () => {
    const r = contaAPagarCreateSchema.parse(validBase)
    expect(r.description).toBe('Conta de luz ENERGISA')
    expect(r.amount).toBe(380.50)
    expect(r.dueDate).toBeInstanceOf(Date)
  })

  it('amount negativo → erro', () => {
    expect(() => contaAPagarCreateSchema.parse({ ...validBase, amount: -10 })).toThrow()
  })

  it('amount zero → erro (positive)', () => {
    expect(() => contaAPagarCreateSchema.parse({ ...validBase, amount: 0 })).toThrow()
  })

  it('descrição vazia → erro', () => {
    expect(() => contaAPagarCreateSchema.parse({ ...validBase, description: '' })).toThrow()
  })

  it('descrição >255 chars → erro', () => {
    expect(() =>
      contaAPagarCreateSchema.parse({ ...validBase, description: 'a'.repeat(256) }),
    ).toThrow()
  })

  it('companyId inválido (não cuid) → erro', () => {
    expect(() => contaAPagarCreateSchema.parse({ ...validBase, companyId: 'short' })).toThrow()
  })

  it('aceita supplierId opcional', () => {
    const r = contaAPagarCreateSchema.parse({
      ...validBase,
      supplierId: 'cmpgbcoa2034g2006x8zj09dt',
    })
    expect(r.supplierId).toBe('cmpgbcoa2034g2006x8zj09dt')
  })

  it('competenceDate opcional', () => {
    const r = contaAPagarCreateSchema.parse({
      ...validBase,
      competenceDate: '2026-05-15',
    })
    expect(r.competenceDate).toBeInstanceOf(Date)
  })

  it('bankAccountId opcional (PAYABLE sem conta definida)', () => {
    const r = contaAPagarCreateSchema.parse({ ...validBase, bankAccountId: null })
    expect(r.bankAccountId).toBeNull()
  })

  it('dueDate ISO string coerce pra Date', () => {
    const r = contaAPagarCreateSchema.parse({ ...validBase, dueDate: '2026-06-10T15:30:00Z' })
    expect(r.dueDate).toBeInstanceOf(Date)
    expect(r.dueDate.toISOString()).toBe('2026-06-10T15:30:00.000Z')
  })
})

describe('contaAReceberCreateSchema', () => {
  const validBase = {
    companyId: 'cmpgapyt402pg2006sr8ozzz8',
    description: 'Mensalidade aluno X',
    amount: 250,
    dueDate: '2026-06-05',
  }

  it('aceita receita mínima', () => {
    const r = contaAReceberCreateSchema.parse(validBase)
    expect(r.description).toBe('Mensalidade aluno X')
  })

  it('aceita customerId opcional', () => {
    const r = contaAReceberCreateSchema.parse({
      ...validBase,
      customerId: 'cmpgcustomer000000000abcde',
    })
    expect(r.customerId).toBe('cmpgcustomer000000000abcde')
  })

  it('NÃO tem campo supplierId no schema (RECEIVABLE usa customer)', () => {
    // Zod sem strict() ignora props extras, mas o tipo não inclui supplierId
    const r = contaAReceberCreateSchema.parse(validBase)
    // @ts-expect-error supplierId não faz parte do tipo
    expect(r.supplierId).toBeUndefined()
  })
})

describe('efetivarSchema', () => {
  it('aceita payload válido', () => {
    const r = efetivarSchema.parse({
      paymentDate: '2026-06-10',
      bankAccountId: 'cmpgbankaccount000000abcde',
    })
    expect(r.paymentDate).toBeInstanceOf(Date)
    expect(r.bankAccountId).toBe('cmpgbankaccount000000abcde')
  })

  it('bankAccountId obrigatório', () => {
    expect(() => efetivarSchema.parse({ paymentDate: '2026-06-10' })).toThrow()
  })

  it('paymentDate obrigatório', () => {
    expect(() => efetivarSchema.parse({ bankAccountId: 'cmpgbankaccount000000abcde' }))
      .toThrow()
  })

  it('paymentDate ISO aceito', () => {
    const r = efetivarSchema.parse({
      paymentDate: '2026-06-10T14:30:00Z',
      bankAccountId: 'cmpgbankaccount000000abcde',
    })
    expect(r.paymentDate.toISOString()).toBe('2026-06-10T14:30:00.000Z')
  })
})
