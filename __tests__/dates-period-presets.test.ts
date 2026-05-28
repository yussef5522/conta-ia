// Hotfix 5.0.4.0c1-fix — Testes dos helpers de período + presets + inferMode.

import { describe, it, expect } from 'vitest'
import {
  PRESETS,
  findPreset,
  inferMode,
  validatePeriodLimit,
  startOfMonthUTC,
  endOfMonthUTC,
  startOfQuarterUTC,
  endOfQuarterUTC,
  startOfYearUTC,
  endOfYearUTC,
  subMonthsUTC,
  subYearsUTC,
  addMonthsUTC,
  differenceInMonthsUTC,
  formatISODateUTC,
  parsePeriodInput,
} from '@/lib/dates/period-presets'

// 15 de Maio de 2026 (UTC) — reference fixa pra testes determinísticos
const REF = new Date(Date.UTC(2026, 4, 15))

describe('Helpers UTC nativos', () => {
  it('startOfMonthUTC retorna dia 1 às 00:00:00 UTC', () => {
    expect(formatISODateUTC(startOfMonthUTC(REF))).toBe('2026-05-01')
  })

  it('endOfMonthUTC retorna último dia 23:59:59.999 UTC', () => {
    const eom = endOfMonthUTC(REF)
    expect(formatISODateUTC(eom)).toBe('2026-05-31')
    expect(eom.getUTCHours()).toBe(23)
  })

  it('startOfQuarterUTC abr/2026 retorna abril (Q2)', () => {
    expect(formatISODateUTC(startOfQuarterUTC(REF))).toBe('2026-04-01')
  })

  it('endOfQuarterUTC abr/2026 retorna jun/30', () => {
    expect(formatISODateUTC(endOfQuarterUTC(REF))).toBe('2026-06-30')
  })

  it('startOfQuarterUTC janeiro retorna Q1', () => {
    const jan = new Date(Date.UTC(2026, 0, 15))
    expect(formatISODateUTC(startOfQuarterUTC(jan))).toBe('2026-01-01')
  })

  it('startOfQuarterUTC outubro retorna Q4', () => {
    const out = new Date(Date.UTC(2026, 9, 15))
    expect(formatISODateUTC(startOfQuarterUTC(out))).toBe('2026-10-01')
  })

  it('startOfYearUTC retorna 1º jan', () => {
    expect(formatISODateUTC(startOfYearUTC(REF))).toBe('2026-01-01')
  })

  it('endOfYearUTC retorna 31 dez', () => {
    expect(formatISODateUTC(endOfYearUTC(REF))).toBe('2026-12-31')
  })

  it('subYearsUTC subtrai 1 ano preservando mês/dia', () => {
    expect(formatISODateUTC(subYearsUTC(REF, 1))).toBe('2025-05-15')
  })

  it('subMonthsUTC volta meses', () => {
    expect(formatISODateUTC(subMonthsUTC(REF, 3))).toBe('2026-02-01')
  })

  it('addMonthsUTC virada de ano', () => {
    const dez = new Date(Date.UTC(2026, 11, 1))
    expect(formatISODateUTC(addMonthsUTC(dez, 1))).toBe('2027-01-01')
  })

  it('differenceInMonthsUTC simples', () => {
    const may = new Date(Date.UTC(2026, 4, 1))
    const jul = new Date(Date.UTC(2026, 6, 1))
    expect(differenceInMonthsUTC(jul, may)).toBe(2)
  })

  it('differenceInMonthsUTC ano inteiro', () => {
    const jan26 = new Date(Date.UTC(2026, 0, 1))
    const jan27 = new Date(Date.UTC(2027, 0, 1))
    expect(differenceInMonthsUTC(jan27, jan26)).toBe(12)
  })

  it('differenceInMonthsUTC com dia parcial subtrai 1', () => {
    // 31/Maio até 15/Junho = menos de 1 mês completo
    const start = new Date(Date.UTC(2026, 4, 31))
    const end = new Date(Date.UTC(2026, 5, 15))
    expect(differenceInMonthsUTC(end, start)).toBe(0)
  })
})

describe('parsePeriodInput — aceita YYYY-MM e YYYY-MM-DD', () => {
  it('YYYY-MM vira dia 1', () => {
    const d = parsePeriodInput('2026-05')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(4)
    expect(d.getUTCDate()).toBe(1)
  })

  it('YYYY-MM-DD parseia direto', () => {
    const d = parsePeriodInput('2026-05-15')
    expect(d.getUTCDate()).toBe(15)
  })

  it('formato inválido lança', () => {
    expect(() => parsePeriodInput('05/2026')).toThrow()
    expect(() => parsePeriodInput('xyz')).toThrow()
  })
})

describe('PRESETS', () => {
  it('tem 7 presets', () => {
    expect(PRESETS).toHaveLength(7)
  })

  it('findPreset retorna definição correta', () => {
    expect(findPreset('month-vs-prev')?.label).toContain('Mês atual vs Mês anterior')
    expect(findPreset('nao-existe')).toBeUndefined()
  })

  it('month-vs-prev: maio/2026 vs abril/2026', () => {
    const r = findPreset('month-vs-prev')!.compute(REF)
    expect(r.startDate).toBe('2026-05-01')
    expect(r.endDate).toBe('2026-05-31')
    expect(r.compareStartDate).toBe('2026-04-01')
    expect(r.compareEndDate).toBe('2026-04-30')
  })

  it('month-vs-yoy: maio/2026 vs maio/2025 (YoY)', () => {
    const r = findPreset('month-vs-yoy')!.compute(REF)
    expect(r.startDate).toBe('2026-05-01')
    expect(r.endDate).toBe('2026-05-31')
    expect(r.compareStartDate).toBe('2025-05-01')
    expect(r.compareEndDate).toBe('2025-05-31')
  })

  it('quarter-vs-prev: Q2/2026 vs Q1/2026', () => {
    const r = findPreset('quarter-vs-prev')!.compute(REF)
    expect(r.startDate).toBe('2026-04-01')
    expect(r.endDate).toBe('2026-06-30')
    expect(r.compareStartDate).toBe('2026-01-01')
    expect(r.compareEndDate).toBe('2026-03-31')
  })

  it('year-vs-prev: 2026 vs 2025', () => {
    const r = findPreset('year-vs-prev')!.compute(REF)
    expect(r.startDate).toBe('2026-01-01')
    expect(r.endDate).toBe('2026-12-31')
    expect(r.compareStartDate).toBe('2025-01-01')
    expect(r.compareEndDate).toBe('2025-12-31')
  })

  it('last-3m a partir de maio: Mar→Mai (3 meses)', () => {
    const r = findPreset('last-3m')!.compute(REF)
    expect(r.startDate).toBe('2026-03-01')
    expect(r.endDate).toBe('2026-05-31')
    expect(r.compareStartDate).toBeUndefined()
    expect(r.compareEndDate).toBeUndefined()
  })

  it('last-6m: Dez/2025 → Mai/2026', () => {
    const r = findPreset('last-6m')!.compute(REF)
    expect(r.startDate).toBe('2025-12-01')
    expect(r.endDate).toBe('2026-05-31')
  })

  it('last-12m: Jun/2025 → Mai/2026', () => {
    const r = findPreset('last-12m')!.compute(REF)
    expect(r.startDate).toBe('2025-06-01')
    expect(r.endDate).toBe('2026-05-31')
  })

  it('presets last-* não geram comparePeriod', () => {
    for (const id of ['last-3m', 'last-6m', 'last-12m'] as const) {
      const p = findPreset(id)!
      expect(p.isComparative).toBe(false)
      const r = p.compute(REF)
      expect(r.compareStartDate).toBeUndefined()
    }
  })

  it('presets comparative têm 4 datas', () => {
    for (const id of [
      'month-vs-prev',
      'month-vs-yoy',
      'quarter-vs-prev',
      'year-vs-prev',
    ] as const) {
      const p = findPreset(id)!
      expect(p.isComparative).toBe(true)
      const r = p.compute(REF)
      expect(r.compareStartDate).toBeDefined()
      expect(r.compareEndDate).toBeDefined()
    }
  })
})

describe('inferMode', () => {
  it('comparative quando há compareStartDate + compareEndDate', () => {
    const m = inferMode({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      compareStartDate: '2026-04-01',
      compareEndDate: '2026-04-30',
    })
    expect(m).toBe('comparative')
  })

  it('evolution com 3+ meses sem compare', () => {
    const m = inferMode({
      startDate: '2026-03-01',
      endDate: '2026-05-31',
    })
    expect(m).toBe('evolution')
  })

  it('evolution com 12 meses', () => {
    const m = inferMode({
      startDate: '2025-06-01',
      endDate: '2026-05-31',
    })
    expect(m).toBe('evolution')
  })

  it('single com 1 mês sem compare', () => {
    const m = inferMode({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    })
    expect(m).toBe('single')
  })

  it('single com 2 meses sem compare', () => {
    const m = inferMode({
      startDate: '2026-04-01',
      endDate: '2026-05-31',
    })
    expect(m).toBe('single')
  })

  it('compare-half (só compareStart sem compareEnd) NÃO vira comparative', () => {
    const m = inferMode({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      compareStartDate: '2026-04-01',
    })
    expect(m).toBe('single')
  })
})

describe('validatePeriodLimit', () => {
  it('OK pra <= 12 meses', () => {
    const r = validatePeriodLimit('2026-01-01', '2026-12-31', 12)
    expect(r.ok).toBe(true)
  })

  it('rejeita > 12 meses', () => {
    const r = validatePeriodLimit('2025-01-01', '2026-05-31', 12)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('máximo')
  })

  it('rejeita endDate <= startDate', () => {
    const r = validatePeriodLimit('2026-05-15', '2026-05-01', 12)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('depois')
  })

  it('aceita 1 dia (período mínimo)', () => {
    const r = validatePeriodLimit('2026-05-01', '2026-05-02', 12)
    expect(r.ok).toBe(true)
  })

  it('threshold custom 6 meses', () => {
    const r = validatePeriodLimit('2026-01-01', '2026-09-01', 6)
    expect(r.ok).toBe(false)
  })

  it('aceita YYYY-MM (legacy)', () => {
    const r = validatePeriodLimit('2026-04', '2026-05', 12)
    expect(r.ok).toBe(true)
  })
})
