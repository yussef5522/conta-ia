import { describe, it, expect } from 'vitest'
import { formatActivityDate } from '@/lib/dashboard/format-activity-date'

describe('formatActivityDate — Sprint 1 Dia 5', () => {
  const REF = new Date('2026-05-15T12:00:00Z')

  it('mesma data do calendário → "Hoje"', () => {
    expect(formatActivityDate(new Date('2026-05-15T08:00:00Z'), REF)).toBe('Hoje')
  })

  it('mesma data mesmo com hora diferente → "Hoje"', () => {
    expect(formatActivityDate(new Date('2026-05-15T23:59:00Z'), REF)).toBe('Hoje')
  })

  it('1 dia atrás → "Ontem"', () => {
    expect(formatActivityDate(new Date('2026-05-14T10:00:00Z'), REF)).toBe('Ontem')
  })

  it('borda meia-noite: tx 23:50 ontem, ref 00:10 hoje → "Ontem"', () => {
    expect(
      formatActivityDate(
        new Date('2026-05-14T23:50:00Z'),
        new Date('2026-05-15T00:10:00Z'),
      ),
    ).toBe('Ontem')
  })

  it('2 dias atrás → "Há 2 dias"', () => {
    expect(formatActivityDate(new Date('2026-05-13T10:00:00Z'), REF)).toBe('Há 2 dias')
  })

  it('7 dias atrás → "Há 7 dias"', () => {
    expect(formatActivityDate(new Date('2026-05-08T10:00:00Z'), REF)).toBe('Há 7 dias')
  })

  it('8 dias atrás → DD/MM ("07/05")', () => {
    expect(formatActivityDate(new Date('2026-05-07T10:00:00Z'), REF)).toBe('07/05')
  })

  it('30 dias atrás (mesmo ano) → DD/MM', () => {
    expect(formatActivityDate(new Date('2026-04-15T10:00:00Z'), REF)).toBe('15/04')
  })

  it('ano anterior → DD/MM/YYYY', () => {
    expect(formatActivityDate(new Date('2025-08-10T10:00:00Z'), REF)).toBe('10/08/2025')
  })

  it('mesmo dia do ano mas ano diferente → DD/MM/YYYY', () => {
    expect(formatActivityDate(new Date('2025-05-15T10:00:00Z'), REF)).toBe('15/05/2025')
  })
})
