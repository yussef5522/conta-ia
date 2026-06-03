// Sprint PF Fatia 2 — Em qual fatura a compra cai? (25 testes)

import { describe, expect, test } from 'vitest'
import {
  calculateInvoiceReference,
  type CardConfig,
} from '@/lib/credit-card/calculate-invoice-reference'

// Cartão Nubank padrão: fecha dia 5, vence dia 12, regra ATUAL
const NUBANK_NORMAL: CardConfig = {
  closingDay: 5,
  dueDay: 12,
  closingDayRule: 'ATUAL',
}

describe('calculateInvoiceReference — pegadinha #1 (compra no dia do fechamento)', () => {
  test('compra ANTES do fechamento → fatura desse mês', () => {
    const purchase = new Date(Date.UTC(2026, 5, 3)) // 03/jun
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2026-06')
  })

  test('compra DEPOIS do fechamento → próximo mês', () => {
    const purchase = new Date(Date.UTC(2026, 5, 10)) // 10/jun (após dia 5)
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2026-07')
  })

  test('compra NO fechamento + ATUAL → fatura desse mês', () => {
    const purchase = new Date(Date.UTC(2026, 5, 5))
    const r = calculateInvoiceReference(purchase, {
      ...NUBANK_NORMAL,
      closingDayRule: 'ATUAL',
    })
    expect(r.reference).toBe('2026-06')
  })

  test('compra NO fechamento + PROXIMA → próximo mês', () => {
    const purchase = new Date(Date.UTC(2026, 5, 5))
    const r = calculateInvoiceReference(purchase, {
      ...NUBANK_NORMAL,
      closingDayRule: 'PROXIMA',
    })
    expect(r.reference).toBe('2026-07')
  })

  test('compra 1 dia ANTES do fechamento → mês atual', () => {
    const purchase = new Date(Date.UTC(2026, 5, 4))
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2026-06')
  })

  test('compra 1 dia DEPOIS do fechamento → próximo mês', () => {
    const purchase = new Date(Date.UTC(2026, 5, 6))
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2026-07')
  })
})

describe('calculateInvoiceReference — closing/due day clamp', () => {
  test('closingDay 31 em fevereiro → clamp pra 28', () => {
    const card: CardConfig = { closingDay: 31, dueDay: 10, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 1, 27)) // 27/fev (antes do clamp 28)
    const r = calculateInvoiceReference(purchase, card)
    // closing fica 28/fev (clamp). 27 < 28 → fatura desse mês
    expect(r.reference).toBe('2026-02')
    expect(r.closingDate.getUTCDate()).toBe(28)
  })

  test('closingDay 31 em abril (30 dias) → clamp pra 30', () => {
    const card: CardConfig = { closingDay: 31, dueDay: 10, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 3, 30))
    const r = calculateInvoiceReference(purchase, card)
    // closing 30/abr (clamp). 30 == 30 → ATUAL → fatura abril
    expect(r.reference).toBe('2026-04')
  })

  test('compra 31/jan, closingDay=31 → fatura jan (compra no dia do fechamento)', () => {
    const card: CardConfig = { closingDay: 31, dueDay: 10, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 0, 31))
    const r = calculateInvoiceReference(purchase, card)
    expect(r.reference).toBe('2026-01')
    expect(r.closingDate.getUTCDate()).toBe(31)
  })

  test('closingDay 29, fevereiro não-bissexto → clamp 28', () => {
    const card: CardConfig = { closingDay: 29, dueDay: 5, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 1, 27))
    const r = calculateInvoiceReference(purchase, card)
    // Closing fev clamp = 28; 27 < 28 → fatura fev
    expect(r.reference).toBe('2026-02')
    expect(r.closingDate.getUTCDate()).toBe(28)
  })
})

describe('calculateInvoiceReference — dueDate (caso fecha-vence)', () => {
  test('dueDay > closingDay (caso comum) → vencimento mesmo mês', () => {
    const card: CardConfig = { closingDay: 5, dueDay: 12, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 5, 3))
    const r = calculateInvoiceReference(purchase, card)
    expect(r.reference).toBe('2026-06')
    expect(r.closingDate.getUTCMonth()).toBe(5) // jun
    expect(r.dueDate.getUTCMonth()).toBe(5) // jun também
    expect(r.dueDate.getUTCDate()).toBe(12)
  })

  test('dueDay < closingDay (caso raro) → vencimento mês seguinte', () => {
    const card: CardConfig = { closingDay: 25, dueDay: 5, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 5, 20))
    const r = calculateInvoiceReference(purchase, card)
    expect(r.reference).toBe('2026-06')
    expect(r.closingDate.getUTCMonth()).toBe(5) // jun
    expect(r.dueDate.getUTCMonth()).toBe(6) // jul
  })

  test('dueDay clamp em fev', () => {
    const card: CardConfig = { closingDay: 5, dueDay: 30, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 0, 3)) // 03/jan
    const r = calculateInvoiceReference(purchase, card)
    expect(r.reference).toBe('2026-01')
    expect(r.dueDate.getUTCDate()).toBe(30) // jan
  })
})

describe('calculateInvoiceReference — virada de ano', () => {
  test('compra 28/dez DEPOIS do fechamento dia 5 → fatura jan próximo ano', () => {
    const purchase = new Date(Date.UTC(2026, 11, 28))
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2027-01')
  })

  test('compra 03/dez ANTES do fechamento → fatura dez', () => {
    const purchase = new Date(Date.UTC(2026, 11, 3))
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2026-12')
  })

  test('compra 31/dez → fatura jan ano seguinte', () => {
    const purchase = new Date(Date.UTC(2026, 11, 31))
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2027-01')
  })
})

describe('calculateInvoiceReference — validação de entrada', () => {
  test('closingDay 0 → throw', () => {
    expect(() =>
      calculateInvoiceReference(new Date(), {
        closingDay: 0,
        dueDay: 10,
        closingDayRule: 'ATUAL',
      }),
    ).toThrow()
  })
  test('closingDay 32 → throw', () => {
    expect(() =>
      calculateInvoiceReference(new Date(), {
        closingDay: 32,
        dueDay: 10,
        closingDayRule: 'ATUAL',
      }),
    ).toThrow()
  })
  test('dueDay inválido → throw', () => {
    expect(() =>
      calculateInvoiceReference(new Date(), {
        closingDay: 5,
        dueDay: 0,
        closingDayRule: 'ATUAL',
      }),
    ).toThrow()
  })
  test('closingDayRule inválido → throw', () => {
    expect(() =>
      calculateInvoiceReference(new Date(), {
        closingDay: 5,
        dueDay: 10,
        // @ts-expect-error invalid
        closingDayRule: 'INVALID',
      }),
    ).toThrow()
  })
})

describe('calculateInvoiceReference — cenário real Yussef', () => {
  test('Nubank fecha 5: compra Netflix 28/jan → fatura fev', () => {
    const purchase = new Date(Date.UTC(2026, 0, 28))
    const r = calculateInvoiceReference(purchase, NUBANK_NORMAL)
    expect(r.reference).toBe('2026-02')
    expect(r.closingDate.getUTCMonth()).toBe(1) // fev (clamp não atua, 5 < 28)
    expect(r.closingDate.getUTCDate()).toBe(5)
  })

  test('Cartão Itaú (fecha 9, vence 16): compra 9/jun ATUAL → fatura jun', () => {
    const card: CardConfig = { closingDay: 9, dueDay: 16, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 5, 9))
    const r = calculateInvoiceReference(purchase, card)
    expect(r.reference).toBe('2026-06')
  })

  test('Cartão Bradesco (fecha 10, vence 17): compra 11/jul → fatura ago', () => {
    const card: CardConfig = { closingDay: 10, dueDay: 17, closingDayRule: 'ATUAL' }
    const purchase = new Date(Date.UTC(2026, 6, 11))
    const r = calculateInvoiceReference(purchase, card)
    expect(r.reference).toBe('2026-08')
  })
})
