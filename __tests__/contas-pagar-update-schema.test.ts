// Sprint 5.0.3.0a-fix — Tests do contaAPagarUpdateSchema (Zod).
// Garante que PATCH aceita partial + coerce + valida campos críticos.

import { describe, it, expect } from 'vitest'
import { contaAPagarUpdateSchema } from '@/lib/validations/contas-ap-ar'

describe('contaAPagarUpdateSchema', () => {
  it('aceita body vazio (partial update — nada a mudar)', () => {
    expect(() => contaAPagarUpdateSchema.parse({})).not.toThrow()
  })

  it('description min 1 char (vazia rejeitada)', () => {
    expect(() => contaAPagarUpdateSchema.parse({ description: '' })).toThrow()
    expect(() =>
      contaAPagarUpdateSchema.parse({ description: 'Aluguel março' }),
    ).not.toThrow()
  })

  it('amount positive (negativo/zero rejeitados)', () => {
    expect(() => contaAPagarUpdateSchema.parse({ amount: -10 })).toThrow()
    expect(() => contaAPagarUpdateSchema.parse({ amount: 0 })).toThrow()
    expect(() =>
      contaAPagarUpdateSchema.parse({ amount: 0.01 }),
    ).not.toThrow()
  })

  it('amount coerce string → number (input numérico via formulário)', () => {
    const parsed = contaAPagarUpdateSchema.parse({ amount: '99.50' })
    expect(parsed.amount).toBe(99.5)
  })

  it('dueDate coerce string ISO → Date', () => {
    const parsed = contaAPagarUpdateSchema.parse({ dueDate: '2026-06-15' })
    expect(parsed.dueDate).toBeInstanceOf(Date)
    expect(parsed.dueDate?.getUTCFullYear()).toBe(2026)
  })

  it('paymentDate aceita NULL pra desmarcar', () => {
    const parsed = contaAPagarUpdateSchema.parse({ paymentDate: null })
    expect(parsed.paymentDate).toBeNull()
  })

  it('paymentDate coerce ISO string → Date', () => {
    const parsed = contaAPagarUpdateSchema.parse({
      paymentDate: '2026-05-27',
    })
    expect(parsed.paymentDate).toBeInstanceOf(Date)
  })

  it('categoryId aceita CUID válido OU null', () => {
    expect(() =>
      contaAPagarUpdateSchema.parse({ categoryId: 'cmpvalidcuid000000000abc' }),
    ).not.toThrow()
    expect(() =>
      contaAPagarUpdateSchema.parse({ categoryId: null }),
    ).not.toThrow()
  })

  it('categoryId rejeita string não-CUID', () => {
    expect(() =>
      contaAPagarUpdateSchema.parse({ categoryId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('notes aceita null (limpa)', () => {
    expect(() =>
      contaAPagarUpdateSchema.parse({ notes: null }),
    ).not.toThrow()
  })

  it('notes max 1000 chars', () => {
    const long = 'a'.repeat(1001)
    expect(() => contaAPagarUpdateSchema.parse({ notes: long })).toThrow()
    const ok = 'a'.repeat(1000)
    expect(() => contaAPagarUpdateSchema.parse({ notes: ok })).not.toThrow()
  })

  it('all fields together (cenário "Salvar" do dialog)', () => {
    const parsed = contaAPagarUpdateSchema.parse({
      description: 'Aluguel março',
      amount: '1500.00',
      dueDate: '2026-03-05',
      paymentDate: '2026-03-04',
      notes: 'pago via Pix',
    })
    expect(parsed.description).toBe('Aluguel março')
    expect(parsed.amount).toBe(1500)
    expect(parsed.dueDate).toBeInstanceOf(Date)
    expect(parsed.paymentDate).toBeInstanceOf(Date)
    expect(parsed.notes).toBe('pago via Pix')
  })
})
