// Sprint 5.0.3.0b — Tests do bulk action guard + Zod schema.

import { describe, it, expect } from 'vitest'
import {
  validateBulkMarkPaid,
  blockedMessage,
  bulkActionSchema,
} from '@/lib/contas-pagar/bulk-actions'

describe('validateBulkMarkPaid', () => {
  it('todas pendentes (sem banco) → allowed = todas, blocked = []', () => {
    const result = validateBulkMarkPaid([
      { id: 'a', bankAccountId: null, paymentDate: null },
      { id: 'b', bankAccountId: null, paymentDate: null },
      { id: 'c', bankAccountId: null, paymentDate: '2026-01-01' }, // paid sem banco — OK marcar paga de novo
    ])
    expect(result.allowed).toEqual(['a', 'b', 'c'])
    expect(result.blocked).toEqual([])
  })

  it('uma efetivada (banco + paymentDate) → blocked = essa', () => {
    const result = validateBulkMarkPaid([
      { id: 'a', bankAccountId: null, paymentDate: null },
      { id: 'b', bankAccountId: 'bank1', paymentDate: '2026-03-15' },
      { id: 'c', bankAccountId: null, paymentDate: null },
    ])
    expect(result.allowed).toEqual(['a', 'c'])
    expect(result.blocked).toEqual(['b'])
  })

  it('banco preenchido mas SEM paymentDate (PAYABLE só com banco-alvo) → allowed', () => {
    // bankAccountId preenchido mas não foi paga ainda — pode marcar paga
    const result = validateBulkMarkPaid([
      { id: 'a', bankAccountId: 'bank1', paymentDate: null },
    ])
    expect(result.allowed).toEqual(['a'])
    expect(result.blocked).toEqual([])
  })

  it('paymentDate preenchida mas SEM banco → allowed (não foi efetivada com saldo)', () => {
    const result = validateBulkMarkPaid([
      { id: 'a', bankAccountId: null, paymentDate: '2026-03-15' },
    ])
    expect(result.allowed).toEqual(['a'])
    expect(result.blocked).toEqual([])
  })

  it('lista vazia → ambos vazios', () => {
    const result = validateBulkMarkPaid([])
    expect(result.allowed).toEqual([])
    expect(result.blocked).toEqual([])
  })

  it('todas efetivadas → all blocked', () => {
    const result = validateBulkMarkPaid([
      { id: 'a', bankAccountId: 'b1', paymentDate: '2026-01-01' },
      { id: 'b', bankAccountId: 'b1', paymentDate: '2026-01-02' },
    ])
    expect(result.allowed).toEqual([])
    expect(result.blocked).toEqual(['a', 'b'])
  })
})

describe('blockedMessage', () => {
  it('0 blocked → vazio', () => {
    expect(blockedMessage(0, 10)).toBe('')
  })

  it('1 de 3 blocked → mensagem parcial', () => {
    expect(blockedMessage(1, 3)).toContain('1 de 3')
    expect(blockedMessage(1, 3)).toContain('Desmarque')
  })

  it('todas blocked → mensagem total', () => {
    expect(blockedMessage(3, 3)).toContain('Todas as 3')
    expect(blockedMessage(3, 3)).toContain('Desfazer efetivação')
  })
})

describe('bulkActionSchema (Zod)', () => {
  it('mark_paid: aceita body válido', () => {
    expect(() =>
      bulkActionSchema.parse({
        action: 'mark_paid',
        transactionIds: ['cmpvalidcuid000000000abc'],
        paymentDate: '2026-05-27',
      }),
    ).not.toThrow()
  })

  it('mark_paid coerce date string → Date', () => {
    const parsed = bulkActionSchema.parse({
      action: 'mark_paid',
      transactionIds: ['cmpvalidcuid000000000abc'],
      paymentDate: '2026-05-27',
    })
    if (parsed.action === 'mark_paid') {
      expect(parsed.paymentDate).toBeInstanceOf(Date)
    }
  })

  it('delete: NÃO exige paymentDate', () => {
    expect(() =>
      bulkActionSchema.parse({
        action: 'delete',
        transactionIds: ['cmpvalidcuid000000000abc'],
      }),
    ).not.toThrow()
  })

  it('rejeita action inválida', () => {
    expect(() =>
      bulkActionSchema.parse({
        action: 'foo',
        transactionIds: ['cmpvalidcuid000000000abc'],
      }),
    ).toThrow()
  })

  it('rejeita transactionIds vazia', () => {
    expect(() =>
      bulkActionSchema.parse({
        action: 'delete',
        transactionIds: [],
      }),
    ).toThrow()
  })

  it('rejeita > 500 IDs (anti-DoS)', () => {
    const ids = Array.from({ length: 501 }).map(
      (_, i) => `cmpvalidcuid${String(i).padStart(13, '0')}`,
    )
    expect(() =>
      bulkActionSchema.parse({ action: 'delete', transactionIds: ids }),
    ).toThrow()
  })

  it('rejeita ID não-CUID', () => {
    expect(() =>
      bulkActionSchema.parse({
        action: 'delete',
        transactionIds: ['not-a-cuid'],
      }),
    ).toThrow()
  })

  it('mark_paid SEM paymentDate → falha', () => {
    expect(() =>
      bulkActionSchema.parse({
        action: 'mark_paid',
        transactionIds: ['cmpvalidcuid000000000abc'],
      }),
    ).toThrow()
  })
})
