// Sprint Escada-Status (28/06/2026) — invariante consolidada: escada de status
// nos 2 sentidos.
//
// (A) categoryId IS NULL ⇒ status = 'PENDING'   [Sprint Fundação Status, 28/06]
// (B) categoryId NOT NULL ⇒ status = 'RECONCILED'   [Sprint Escada-Status, 28/06]
// (excessão: IGNORED é manual e independente da escada)

import { describe, it, expect } from 'vitest'
import {
  statusFromCategoryId,
  needsReview,
} from '@/lib/transacoes/needs-review'

describe('Escada de status nos 2 sentidos via statusFromCategoryId', () => {
  it('(A) categoryId null → PENDING', () => {
    expect(statusFromCategoryId(null)).toBe('PENDING')
    expect(statusFromCategoryId(undefined)).toBe('PENDING')
  })

  it('(B) categoryId preenchido → RECONCILED', () => {
    expect(statusFromCategoryId('cat_a')).toBe('RECONCILED')
    expect(statusFromCategoryId('cmq...')).toBe('RECONCILED')
  })

  it('uma tx em qualquer fluxo: se passa por statusFromCategoryId, NUNCA fica em estado invertido', () => {
    // 4 cenários reais que esta sprint corrigiu
    const casos = [
      { name: 'manual classify cat=null', catId: null, expected: 'PENDING' },
      { name: 'manual classify cat=set', catId: 'cat_x', expected: 'RECONCILED' },
      { name: 'bridge resolve cat=set', catId: 'cat_y', expected: 'RECONCILED' },
      { name: 'orphan reconcile cat=set', catId: 'cat_z', expected: 'RECONCILED' },
    ]
    for (const c of casos) {
      expect(statusFromCategoryId(c.catId)).toBe(c.expected)
    }
  })
})

describe('Coerência: needsReview ↔ statusFromCategoryId', () => {
  // needsReview retorna true quando NÃO tem categoria (entra na fila /pendentes).
  // statusFromCategoryId retorna 'PENDING' nesse mesmo caso.
  // Significado: needsReview = true ⇔ status DEVE ser PENDING.
  const BASE = {
    transferGroupId: null,
    reconciledWithId: null,
    reconciledFrom: [],
    isCardPayment: false,
    loanInstallmentPaid: null,
    pendingTransfer: false,
    isInternalTransfer: false,
    ignoredAt: null,
    type: 'DEBIT' as const,
  }

  it('sem categoria + clean → needsReview=true ⇔ status deveria ser PENDING', () => {
    const tx = { ...BASE, categoryId: null }
    expect(needsReview(tx)).toBe(true)
    expect(statusFromCategoryId(tx.categoryId)).toBe('PENDING')
  })

  it('com categoria + clean → needsReview=false ⇔ status deveria ser RECONCILED', () => {
    const tx = { ...BASE, categoryId: 'cat_x' }
    expect(needsReview(tx)).toBe(false)
    expect(statusFromCategoryId(tx.categoryId)).toBe('RECONCILED')
  })
})
