import { describe, it, expect } from 'vitest'
import {
  transferCreateSchema,
  assertSameCompany,
  TransferValidationError,
} from '@/lib/transfers/validate'

const FROM = 'ckl11111111111111111111111'
const TO = 'ckl22222222222222222222222'

describe('transferCreateSchema (Sprint 0.5 Dia 2)', () => {
  it('aceita input válido', () => {
    const r = transferCreateSchema.parse({
      fromAccountId: FROM,
      toAccountId: TO,
      amount: 1000,
      date: '2026-05-11',
    })
    expect(r.amount).toBe(1000)
    expect(r.date).toBeInstanceOf(Date)
  })

  it('rejeita amount zero', () => {
    expect(() =>
      transferCreateSchema.parse({
        fromAccountId: FROM,
        toAccountId: TO,
        amount: 0,
        date: '2026-05-11',
      }),
    ).toThrow(/positivo/i)
  })

  it('rejeita amount negativo', () => {
    expect(() =>
      transferCreateSchema.parse({
        fromAccountId: FROM,
        toAccountId: TO,
        amount: -500,
        date: '2026-05-11',
      }),
    ).toThrow(/positivo/i)
  })

  it('rejeita mesma conta origem=destino', () => {
    expect(() =>
      transferCreateSchema.parse({
        fromAccountId: FROM,
        toAccountId: FROM,
        amount: 100,
        date: '2026-05-11',
      }),
    ).toThrow(/diferentes/i)
  })

  it('rejeita data inválida', () => {
    expect(() =>
      transferCreateSchema.parse({
        fromAccountId: FROM,
        toAccountId: TO,
        amount: 100,
        date: 'not-a-date',
      }),
    ).toThrow()
  })

  it('coerce amount string em number', () => {
    const r = transferCreateSchema.parse({
      fromAccountId: FROM,
      toAccountId: TO,
      amount: '500.25',
      date: '2026-05-11',
    })
    expect(r.amount).toBe(500.25)
  })

  it('description e notes são opcionais', () => {
    const r = transferCreateSchema.parse({
      fromAccountId: FROM,
      toAccountId: TO,
      amount: 100,
      date: '2026-05-11',
    })
    expect(r.description).toBeUndefined()
    expect(r.notes).toBeUndefined()
  })

  it('rejeita description vazia', () => {
    expect(() =>
      transferCreateSchema.parse({
        fromAccountId: FROM,
        toAccountId: TO,
        amount: 100,
        date: '2026-05-11',
        description: '',
      }),
    ).toThrow()
  })
})

describe('assertSameCompany (Sprint 0.5 Dia 2)', () => {
  it('passa quando contas são da mesma empresa', () => {
    expect(() =>
      assertSameCompany({ companyId: 'c1' }, { companyId: 'c1' }),
    ).not.toThrow()
  })

  it('lança TransferValidationError quando empresas diferentes', () => {
    expect(() =>
      assertSameCompany({ companyId: 'c1' }, { companyId: 'c2' }),
    ).toThrow(TransferValidationError)
    expect(() =>
      assertSameCompany({ companyId: 'c1' }, { companyId: 'c2' }),
    ).toThrow(/mesma empresa/i)
  })

  it('lança quando fromAccount é null (não encontrada)', () => {
    expect(() => assertSameCompany(null, { companyId: 'c1' })).toThrow(/origem/i)
  })

  it('lança quando toAccount é null (não encontrada)', () => {
    expect(() => assertSameCompany({ companyId: 'c1' }, null)).toThrow(/destino/i)
  })

  it('TransferValidationError tem status 400', () => {
    try {
      assertSameCompany({ companyId: 'c1' }, { companyId: 'c2' })
    } catch (e) {
      expect((e as TransferValidationError).status).toBe(400)
    }
  })
})
