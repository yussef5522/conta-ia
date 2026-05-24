// Sprint 4.0.1.b — testes das validações Zod de RecurringSchedule.

import { describe, it, expect } from 'vitest'
import {
  recurringScheduleCreateSchema,
  recurringScheduleUpdateSchema,
} from '@/lib/validations/recurrence'

const validBase = {
  companyId: 'cmpgapyt402pg2006sr8ozzz8',
  description: 'Folha mensal',
  amount: 50000,
  type: 'PAYABLE' as const,
  frequency: 'MONTHLY' as const,
  dayOfMonth: 5,
  startDate: '2026-06-01',
}

describe('recurringScheduleCreateSchema', () => {
  it('aceita MONTHLY válido', () => {
    const r = recurringScheduleCreateSchema.parse(validBase)
    expect(r.dayOfMonth).toBe(5)
    expect(r.type).toBe('PAYABLE')
  })

  it('aceita WEEKLY com dayOfWeek', () => {
    const r = recurringScheduleCreateSchema.parse({
      ...validBase,
      frequency: 'WEEKLY',
      dayOfMonth: null,
      dayOfWeek: 1, // segunda
    })
    expect(r.frequency).toBe('WEEKLY')
    expect(r.dayOfWeek).toBe(1)
  })

  it('WEEKLY sem dayOfWeek → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        frequency: 'WEEKLY',
        dayOfMonth: null,
        dayOfWeek: null,
      }),
    ).toThrow()
  })

  it('MONTHLY sem dayOfMonth → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        dayOfMonth: null,
      }),
    ).toThrow()
  })

  it('QUARTERLY sem dayOfMonth → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        frequency: 'QUARTERLY',
        dayOfMonth: null,
      }),
    ).toThrow()
  })

  it('YEARLY sem dayOfMonth → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        frequency: 'YEARLY',
        dayOfMonth: null,
      }),
    ).toThrow()
  })

  it('dayOfMonth fora de range → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({ ...validBase, dayOfMonth: 0 }),
    ).toThrow()
    expect(() =>
      recurringScheduleCreateSchema.parse({ ...validBase, dayOfMonth: 32 }),
    ).toThrow()
  })

  it('dayOfWeek fora de range → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        frequency: 'WEEKLY',
        dayOfMonth: null,
        dayOfWeek: 7,
      }),
    ).toThrow()
  })

  it('amount negativo → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({ ...validBase, amount: -100 }),
    ).toThrow()
  })

  it('endDate < startDate → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        endDate: '2026-05-01', // antes de startDate=2026-06-01
      }),
    ).toThrow()
  })

  it('endDate >= startDate aceito', () => {
    const r = recurringScheduleCreateSchema.parse({
      ...validBase,
      endDate: '2027-06-01',
    })
    expect(r.endDate).toBeInstanceOf(Date)
  })

  it('PAYABLE com customerId → erro semântico', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        customerId: 'cmpgcustomer000000000abcde',
      }),
    ).toThrow()
  })

  it('RECEIVABLE com supplierId → erro semântico', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        type: 'RECEIVABLE',
        supplierId: 'cmpgsupplier000000000abcde',
      }),
    ).toThrow()
  })

  it('frequency inválida → erro', () => {
    expect(() =>
      recurringScheduleCreateSchema.parse({
        ...validBase,
        frequency: 'DAILY' as 'MONTHLY',
      }),
    ).toThrow()
  })
})

describe('recurringScheduleUpdateSchema', () => {
  it('aceita patch parcial (só active)', () => {
    const r = recurringScheduleUpdateSchema.parse({ active: false })
    expect(r.active).toBe(false)
  })

  it('aceita patch parcial (só amount)', () => {
    const r = recurringScheduleUpdateSchema.parse({ amount: 600 })
    expect(r.amount).toBe(600)
  })

  it('aceita endDate=null pra remover', () => {
    const r = recurringScheduleUpdateSchema.parse({ endDate: null })
    expect(r.endDate).toBeNull()
  })

  it('amount negativo no update → erro', () => {
    expect(() =>
      recurringScheduleUpdateSchema.parse({ amount: -10 }),
    ).toThrow()
  })

  it('dayOfMonth fora de range → erro', () => {
    expect(() =>
      recurringScheduleUpdateSchema.parse({ dayOfMonth: 35 }),
    ).toThrow()
  })
})
