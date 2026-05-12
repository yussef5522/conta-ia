// Regressão: bug em produção (12/05/2026) onde unstable_cache do Next 15+
// serializava Date → string ISO. Quando RecentActivity chamava
// formatActivityDate(item.date), `.getTime()` quebrava em string.
//
// Fix: (A) reidratar Date no boundary do cache em getRecentActivity/getHeroKPIs;
//      (B) formatActivityDate aceita Date | string e normaliza.
//
// Esses testes não tocam DB — exercitam a função pura `formatActivityDate`
// com inputs nos 2 formatos pra blindar contra regressão.

import { describe, it, expect } from 'vitest'
import { formatActivityDate } from '@/lib/dashboard/format-activity-date'

const REF = new Date('2026-05-15T12:00:00Z')

describe('formatActivityDate — aceita Date | string (regressão produção 12/05)', () => {
  it('Date input: "Hoje" se mesma data', () => {
    expect(formatActivityDate(new Date('2026-05-15T08:00:00Z'), REF)).toBe('Hoje')
  })

  it('STRING ISO input (vindo de unstable_cache) também retorna "Hoje"', () => {
    expect(formatActivityDate('2026-05-15T08:00:00Z', REF)).toBe('Hoje')
  })

  it('STRING ISO yesterday → "Ontem"', () => {
    expect(formatActivityDate('2026-05-14T10:00:00Z', REF)).toBe('Ontem')
  })

  it('STRING ISO há 3 dias → "Há 3 dias"', () => {
    expect(formatActivityDate('2026-05-12T10:00:00Z', REF)).toBe('Há 3 dias')
  })

  it('STRING ISO há 30 dias → DD/MM', () => {
    expect(formatActivityDate('2026-04-15T10:00:00Z', REF)).toBe('15/04')
  })

  it('STRING ISO ano anterior → DD/MM/YYYY', () => {
    expect(formatActivityDate('2025-08-10T10:00:00Z', REF)).toBe('10/08/2025')
  })

  it('refDate como STRING também funciona', () => {
    expect(
      formatActivityDate('2026-05-14T10:00:00Z', '2026-05-15T12:00:00Z'),
    ).toBe('Ontem')
  })

  it('LANÇA com erro descritivo em string inválida', () => {
    expect(() => formatActivityDate('not-a-date', REF)).toThrow(/data inválida/)
  })

  it('LANÇA com erro descritivo em refDate inválida', () => {
    expect(() =>
      formatActivityDate(new Date('2026-05-15'), 'lixo'),
    ).toThrow(/data inválida/)
  })

  it('Date e string da MESMA data dão o mesmo resultado', () => {
    const dateForm = new Date('2026-05-10T10:00:00Z')
    const stringForm = '2026-05-10T10:00:00Z'
    expect(formatActivityDate(dateForm, REF)).toBe(formatActivityDate(stringForm, REF))
  })
})
