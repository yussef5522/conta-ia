// Bug-fix 28/05/2026 — Helper isInPayableScope.

import { describe, it, expect } from 'vitest'
import { isInPayableScope } from '@/lib/contas-pagar/lifecycle-scope'

describe('isInPayableScope', () => {
  it('PAYABLE puro está no escopo', () => {
    expect(
      isInPayableScope({
        lifecycle: 'PAYABLE',
        dueDate: new Date('2026-04-15'),
        type: 'DEBIT',
        reconciledWithId: null,
      }),
    ).toBe(true)
  })

  it('EFFECTED nascida como PAYABLE (Excel isPaid ou backfill) está no escopo', () => {
    expect(
      isInPayableScope({
        lifecycle: 'EFFECTED',
        dueDate: new Date('2026-04-15'),
        type: 'DEBIT',
        reconciledWithId: null,
      }),
    ).toBe(true)
  })

  it('EFFECTED sem dueDate (OFX/ajustar-saldo) NÃO está no escopo', () => {
    expect(
      isInPayableScope({
        lifecycle: 'EFFECTED',
        dueDate: null,
        type: 'DEBIT',
        reconciledWithId: null,
      }),
    ).toBe(false)
  })

  it('EFFECTED com reconciledWithId (conciliada OFX) NÃO está no escopo', () => {
    expect(
      isInPayableScope({
        lifecycle: 'EFFECTED',
        dueDate: new Date('2026-04-15'),
        type: 'DEBIT',
        reconciledWithId: 'ofx-123',
      }),
    ).toBe(false)
  })

  it('EFFECTED CREDIT (receita) NÃO está no escopo de Contas a Pagar', () => {
    expect(
      isInPayableScope({
        lifecycle: 'EFFECTED',
        dueDate: new Date('2026-04-15'),
        type: 'CREDIT',
        reconciledWithId: null,
      }),
    ).toBe(false)
  })

  it('RECEIVABLE NÃO está no escopo (é Contas a Receber)', () => {
    expect(
      isInPayableScope({
        lifecycle: 'RECEIVABLE',
        dueDate: new Date('2026-04-15'),
        type: 'CREDIT',
        reconciledWithId: null,
      }),
    ).toBe(false)
  })

  it('cenário real: 492 contas backfilled (EFFECTED+dueDate+DEBIT+null) → escopo', () => {
    expect(
      isInPayableScope({
        lifecycle: 'EFFECTED',
        dueDate: new Date('2026-04-15'),
        type: 'DEBIT',
        reconciledWithId: null,
      }),
    ).toBe(true)
  })

  it('cenário OFX: EFFECTED via staging/confirm (dueDate=null) → fora do escopo', () => {
    expect(
      isInPayableScope({
        lifecycle: 'EFFECTED',
        dueDate: null,
        type: 'DEBIT',
        reconciledWithId: null,
      }),
    ).toBe(false)
  })
})
