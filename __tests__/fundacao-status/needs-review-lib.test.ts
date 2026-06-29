// Sprint Fundação Status (28/06/2026) — fonte de verdade única.

import { describe, it, expect } from 'vitest'
import {
  needsReview,
  statusFromCategoryId,
  NEEDS_REVIEW_WHERE_PRISMA,
} from '@/lib/transacoes/needs-review'
import type { TxFlagsForReview } from '@/lib/transacoes/needs-review'

const BASE: TxFlagsForReview = {
  categoryId: null,
  transferGroupId: null,
  reconciledWithId: null,
  hasReconciledFrom: false,
  isCardPayment: false,
  hasLoanInstallment: false,
  pendingTransfer: false,
  isInternalTransfer: false,
  ignoredAt: null,
  type: 'DEBIT',
}

describe('needsReview — tx genuinamente pendente', () => {
  it('🎯 tx OFX/PDF sem categoria + nenhum guard → REVIEW', () => {
    expect(needsReview(BASE)).toBe(true)
  })
})

describe('needsReview — cada guard tira a tx da fila', () => {
  it('com categoryId → NÃO precisa revisar', () => {
    expect(needsReview({ ...BASE, categoryId: 'cat_abc' })).toBe(false)
  })
  it('transferGroupId !== null → NÃO (TRANSFER pareada)', () => {
    expect(needsReview({ ...BASE, transferGroupId: 'grp_x' })).toBe(false)
  })
  it('reconciledWithId !== null → NÃO (Excel↔OFX casado)', () => {
    expect(needsReview({ ...BASE, reconciledWithId: 'tx_other' })).toBe(false)
  })
  it('hasReconciledFrom=true → NÃO (OFX-pai com filhas Excel)', () => {
    expect(needsReview({ ...BASE, hasReconciledFrom: true })).toBe(false)
  })
  it('isCardPayment=true → NÃO (cartão tem fila própria)', () => {
    expect(needsReview({ ...BASE, isCardPayment: true })).toBe(false)
  })
  it('hasLoanInstallment=true → NÃO (parcela casada, DRE conta juros)', () => {
    expect(needsReview({ ...BASE, hasLoanInstallment: true })).toBe(false)
  })
  it('pendingTransfer=true → NÃO (aguardando par em /transferencias)', () => {
    expect(needsReview({ ...BASE, pendingTransfer: true })).toBe(false)
  })
  it('isInternalTransfer=true → NÃO (transferência grupo)', () => {
    expect(needsReview({ ...BASE, isInternalTransfer: true })).toBe(false)
  })
  it('ignoredAt set → NÃO (user marcou ignorar)', () => {
    expect(needsReview({ ...BASE, ignoredAt: new Date() })).toBe(false)
  })
  it('type=TRANSFER → NÃO (defesa em profundidade)', () => {
    expect(needsReview({ ...BASE, type: 'TRANSFER' })).toBe(false)
  })
})

describe('needsReview — status NÃO afeta resultado (by design)', () => {
  // Status não é input do guard. Tx RECONCILED-sem-categoria (bug) e tx
  // PENDING-sem-categoria (correto) ambas precisam revisar.
  it('tx "PENDING" (clássica): precisa revisar', () => {
    expect(needsReview(BASE)).toBe(true)
  })
  it('tx "RECONCILED" mas SEM categoria (estado inconsistente do bug PDF/MANUAL): TAMBÉM precisa revisar', () => {
    // Funcional: status nem é parâmetro. Mesmo objeto.
    expect(needsReview(BASE)).toBe(true)
  })
})

describe('statusFromCategoryId — escada inviolável', () => {
  it('categoryId NULL → status PENDING', () => {
    expect(statusFromCategoryId(null)).toBe('PENDING')
  })
  it('categoryId undefined → status PENDING', () => {
    expect(statusFromCategoryId(undefined)).toBe('PENDING')
  })
  it('categoryId vazio (string vazia falsy) → PENDING', () => {
    expect(statusFromCategoryId('')).toBe('PENDING')
  })
  it('categoryId presente → RECONCILED', () => {
    expect(statusFromCategoryId('cat_abc')).toBe('RECONCILED')
  })
})

describe('NEEDS_REVIEW_WHERE_PRISMA — shape pra Prisma WHERE', () => {
  it('inclui os 10 guards', () => {
    const W = NEEDS_REVIEW_WHERE_PRISMA
    expect(W.categoryId).toBe(null)
    expect(W.transferGroupId).toBe(null)
    expect(W.reconciledWithId).toBe(null)
    expect(W.reconciledFrom).toEqual({ none: {} })
    expect(W.isCardPayment).toBe(false)
    expect(W.loanInstallmentPaid).toEqual({ is: null })
    expect(W.pendingTransfer).toBe(false)
    expect(W.isInternalTransfer).toBe(false)
    expect(W.ignoredAt).toBe(null)
    expect(W.type).toEqual({ not: 'TRANSFER' })
  })

  it('NÃO inclui status (by design — pendência é sobre falta de classificação)', () => {
    const W = NEEDS_REVIEW_WHERE_PRISMA as Record<string, unknown>
    expect(W.status).toBeUndefined()
  })
})
