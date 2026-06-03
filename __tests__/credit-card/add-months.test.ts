// Sprint PF Fatia 2 — addMonths (extraído de Sprint 3C, agora genérico).

import { describe, expect, test } from 'vitest'
import { addMonths, addYears, lastDayOfMonthUTC } from '@/lib/dates/add-months'

describe('addMonths', () => {
  test('soma 1 mês simples', () => {
    const d = new Date(Date.UTC(2026, 5, 15)) // jun
    const r = addMonths(d, 1)
    expect(r.getUTCMonth()).toBe(6) // jul
    expect(r.getUTCDate()).toBe(15)
  })

  test('31/jan + 1 mês = 28/fev (clamp)', () => {
    const d = new Date(Date.UTC(2026, 0, 31))
    const r = addMonths(d, 1)
    expect(r.getUTCMonth()).toBe(1) // fev
    expect(r.getUTCDate()).toBe(28)
  })

  test('29/fev bissexto + 1 ano = 28/fev não-bissexto', () => {
    const d = new Date(Date.UTC(2024, 1, 29))
    const r = addYears(d, 1)
    expect(r.getUTCFullYear()).toBe(2025)
    expect(r.getUTCMonth()).toBe(1)
    expect(r.getUTCDate()).toBe(28)
  })

  test('30/abr + 1 mês = 30/mai (mantém)', () => {
    const d = new Date(Date.UTC(2026, 3, 30))
    const r = addMonths(d, 1)
    expect(r.getUTCDate()).toBe(30)
  })

  test('preserva hora/minuto/segundo/ms', () => {
    const d = new Date(Date.UTC(2026, 5, 15, 14, 30, 45, 123))
    const r = addMonths(d, 1)
    expect(r.getUTCHours()).toBe(14)
    expect(r.getUTCMinutes()).toBe(30)
    expect(r.getUTCSeconds()).toBe(45)
    expect(r.getUTCMilliseconds()).toBe(123)
  })

  test('soma 6 meses cruza ano', () => {
    const d = new Date(Date.UTC(2026, 8, 15)) // set
    const r = addMonths(d, 6)
    expect(r.getUTCFullYear()).toBe(2027)
    expect(r.getUTCMonth()).toBe(2) // mar
  })

  test('soma negativa funciona', () => {
    const d = new Date(Date.UTC(2026, 5, 15))
    const r = addMonths(d, -1)
    expect(r.getUTCMonth()).toBe(4) // mai
  })
})

describe('lastDayOfMonthUTC', () => {
  test('janeiro = 31', () => expect(lastDayOfMonthUTC(2026, 0)).toBe(31))
  test('fevereiro 2026 (não-bissexto) = 28', () =>
    expect(lastDayOfMonthUTC(2026, 1)).toBe(28))
  test('fevereiro 2024 (bissexto) = 29', () =>
    expect(lastDayOfMonthUTC(2024, 1)).toBe(29))
  test('abril = 30', () => expect(lastDayOfMonthUTC(2026, 3)).toBe(30))
  test('dezembro = 31', () => expect(lastDayOfMonthUTC(2026, 11)).toBe(31))
})
