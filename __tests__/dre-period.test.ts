import { describe, it, expect } from 'vitest'
import {
  calculateComparisonPeriod,
  isValidPeriod,
  formatPeriodLabel,
} from '../lib/dre/period'

describe('calculateComparisonPeriod', () => {
  it('previous_period mensal: mar/2026 → fev/2026', () => {
    const result = calculateComparisonPeriod(
      {
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
        regime: 'competence',
      },
      'previous_period',
    )

    expect(result).not.toBeNull()
    // Mês anterior termina ~ 1ms antes do início de março UTC
    expect(result!.endDate.getTime()).toBeLessThan(
      new Date('2026-03-01T00:00:00.000Z').getTime(),
    )
    // Duração preservada (≈ 30 dias e 23:59:59.999 = 31 dias - 1ms)
    const dur =
      result!.endDate.getTime() - result!.startDate.getTime()
    expect(dur).toBeCloseTo(31 * 24 * 60 * 60 * 1000 - 1, -3)
  })

  it('same_period_last_year: 2026 → 2025 mantendo mês/dia', () => {
    const result = calculateComparisonPeriod(
      {
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
        regime: 'competence',
      },
      'same_period_last_year',
    )

    expect(result!.startDate.getUTCFullYear()).toBe(2025)
    expect(result!.startDate.getUTCMonth()).toBe(2)  // Março
    expect(result!.endDate.getUTCFullYear()).toBe(2025)
    expect(result!.endDate.getUTCMonth()).toBe(2)
  })

  it('previous_year: ano completo anterior', () => {
    const result = calculateComparisonPeriod(
      {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'competence',
      },
      'previous_year',
    )

    expect(result!.startDate.getFullYear()).toBe(2025)
    expect(result!.startDate.getMonth()).toBe(0)   // Janeiro
    expect(result!.startDate.getDate()).toBe(1)
    expect(result!.endDate.getMonth()).toBe(11)    // Dezembro
    expect(result!.endDate.getDate()).toBe(31)
  })

  it('ytd_vs_ytd: 1º jan ano anterior até endDate-1ano', () => {
    const result = calculateComparisonPeriod(
      {
        // Usa local time (new Date(year, month, day)) pra evitar drift UTC
        // ao chamar getDate/getMonth/getFullYear local depois
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 3, 15),
        regime: 'competence',
      },
      'ytd_vs_ytd',
    )

    expect(result!.startDate.getFullYear()).toBe(2025)
    expect(result!.startDate.getMonth()).toBe(0)
    expect(result!.startDate.getDate()).toBe(1)
    expect(result!.endDate.getFullYear()).toBe(2025)
    expect(result!.endDate.getMonth()).toBe(3)   // Abril
    expect(result!.endDate.getDate()).toBe(15)
  })

  it('none retorna null', () => {
    const result = calculateComparisonPeriod(
      {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'competence',
      },
      'none',
    )

    expect(result).toBeNull()
  })

  it('custom retorna null (caller resolve)', () => {
    const result = calculateComparisonPeriod(
      {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'competence',
      },
      'custom',
    )

    expect(result).toBeNull()
  })

  it('Mantém regime do período original', () => {
    const result = calculateComparisonPeriod(
      {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'cash',
      },
      'previous_period',
    )

    expect(result!.regime).toBe('cash')
  })
})

describe('isValidPeriod', () => {
  it('Período válido', () => {
    expect(
      isValidPeriod({
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31'),
        regime: 'competence',
      }),
    ).toBe(true)
  })

  it('startDate > endDate inválido', () => {
    expect(
      isValidPeriod({
        startDate: new Date('2026-03-31'),
        endDate: new Date('2026-03-01'),
        regime: 'competence',
      }),
    ).toBe(false)
  })

  it('Mesmo dia válido', () => {
    expect(
      isValidPeriod({
        startDate: new Date('2026-03-15'),
        endDate: new Date('2026-03-15'),
        regime: 'competence',
      }),
    ).toBe(true)
  })

  it('Data inválida (NaN) detectada', () => {
    expect(
      isValidPeriod({
        startDate: new Date('texto-invalido'),
        endDate: new Date('2026-03-31'),
        regime: 'competence',
      }),
    ).toBe(false)
  })
})

describe('formatPeriodLabel', () => {
  it('Mês completo: "Março 2026"', () => {
    const label = formatPeriodLabel({
      startDate: new Date(2026, 2, 1, 0, 0, 0, 0),
      endDate: new Date(2026, 2, 31, 23, 59, 59, 999),
      regime: 'competence',
    })
    expect(label).toBe('Março 2026')
  })

  it('Ano completo: "2026"', () => {
    const label = formatPeriodLabel({
      startDate: new Date(2026, 0, 1, 0, 0, 0, 0),
      endDate: new Date(2026, 11, 31, 23, 59, 59, 999),
      regime: 'competence',
    })
    expect(label).toBe('2026')
  })

  it('Período custom: "01/03/2026 a 15/03/2026"', () => {
    const label = formatPeriodLabel({
      startDate: new Date(2026, 2, 1),
      endDate: new Date(2026, 2, 15),
      regime: 'competence',
    })
    expect(label).toBe('01/03/2026 a 15/03/2026')
  })

  it('Mesmo dia: data única', () => {
    const label = formatPeriodLabel({
      startDate: new Date(2026, 2, 15, 0, 0, 0),
      endDate: new Date(2026, 2, 15, 23, 59, 59),
      regime: 'competence',
    })
    expect(label).toBe('15/03/2026')
  })

  it('Fevereiro de ano comum: 28 dias', () => {
    const label = formatPeriodLabel({
      startDate: new Date(2025, 1, 1, 0, 0, 0, 0),
      endDate: new Date(2025, 1, 28, 23, 59, 59, 999),
      regime: 'competence',
    })
    expect(label).toBe('Fevereiro 2025')
  })
})
