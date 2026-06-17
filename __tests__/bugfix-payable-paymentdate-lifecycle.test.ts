// Bug-fix 28/05/2026 — Testes da invariante PAYABLE+paymentDate.
//
// Regra invariante (lib/lifecycle/index.ts:60-69):
//   PAYABLE/RECEIVABLE NÃO podem ter paymentDate.
//
// 2 paths que escrevem paymentDate corrigidos:
//   1. Import Excel (confirm/route.ts) — agora cria EFFECTED quando isPaid
//   2. Bulk mark_paid (bulk/route.ts) — agora transiciona PAYABLE→EFFECTED
//
// Estes testes validam a LIB pura `validateLifecycleState` + lógica de decisão
// `lifecycle: isPaid ? 'EFFECTED' : 'PAYABLE'` que ambos paths usam.

import { describe, it, expect } from 'vitest'
import { validateLifecycleState, canTransition } from '@/lib/lifecycle'

describe('Invariante PAYABLE/RECEIVABLE não pode ter paymentDate', () => {
  it('PAYABLE com paymentDate é INVÁLIDO', () => {
    const r = validateLifecycleState({
      lifecycle: 'PAYABLE',
      status: 'PENDING',
      paymentDate: new Date('2026-04-15'),
      dueDate: new Date('2026-04-15'),
      bankAccountId: null,
    })
    expect(r.valid).toBe(false)
    expect(r.error).toContain('PAYABLE')
    expect(r.error).toContain('paymentDate')
  })

  it('RECEIVABLE com paymentDate é INVÁLIDO', () => {
    const r = validateLifecycleState({
      lifecycle: 'RECEIVABLE',
      status: 'PENDING',
      paymentDate: new Date('2026-04-15'),
      dueDate: new Date('2026-04-15'),
      bankAccountId: null,
    })
    expect(r.valid).toBe(false)
  })

  it('PAYABLE sem paymentDate (cenário correto) é VÁLIDO', () => {
    const r = validateLifecycleState({
      lifecycle: 'PAYABLE',
      status: 'PENDING',
      paymentDate: null,
      dueDate: new Date('2026-04-15'),
      bankAccountId: null,
    })
    expect(r.valid).toBe(true)
  })

  it('EFFECTED com paymentDate é VÁLIDO', () => {
    const r = validateLifecycleState({
      lifecycle: 'EFFECTED',
      status: 'RECONCILED',
      paymentDate: new Date('2026-04-15'),
      dueDate: new Date('2026-04-15'),
      bankAccountId: 'bank-1',
    })
    expect(r.valid).toBe(true)
  })

  it('EFFECTED sem paymentDate (regime competência) é VÁLIDO', () => {
    // Sprint Trava-Permanente: regra 5 exige bank OU cashCoded OU reconcile.
    const r = validateLifecycleState({
      lifecycle: 'EFFECTED',
      status: 'PENDING',
      paymentDate: null,
      dueDate: null,
      bankAccountId: 'bank-1',
    })
    expect(r.valid).toBe(true)
  })

  it('PAYABLE sem dueDate é INVÁLIDO', () => {
    const r = validateLifecycleState({
      lifecycle: 'PAYABLE',
      status: 'PENDING',
      paymentDate: null,
      dueDate: null,
      bankAccountId: null,
    })
    expect(r.valid).toBe(false)
  })
})

describe('Transições PAYABLE → EFFECTED (transição válida)', () => {
  it('PAYABLE pode virar EFFECTED (mark_paid, conciliação OFX, import isPaid)', () => {
    expect(canTransition('PAYABLE', 'EFFECTED')).toBe(true)
  })

  it('RECEIVABLE pode virar EFFECTED', () => {
    expect(canTransition('RECEIVABLE', 'EFFECTED')).toBe(true)
  })

  it('EFFECTED é terminal — NÃO volta pra PAYABLE', () => {
    expect(canTransition('EFFECTED', 'PAYABLE')).toBe(false)
  })

  it('PAYABLE NÃO pode virar RECEIVABLE (lateral)', () => {
    expect(canTransition('PAYABLE', 'RECEIVABLE')).toBe(false)
  })
})

describe('Lógica do Fix A1 — import Excel: lifecycle por isPaid', () => {
  // Replica a lógica do confirm/route.ts:238 após o fix
  const lifecycleForImport = (isPaid: boolean): 'EFFECTED' | 'PAYABLE' =>
    isPaid ? 'EFFECTED' : 'PAYABLE'

  it('Excel com pagamento preenchido cria EFFECTED', () => {
    expect(lifecycleForImport(true)).toBe('EFFECTED')
  })

  it('Excel sem pagamento cria PAYABLE', () => {
    expect(lifecycleForImport(false)).toBe('PAYABLE')
  })

  it('estado resultante (EFFECTED + paymentDate) é válido', () => {
    // Sprint Trava-Permanente: Excel confirm seta cashCoded=true quando
    // EFFECTED+sem-bank (regra 5).
    const isPaid = true
    const lifecycle = lifecycleForImport(isPaid)
    const r = validateLifecycleState({
      lifecycle,
      status: 'RECONCILED',
      paymentDate: new Date('2026-04-15'),
      dueDate: new Date('2026-04-10'),
      bankAccountId: null,
      cashCoded: true,
    })
    expect(r.valid).toBe(true)
  })

  it('estado resultante (PAYABLE sem paymentDate) é válido', () => {
    const isPaid = false
    const lifecycle = lifecycleForImport(isPaid)
    const r = validateLifecycleState({
      lifecycle,
      status: 'PENDING',
      paymentDate: null,
      dueDate: new Date('2026-04-15'),
      bankAccountId: null,
    })
    expect(r.valid).toBe(true)
  })
})

describe('Lógica do Fix A2 — bulk mark_paid: lifecycle EFFECTED', () => {
  // Replica o update pós-fix do bulk/route.ts:121-129
  const stateAfterMarkPaid = (paymentDate: Date) => ({
    lifecycle: 'EFFECTED' as const,
    status: 'RECONCILED',
    paymentDate,
    date: paymentDate,
  })

  it('mark_paid produz estado EFFECTED + paymentDate (válido)', () => {
    const result = stateAfterMarkPaid(new Date('2026-05-28'))
    expect(result.lifecycle).toBe('EFFECTED')
    expect(result.paymentDate).toBeDefined()
  })

  it('estado resultante passa validateLifecycleState', () => {
    const result = stateAfterMarkPaid(new Date('2026-05-28'))
    const v = validateLifecycleState({
      lifecycle: result.lifecycle,
      status: result.status,
      paymentDate: result.paymentDate,
      dueDate: new Date('2026-05-20'),
      bankAccountId: 'bank-1',
    })
    expect(v.valid).toBe(true)
  })
})

describe('Regression: backfill SQL critério', () => {
  // Replica SELECT que a migration aplica em prod
  // UPDATE transactions SET lifecycle='EFFECTED'
  // WHERE lifecycle='PAYABLE' AND paymentDate IS NOT NULL AND reconciledWithId IS NULL
  type Tx = {
    lifecycle: 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'
    paymentDate: Date | null
    reconciledWithId: string | null
  }

  const shouldBackfill = (tx: Tx): boolean =>
    tx.lifecycle === 'PAYABLE' &&
    tx.paymentDate !== null &&
    tx.reconciledWithId === null

  it('PAYABLE + paymentDate + sem conciliação → backfill', () => {
    expect(
      shouldBackfill({
        lifecycle: 'PAYABLE',
        paymentDate: new Date(),
        reconciledWithId: null,
      }),
    ).toBe(true)
  })

  it('PAYABLE conciliada (reconciledWithId != null) NÃO backfill — evita dupla contagem', () => {
    expect(
      shouldBackfill({
        lifecycle: 'PAYABLE',
        paymentDate: new Date(),
        reconciledWithId: 'ofx-123',
      }),
    ).toBe(false)
  })

  it('PAYABLE sem paymentDate (estado válido) NÃO backfill', () => {
    expect(
      shouldBackfill({
        lifecycle: 'PAYABLE',
        paymentDate: null,
        reconciledWithId: null,
      }),
    ).toBe(false)
  })

  it('Já EFFECTED NÃO backfill (idempotência)', () => {
    expect(
      shouldBackfill({
        lifecycle: 'EFFECTED',
        paymentDate: new Date(),
        reconciledWithId: null,
      }),
    ).toBe(false)
  })

  it('RECEIVABLE com paymentDate NÃO backfill (escopo restrito a PAYABLE)', () => {
    // Mesma regra deveria valer pra RECEIVABLE, mas a migration atual
    // só cobre PAYABLE (despesas Excel). Se o bug afetar RECEIVABLE no
    // futuro, fazer migration similar.
    expect(
      shouldBackfill({
        lifecycle: 'RECEIVABLE',
        paymentDate: new Date(),
        reconciledWithId: null,
      }),
    ).toBe(false)
  })
})
