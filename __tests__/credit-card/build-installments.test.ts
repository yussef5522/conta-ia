// Sprint PF Fatia 2 — Build installments (parcelamento Nx). 15 testes.

import { describe, expect, test } from 'vitest'
import {
  buildInstallments,
  MAX_INSTALLMENTS,
} from '@/lib/credit-card/build-installments'

const NUBANK: { closingDay: number; dueDay: number; closingDayRule: 'ATUAL' | 'PROXIMA' } = {
  closingDay: 5,
  dueDay: 12,
  closingDayRule: 'ATUAL',
}

describe('buildInstallments — split do valor', () => {
  test('1x à vista → 1 parcela com valor total', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 5, 10)),
      totalAmount: 100,
      installments: 1,
      card: NUBANK,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(100)
    expect(rows[0].installmentNumber).toBe(1)
  })

  test('2x R$ 100 = 50 + 50 (soma exata)', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 5, 10)),
      totalAmount: 100,
      installments: 2,
      card: NUBANK,
    })
    expect(rows.map((r) => r.amount)).toEqual([50, 50])
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(100)
  })

  test('3x R$ 100 = 33,33 + 33,33 + 33,34 (resto na última)', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 5, 10)),
      totalAmount: 100,
      installments: 3,
      card: NUBANK,
    })
    expect(rows[0].amount).toBe(33.33)
    expect(rows[1].amount).toBe(33.33)
    expect(rows[2].amount).toBe(33.34)
    const sum = rows.reduce((s, r) => s + r.amount, 0)
    expect(Math.round(sum * 100) / 100).toBe(100)
  })

  test('6x R$ 600 = 6×100 (divisão exata)', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 5, 10)),
      totalAmount: 600,
      installments: 6,
      card: NUBANK,
    })
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => r.amount === 100)).toBe(true)
  })

  test('soma das parcelas SEMPRE === totalAmount (qualquer N)', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 10, 12, 18, 24]) {
      const rows = buildInstallments({
        purchaseDate: new Date(Date.UTC(2026, 5, 10)),
        totalAmount: 137.49, // valor "feio"
        installments: n,
        card: NUBANK,
      })
      const sum = rows.reduce((s, r) => s + r.amount, 0)
      expect(Math.round(sum * 100) / 100).toBe(137.49)
    }
  })
})

describe('buildInstallments — cada parcela cai na fatura certa', () => {
  test('compra 10/jun em 3x → faturas jul/ago/set', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 5, 10)),
      totalAmount: 300,
      installments: 3,
      card: NUBANK,
    })
    expect(rows[0].reference).toBe('2026-07')
    expect(rows[1].reference).toBe('2026-08')
    expect(rows[2].reference).toBe('2026-09')
  })

  test('compra 3/jun em 3x → faturas jun/jul/ago (3 < closingDay 5)', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 5, 3)),
      totalAmount: 300,
      installments: 3,
      card: NUBANK,
    })
    expect(rows[0].reference).toBe('2026-06')
    expect(rows[1].reference).toBe('2026-07')
    expect(rows[2].reference).toBe('2026-08')
  })

  test('compra 31/jan em 6x preserva clamp em meses curtos', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 0, 31)),
      totalAmount: 600,
      installments: 6,
      card: NUBANK,
    })
    // 1ª: 31/jan → após dia 5 → fatura fev
    expect(rows[0].reference).toBe('2026-02')
    expect(rows[0].date.getUTCDate()).toBe(31)
    // 2ª: 28/fev (clamp) → fatura mar
    expect(rows[1].reference).toBe('2026-03')
    expect(rows[1].date.getUTCDate()).toBe(28)
    // 3ª: 31/mar → fatura abr
    expect(rows[2].reference).toBe('2026-04')
    expect(rows[2].date.getUTCDate()).toBe(31)
    // 4ª: 30/abr (clamp) → fatura mai
    expect(rows[3].reference).toBe('2026-05')
    expect(rows[3].date.getUTCDate()).toBe(30)
  })

  test('compra 28/dez/2026 em 12x cruza ano corretamente', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 11, 28)),
      totalAmount: 1200,
      installments: 12,
      card: NUBANK,
    })
    // 1ª = 28/dez/2026 → fatura 2027-01 (após fechamento dia 5)
    expect(rows[0].reference).toBe('2027-01')
    // 12ª = +11 meses = 28/nov/2027 → fatura 2027-12
    expect(rows[11].reference).toBe('2027-12')
  })

  test('12 parcelas geram 12 references distintas', () => {
    const rows = buildInstallments({
      purchaseDate: new Date(Date.UTC(2026, 5, 10)),
      totalAmount: 1200,
      installments: 12,
      card: NUBANK,
    })
    const refs = new Set(rows.map((r) => r.reference))
    expect(refs.size).toBe(12)
  })
})

describe('buildInstallments — validação', () => {
  test('0 parcelas → throw', () => {
    expect(() =>
      buildInstallments({
        purchaseDate: new Date(),
        totalAmount: 100,
        installments: 0,
        card: NUBANK,
      }),
    ).toThrow()
  })

  test(`${MAX_INSTALLMENTS + 1} parcelas → throw`, () => {
    expect(() =>
      buildInstallments({
        purchaseDate: new Date(),
        totalAmount: 100,
        installments: MAX_INSTALLMENTS + 1,
        card: NUBANK,
      }),
    ).toThrow()
  })

  test('totalAmount 0 → throw', () => {
    expect(() =>
      buildInstallments({
        purchaseDate: new Date(),
        totalAmount: 0,
        installments: 3,
        card: NUBANK,
      }),
    ).toThrow()
  })

  test('totalAmount negativo → throw', () => {
    expect(() =>
      buildInstallments({
        purchaseDate: new Date(),
        totalAmount: -100,
        installments: 3,
        card: NUBANK,
      }),
    ).toThrow()
  })
})
