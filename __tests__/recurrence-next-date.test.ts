// Sprint 4.0.1.b — testes da função pura calculateNextDueDates.

import { describe, it, expect } from 'vitest'
import { calculateNextDueDates } from '@/lib/recurrence/next-date'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

describe('calculateNextDueDates — MONTHLY', () => {
  it('dia 10, ref antes do dia 10 do mês → mesmo mês', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: 10,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: null,
      },
      utc(2026, 4, 5), // 5 de maio
      3,
    )
    expect(result).toEqual([utc(2026, 4, 10), utc(2026, 5, 10), utc(2026, 6, 10)])
  })

  it('dia 10, ref depois do dia 10 → próximo mês', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: 10,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: null,
      },
      utc(2026, 4, 15),
      2,
    )
    expect(result).toEqual([utc(2026, 5, 10), utc(2026, 6, 10)])
  })

  it('dia 31, em fevereiro ajusta pra 28', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: 31,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: null,
      },
      utc(2026, 1, 1), // 1 fev
      3,
    )
    // fev 2026 tem 28 dias (não é bissexto)
    expect(result[0]).toEqual(utc(2026, 1, 28))
    expect(result[1]).toEqual(utc(2026, 2, 31))
    expect(result[2]).toEqual(utc(2026, 3, 30)) // abril tem 30
  })

  it('respeita endDate', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: 5,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: utc(2026, 2, 31), // até março
      },
      utc(2026, 0, 1),
      10,
    )
    expect(result).toEqual([utc(2026, 0, 5), utc(2026, 1, 5), utc(2026, 2, 5)])
  })

  it('ref antes do startDate → começa em startDate', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: 10,
        dayOfWeek: null,
        startDate: utc(2026, 5, 1), // junho
        endDate: null,
      },
      utc(2026, 2, 1), // março (antes)
      2,
    )
    expect(result).toEqual([utc(2026, 5, 10), utc(2026, 6, 10)])
  })

  it('ref depois do endDate → array vazio', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: 10,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: utc(2026, 5, 30),
      },
      utc(2027, 0, 1), // ano que vem
      3,
    )
    expect(result).toEqual([])
  })

  it('dayOfMonth null → array vazio', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: null,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: null,
      },
      utc(2026, 4, 1),
      3,
    )
    expect(result).toEqual([])
  })

  it('dayOfMonth fora de range → array vazio', () => {
    expect(
      calculateNextDueDates(
        { frequency: 'MONTHLY', dayOfMonth: 0, dayOfWeek: null, startDate: utc(2026, 0, 1), endDate: null },
        utc(2026, 4, 1),
        3,
      ),
    ).toEqual([])
    expect(
      calculateNextDueDates(
        { frequency: 'MONTHLY', dayOfMonth: 32, dayOfWeek: null, startDate: utc(2026, 0, 1), endDate: null },
        utc(2026, 4, 1),
        3,
      ),
    ).toEqual([])
  })

  it('count=0 → array vazio', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'MONTHLY',
        dayOfMonth: 5,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: null,
      },
      utc(2026, 4, 1),
      0,
    )
    expect(result).toEqual([])
  })
})

describe('calculateNextDueDates — WEEKLY', () => {
  it('toda quinta (dayOfWeek=4)', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'WEEKLY',
        dayOfMonth: null,
        dayOfWeek: 4,
        startDate: utc(2026, 4, 1),
        endDate: null,
      },
      utc(2026, 4, 18), // 18/maio/2026 = segunda
      3,
    )
    // 21 = quinta, 28 = quinta, 4 jun = quinta
    expect(result).toEqual([utc(2026, 4, 21), utc(2026, 4, 28), utc(2026, 5, 4)])
  })

  it('quando ref É o dayOfWeek alvo, inclui o próprio dia', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'WEEKLY',
        dayOfMonth: null,
        dayOfWeek: 4,
        startDate: utc(2026, 0, 1),
        endDate: null,
      },
      utc(2026, 4, 21), // quinta
      2,
    )
    expect(result).toEqual([utc(2026, 4, 21), utc(2026, 4, 28)])
  })

  it('dayOfWeek inválido → vazio', () => {
    expect(
      calculateNextDueDates(
        { frequency: 'WEEKLY', dayOfMonth: null, dayOfWeek: 7, startDate: utc(2026, 0, 1), endDate: null },
        utc(2026, 4, 1),
        3,
      ),
    ).toEqual([])
  })
})

describe('calculateNextDueDates — QUARTERLY', () => {
  it('start jan, dayOfMonth 15 → gera jan/abr/jul/out', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'QUARTERLY',
        dayOfMonth: 15,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1), // jan
        endDate: null,
      },
      utc(2026, 0, 1),
      4,
    )
    expect(result).toEqual([
      utc(2026, 0, 15),
      utc(2026, 3, 15),
      utc(2026, 6, 15),
      utc(2026, 9, 15),
    ])
  })

  it('respeita endDate em quarterly', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'QUARTERLY',
        dayOfMonth: 15,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1),
        endDate: utc(2026, 5, 30), // até junho
      },
      utc(2026, 0, 1),
      10,
    )
    expect(result).toEqual([utc(2026, 0, 15), utc(2026, 3, 15)])
  })
})

describe('calculateNextDueDates — YEARLY', () => {
  it('anual fixo em mês/dia do startDate', () => {
    const result = calculateNextDueDates(
      {
        frequency: 'YEARLY',
        dayOfMonth: 1,
        dayOfWeek: null,
        startDate: utc(2026, 0, 1), // 1 jan
        endDate: null,
      },
      utc(2026, 0, 1),
      3,
    )
    expect(result).toEqual([utc(2026, 0, 1), utc(2027, 0, 1), utc(2028, 0, 1)])
  })
})
