// Sprint PF Fatia 2 — Consolidado de TODOS os cartões do perfil.
//
// FUNÇÃO PURA: input = array de CardSummary.
// Output = totalLimit/used/available + fatura mês atual + preview próximo.
//
// Alimenta o dashboard PF (próximo sprint) — já deixa pronto.

import type { CardSummaryResult } from './calculate-card-summary'

export interface ProfileCreditSummaryResult {
  cardsCount: number
  totalLimit: number
  totalUsed: number
  totalAvailable: number
  /** Soma de currentInvoice.totalAmount (todas com closingDate <= now + 30d) */
  currentMonthInvoiceTotal: number
  /** Soma de nextInvoicePreview */
  nextMonthInvoicePreview: number
  byCard: CardSummaryResult[]
}

export function calculateProfileCreditSummary(
  cardSummaries: CardSummaryResult[],
): ProfileCreditSummaryResult {
  const totalLimit = cardSummaries.reduce((s, c) => s + c.creditLimit, 0)
  const totalUsed = cardSummaries.reduce((s, c) => s + c.limitUsed, 0)
  const totalAvailable = Math.max(0, totalLimit - totalUsed)
  const currentMonthInvoiceTotal = cardSummaries.reduce(
    (s, c) => s + (c.currentInvoice?.totalAmount ?? 0),
    0,
  )
  const nextMonthInvoicePreview = cardSummaries.reduce(
    (s, c) => s + c.nextInvoicePreview,
    0,
  )

  return {
    cardsCount: cardSummaries.length,
    totalLimit,
    totalUsed,
    totalAvailable,
    currentMonthInvoiceTotal,
    nextMonthInvoicePreview,
    byCard: cardSummaries,
  }
}
