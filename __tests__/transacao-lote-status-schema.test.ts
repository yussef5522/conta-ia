// Sprint 3.0.3 B2 — schema bulk status.

import { describe, it, expect } from 'vitest'
import { transacaoLoteStatusSchema } from '@/lib/validations/transacao-lote'

const CUID = 'cmpgbcodw038v2006nmamdu5t'

describe('transacaoLoteStatusSchema', () => {
  it('aceita RECONCILED com 1 id', () => {
    const r = transacaoLoteStatusSchema.safeParse({
      transactionIds: [CUID],
      status: 'RECONCILED',
    })
    expect(r.success).toBe(true)
  })

  it('aceita IGNORED + PENDING', () => {
    expect(
      transacaoLoteStatusSchema.safeParse({
        transactionIds: [CUID],
        status: 'IGNORED',
      }).success,
    ).toBe(true)
    expect(
      transacaoLoteStatusSchema.safeParse({
        transactionIds: [CUID],
        status: 'PENDING',
      }).success,
    ).toBe(true)
  })

  it('REJEITA status inválido', () => {
    expect(
      transacaoLoteStatusSchema.safeParse({
        transactionIds: [CUID],
        status: 'DRAFT',
      }).success,
    ).toBe(false)
  })

  it('REJEITA array vazio', () => {
    expect(
      transacaoLoteStatusSchema.safeParse({
        transactionIds: [],
        status: 'IGNORED',
      }).success,
    ).toBe(false)
  })

  it('REJEITA cuid inválido', () => {
    expect(
      transacaoLoteStatusSchema.safeParse({
        transactionIds: ['not-a-cuid'],
        status: 'IGNORED',
      }).success,
    ).toBe(false)
  })

  it('REJEITA mais que 500', () => {
    const ids = Array(501).fill(CUID)
    expect(
      transacaoLoteStatusSchema.safeParse({
        transactionIds: ids,
        status: 'IGNORED',
      }).success,
    ).toBe(false)
  })
})
