import { describe, it, expect } from 'vitest'
import {
  calculatePresetDates,
  detectPreset,
  PRESET_LABELS,
  PRESET_ORDER,
} from '../lib/dre/presets'

describe('calculatePresetDates', () => {
  // 2026-05-15 local — usa construtor (year, month, day) pra evitar drift UTC
  const today = new Date(2026, 4, 15, 12, 0, 0, 0)

  it('current_month: 1º até último dia do mês', () => {
    const r = calculatePresetDates('current_month', today)
    expect(r.startDate.getDate()).toBe(1)
    expect(r.startDate.getMonth()).toBe(4) // Maio
    expect(r.endDate.getDate()).toBe(31)
    expect(r.endDate.getMonth()).toBe(4)
  })

  it('previous_month: mês anterior completo', () => {
    const r = calculatePresetDates('previous_month', today)
    expect(r.startDate.getMonth()).toBe(3) // Abril
    expect(r.startDate.getDate()).toBe(1)
    expect(r.endDate.getMonth()).toBe(3) // Abril
    expect(r.endDate.getDate()).toBe(30)
  })

  it('current_quarter: Q2 (Abr-Jun)', () => {
    const r = calculatePresetDates('current_quarter', today)
    expect(r.startDate.getMonth()).toBe(3)
    expect(r.endDate.getMonth()).toBe(5)
  })

  it('current_year: ano completo', () => {
    const r = calculatePresetDates('current_year', today)
    expect(r.startDate.getFullYear()).toBe(2026)
    expect(r.startDate.getMonth()).toBe(0)
    expect(r.endDate.getMonth()).toBe(11)
  })

  it('previous_year: ano anterior completo', () => {
    const r = calculatePresetDates('previous_year', today)
    expect(r.startDate.getFullYear()).toBe(2025)
    expect(r.endDate.getFullYear()).toBe(2025)
  })

  it('last_30_days: 30 dias atrás até hoje', () => {
    const r = calculatePresetDates('last_30_days', today)
    // start = today - 30d 00:00, end = today 23:59:59.999 → 30 dias completos
    // (Math.floor descarta o "dia parcial" até 23:59 do dia atual)
    const diffDays = Math.floor(
      (r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    expect(diffDays).toBe(30)
  })

  it('last_90_days: 90 dias atrás até hoje', () => {
    const r = calculatePresetDates('last_90_days', today)
    const diffDays = Math.floor(
      (r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    expect(diffDays).toBe(90)
  })

  it('custom: fallback é mês atual', () => {
    const r = calculatePresetDates('custom', today)
    expect(r.startDate.getDate()).toBe(1)
    expect(r.startDate.getMonth()).toBe(4)
  })

  it('current_quarter Q1 (Janeiro)', () => {
    const r = calculatePresetDates('current_quarter', new Date(2026, 1, 15))
    expect(r.startDate.getMonth()).toBe(0)
    expect(r.endDate.getMonth()).toBe(2)
  })

  it('current_quarter Q4 (Outubro-Dezembro)', () => {
    const r = calculatePresetDates('current_quarter', new Date(2026, 10, 15))
    expect(r.startDate.getMonth()).toBe(9)
    expect(r.endDate.getMonth()).toBe(11)
  })

  it('previous_month em Janeiro: Dezembro do ano anterior', () => {
    const r = calculatePresetDates('previous_month', new Date(2026, 0, 15))
    expect(r.startDate.getMonth()).toBe(11)
    expect(r.startDate.getFullYear()).toBe(2025)
    expect(r.endDate.getMonth()).toBe(11)
    expect(r.endDate.getDate()).toBe(31)
  })

  it('PRESET_ORDER inclui custom no final', () => {
    expect(PRESET_ORDER[PRESET_ORDER.length - 1]).toBe('custom')
  })

  it('PRESET_LABELS tem todas as keys', () => {
    for (const p of PRESET_ORDER) {
      expect(PRESET_LABELS[p]).toBeTruthy()
    }
  })
})

describe('detectPreset', () => {
  const today = new Date(2026, 4, 15, 12, 0, 0, 0)

  it('detecta current_month', () => {
    const dates = calculatePresetDates('current_month', today)
    expect(detectPreset(dates.startDate, dates.endDate, today)).toBe('current_month')
  })

  it('detecta previous_year', () => {
    const dates = calculatePresetDates('previous_year', today)
    expect(detectPreset(dates.startDate, dates.endDate, today)).toBe('previous_year')
  })

  it('retorna custom se não bater com nenhum preset', () => {
    const result = detectPreset(
      new Date(2026, 2, 12),
      new Date(2026, 3, 22),
      today,
    )
    expect(result).toBe('custom')
  })
})
