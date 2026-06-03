// Sprint PF Fatia 2 — Card summary (KPIs do cartão). 10 testes.

import { describe, expect, test } from 'vitest'
import {
  calculateCardSummary,
  nextReferenceOf,
} from '@/lib/credit-card/calculate-card-summary'

const NOW = new Date(Date.UTC(2026, 5, 1)) // 01/jun/2026

describe('nextReferenceOf', () => {
  test('2026-06 → 2026-07', () => {
    expect(nextReferenceOf('2026-06')).toBe('2026-07')
  })
  test('2026-12 → 2027-01 (virada de ano)', () => {
    expect(nextReferenceOf('2026-12')).toBe('2027-01')
  })
  test('2026-01 → 2026-02', () => {
    expect(nextReferenceOf('2026-01')).toBe('2026-02')
  })
})

describe('calculateCardSummary — limite usado', () => {
  test('1 invoice OPEN R$ 500 → limite usado = 500', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-1',
        creditLimit: 5000,
        invoices: [
          {
            id: 'inv-1',
            reference: '2026-06',
            closingDate: new Date(Date.UTC(2026, 5, 5)),
            dueDate: new Date(Date.UTC(2026, 5, 12)),
            totalAmount: 500,
            paidAmount: 0,
            status: 'OPEN',
          },
        ],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.limitUsed).toBe(500)
    expect(r.limitAvailable).toBe(4500)
    expect(r.limitUsedPercent).toBe(10)
  })

  test('invoice PAID NÃO conta no limite usado', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-2',
        creditLimit: 5000,
        invoices: [
          {
            id: 'inv-paid',
            reference: '2026-05',
            closingDate: new Date(Date.UTC(2026, 4, 5)),
            dueDate: new Date(Date.UTC(2026, 4, 12)),
            totalAmount: 1000,
            paidAmount: 1000,
            status: 'PAID',
          },
        ],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.limitUsed).toBe(0)
    expect(r.limitAvailable).toBe(5000)
  })

  test('invoice PARTIAL conta SÓ o remanescente', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-3',
        creditLimit: 5000,
        invoices: [
          {
            id: 'inv-partial',
            reference: '2026-05',
            closingDate: new Date(Date.UTC(2026, 4, 5)),
            dueDate: new Date(Date.UTC(2026, 4, 12)),
            totalAmount: 1000,
            paidAmount: 600,
            status: 'PARTIAL',
          },
        ],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.limitUsed).toBe(400)
  })

  test('soma de várias invoices ativas + parcelas futuras', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-4',
        creditLimit: 10000,
        invoices: [
          {
            id: '1',
            reference: '2026-06',
            closingDate: new Date(Date.UTC(2026, 5, 5)),
            dueDate: new Date(Date.UTC(2026, 5, 12)),
            totalAmount: 800,
            paidAmount: 0,
            status: 'OPEN',
          },
          {
            id: '2',
            reference: '2026-05',
            closingDate: new Date(Date.UTC(2026, 4, 5)),
            dueDate: new Date(Date.UTC(2026, 4, 12)),
            totalAmount: 600,
            paidAmount: 200,
            status: 'PARTIAL',
          },
        ],
        futureParcelasNotInvoiced: [
          { amount: 300, reference: '2026-07' },
        ],
      },
      NOW,
    )
    // 800 (OPEN) + 400 (PARTIAL remaining) + 300 (futura) = 1500
    expect(r.limitUsed).toBe(1500)
    expect(r.limitAvailable).toBe(8500)
  })

  test('creditLimit 0 → limitUsedPercent 0 (no div by zero)', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-5',
        creditLimit: 0,
        invoices: [],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.limitUsedPercent).toBe(0)
    expect(r.limitAvailable).toBe(0)
  })

  test('limite estourado → limitAvailable clamp 0 (não negativo)', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-6',
        creditLimit: 100,
        invoices: [
          {
            id: '1',
            reference: '2026-06',
            closingDate: new Date(Date.UTC(2026, 5, 5)),
            dueDate: new Date(Date.UTC(2026, 5, 12)),
            totalAmount: 500,
            paidAmount: 0,
            status: 'OPEN',
          },
        ],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.limitUsed).toBe(500)
    expect(r.limitAvailable).toBe(0) // clamp
    expect(r.limitUsedPercent).toBe(100) // clamp 100
  })
})

describe('calculateCardSummary — currentInvoice', () => {
  test('OPEN futura é a current', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-7',
        creditLimit: 5000,
        invoices: [
          {
            id: 'a',
            reference: '2026-06',
            closingDate: new Date(Date.UTC(2026, 5, 5)),
            dueDate: new Date(Date.UTC(2026, 5, 12)),
            totalAmount: 500,
            paidAmount: 0,
            status: 'OPEN',
          },
        ],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.currentInvoice?.id).toBe('a')
    // 01/jun → 05/jun closing = 4 dias
    expect(r.currentInvoice?.daysUntilClosing).toBe(4)
  })

  test('CLOSED não-paga é a current se nenhuma OPEN', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-8',
        creditLimit: 5000,
        invoices: [
          {
            id: 'closed',
            reference: '2026-05',
            closingDate: new Date(Date.UTC(2026, 4, 5)),
            dueDate: new Date(Date.UTC(2026, 4, 12)),
            totalAmount: 500,
            paidAmount: 0,
            status: 'CLOSED',
          },
        ],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.currentInvoice?.id).toBe('closed')
  })

  test('sem invoices → currentInvoice null', () => {
    const r = calculateCardSummary(
      {
        cardId: 'card-9',
        creditLimit: 1000,
        invoices: [],
        futureParcelasNotInvoiced: [],
      },
      NOW,
    )
    expect(r.currentInvoice).toBeNull()
    expect(r.nextInvoicePreview).toBe(0)
  })
})
