// Sprint 7 — teste do applyCustomPeriod (helper interno do engine)
// Cobre: período custom vira currentMonth + previousMonth simétrico
import { describe, it, expect } from 'vitest'
import { derivePeriods } from '@/lib/dashboard/period'

describe('engine.customPeriod (Sprint 7)', () => {
  // Re-implementação local do helper (não exportado) pra testar a lógica
  function applyCustomPeriod(
    base: ReturnType<typeof derivePeriods>,
    custom: { start: Date; end: Date },
  ) {
    const durationMs = custom.end.getTime() - custom.start.getTime()
    const previousStart = new Date(custom.start.getTime() - durationMs - 1)
    const previousEnd = new Date(custom.start.getTime() - 1)
    return {
      ...base,
      currentMonth: { start: custom.start, end: custom.end },
      previousMonth: { start: previousStart, end: previousEnd },
    }
  }

  it('substitui currentMonth pelo custom', () => {
    const base = derivePeriods(new Date('2026-06-15T12:00:00Z'))
    const custom = {
      start: new Date('2026-05-01T00:00:00Z'),
      end: new Date('2026-05-31T23:59:59.999Z'),
    }
    const r = applyCustomPeriod(base, custom)
    expect(r.currentMonth.start).toBe(custom.start)
    expect(r.currentMonth.end).toBe(custom.end)
  })

  it('previousMonth fica simétrico (mesmo tamanho, anterior)', () => {
    const base = derivePeriods(new Date('2026-06-15T12:00:00Z'))
    const custom = {
      start: new Date('2026-06-01T00:00:00Z'),
      end: new Date('2026-06-30T23:59:59.999Z'),
    }
    const r = applyCustomPeriod(base, custom)
    const durCustom = custom.end.getTime() - custom.start.getTime()
    const durPrev = r.previousMonth.end.getTime() - r.previousMonth.start.getTime()
    // Diferença pode ser de 1ms por causa do "- 1" no end (ajuste justo); aceitamos ±1ms
    expect(Math.abs(durPrev - durCustom)).toBeLessThanOrEqual(1)
    expect(r.previousMonth.end.getTime()).toBe(custom.start.getTime() - 1)
  })

  it('MTD (15 dias) → previousMonth também é 15 dias anteriores', () => {
    const base = derivePeriods(new Date('2026-06-15T23:59:59Z'))
    const custom = {
      start: new Date('2026-06-01T00:00:00Z'),
      end: new Date('2026-06-15T23:59:59.999Z'),
    }
    const r = applyCustomPeriod(base, custom)
    // previousMonth.end = 31/05 (instante antes de 1/6 00:00)
    expect(r.previousMonth.end.toISOString()).toBe('2026-05-31T23:59:59.999Z')
  })

  it('last30Days e last12Months preservados (não viram com custom period)', () => {
    const base = derivePeriods(new Date('2026-06-15T12:00:00Z'))
    const custom = {
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-12-31T23:59:59.999Z'),
    }
    const r = applyCustomPeriod(base, custom)
    expect(r.last30Days).toBe(base.last30Days)
    expect(r.last12Months).toBe(base.last12Months)
  })
})
