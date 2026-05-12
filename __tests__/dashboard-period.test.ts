import { describe, it, expect } from 'vitest'
import { derivePeriods } from '@/lib/dashboard/period'

describe('derivePeriods — Sprint 1 Dia 1', () => {
  it('currentMonth: 11/05/2026 → start=01/05 00:00, end=31/05 23:59:59.999', () => {
    const r = derivePeriods(new Date('2026-05-11T15:30:00Z'))
    expect(r.currentMonth.start.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(r.currentMonth.end.toISOString()).toBe('2026-05-31T23:59:59.999Z')
  })

  it('previousMonth: ref=01/03/2026 → previous=01/02 → 28/02', () => {
    const r = derivePeriods(new Date('2026-03-01T12:00:00Z'))
    expect(r.previousMonth.start.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(r.previousMonth.end.toISOString()).toBe('2026-02-28T23:59:59.999Z')
  })

  it('previousMonth: ref=01/01/2026 → previous=01/12/2025 → 31/12/2025 (vira o ano)', () => {
    const r = derivePeriods(new Date('2026-01-15T10:00:00Z'))
    expect(r.previousMonth.start.toISOString()).toBe('2025-12-01T00:00:00.000Z')
    expect(r.previousMonth.end.toISOString()).toBe('2025-12-31T23:59:59.999Z')
  })

  it('last30Days: 30 buckets inclusivos terminando em refDate', () => {
    const ref = new Date('2026-05-11T15:00:00Z')
    const r = derivePeriods(ref)
    // start = 11 - 29 dias = 12/abr
    expect(r.last30Days.start.toISOString()).toBe('2026-04-12T00:00:00.000Z')
    // end = 11/mai 23:59:59.999
    expect(r.last30Days.end.toISOString()).toBe('2026-05-11T23:59:59.999Z')
  })

  it('last12Months: 12 meses terminando no mês da refDate', () => {
    const r = derivePeriods(new Date('2026-05-11T12:00:00Z'))
    // start = primeiro dia do mês 5 - 11 = -6 → ajuste de ano: jun/2025
    expect(r.last12Months.start.toISOString()).toBe('2025-06-01T00:00:00.000Z')
    expect(r.last12Months.end.toISOString()).toBe('2026-05-31T23:59:59.999Z')
  })

  it('default refDate = new Date() — não lança e retorna 4 ranges válidos', () => {
    const r = derivePeriods()
    expect(r.currentMonth.start.getTime()).toBeLessThanOrEqual(r.currentMonth.end.getTime())
    expect(r.previousMonth.start.getTime()).toBeLessThanOrEqual(r.previousMonth.end.getTime())
    expect(r.last30Days.start.getTime()).toBeLessThanOrEqual(r.last30Days.end.getTime())
    expect(r.last12Months.start.getTime()).toBeLessThanOrEqual(r.last12Months.end.getTime())
  })

  it('edge case fim de mês: ref=31/03/2026 → previousMonth termina em 28/02/2026', () => {
    // Fev/2026 não é bissexto (2024 era, 2028 será) — fev tem 28 dias
    const r = derivePeriods(new Date('2026-03-31T12:00:00Z'))
    expect(r.previousMonth.end.toISOString()).toBe('2026-02-28T23:59:59.999Z')
  })
})
