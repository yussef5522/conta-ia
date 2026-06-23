// Sprint 7 — helpers period-sp (Sao Paulo timezone)
import { describe, it, expect } from 'vitest'
import {
  addMonths,
  formatPeriodoYM,
  getCurrentMTD,
  getFullMonth,
  isCurrentMonth,
  labelMesAno,
  parsePeriodoYM,
} from '@/lib/dashboard/period-sp'

describe('period-sp', () => {
  describe('parsePeriodoYM', () => {
    it('parseia YYYY-MM válido', () => {
      expect(parsePeriodoYM('2026-06')).toEqual({ year: 2026, month: 5 })
      expect(parsePeriodoYM('2025-01')).toEqual({ year: 2025, month: 0 })
      expect(parsePeriodoYM('2025-12')).toEqual({ year: 2025, month: 11 })
    })

    it('retorna null para input inválido', () => {
      expect(parsePeriodoYM(null)).toBeNull()
      expect(parsePeriodoYM(undefined)).toBeNull()
      expect(parsePeriodoYM('')).toBeNull()
      expect(parsePeriodoYM('2026-13')).toBeNull()
      expect(parsePeriodoYM('2026-00')).toBeNull()
      expect(parsePeriodoYM('foo')).toBeNull()
      expect(parsePeriodoYM('1999-06')).toBeNull() // < 2000 limite
    })
  })

  describe('formatPeriodoYM', () => {
    it('formata corretamente', () => {
      expect(formatPeriodoYM(2026, 5)).toBe('2026-06')
      expect(formatPeriodoYM(2025, 0)).toBe('2025-01')
      expect(formatPeriodoYM(2025, 11)).toBe('2025-12')
    })

    it('round-trip parse → format', () => {
      const parsed = parsePeriodoYM('2026-06')!
      expect(formatPeriodoYM(parsed.year, parsed.month)).toBe('2026-06')
    })
  })

  describe('addMonths', () => {
    it('avança dentro do mesmo ano', () => {
      expect(addMonths(2026, 5, 1)).toEqual({ year: 2026, month: 6 })
      expect(addMonths(2026, 5, -1)).toEqual({ year: 2026, month: 4 })
    })

    it('vira o ano (dez → jan)', () => {
      expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    })

    it('volta o ano (jan → dez)', () => {
      expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
    })

    it('avança N meses (>12)', () => {
      expect(addMonths(2026, 5, 13)).toEqual({ year: 2027, month: 6 })
      expect(addMonths(2026, 5, -13)).toEqual({ year: 2025, month: 4 })
    })
  })

  describe('getFullMonth', () => {
    it('retorna o mês inteiro (1º dia 00:00 → último dia 23:59:59.999)', () => {
      const { start, end } = getFullMonth(2026, 5) // junho 2026
      expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
      expect(end.toISOString()).toBe('2026-06-30T23:59:59.999Z')
    })

    it('fevereiro bissexto', () => {
      const { end } = getFullMonth(2028, 1)
      // 2028 é bissexto (div 4, não 100)
      expect(end.toISOString()).toBe('2028-02-29T23:59:59.999Z')
    })

    it('fevereiro não bissexto', () => {
      const { end } = getFullMonth(2027, 1)
      expect(end.toISOString()).toBe('2027-02-28T23:59:59.999Z')
    })
  })

  describe('getCurrentMTD', () => {
    it('retorna mês corrente em SP com end=now', () => {
      // 15/06/2026 12:00 UTC = 09:00 SP → mês corrente = junho
      const now = new Date('2026-06-15T12:00:00.000Z')
      const r = getCurrentMTD(now)
      expect(r.year).toBe(2026)
      expect(r.month).toBe(5) // junho (0-indexed)
      expect(r.start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
      expect(r.end.getTime()).toBe(now.getTime())
    })

    it('em UTC 02:00 ainda é dia anterior em SP (UTC-3) → mês pode mudar', () => {
      // 01/07/2026 02:00 UTC = 30/06/2026 23:00 SP → SP ainda em junho
      const now = new Date('2026-07-01T02:00:00.000Z')
      const r = getCurrentMTD(now)
      expect(r.year).toBe(2026)
      expect(r.month).toBe(5) // junho ainda (em SP)
    })

    it('em UTC 13:00 já virou mês em SP (10:00 SP)', () => {
      const now = new Date('2026-07-01T13:00:00.000Z')
      const r = getCurrentMTD(now)
      expect(r.year).toBe(2026)
      expect(r.month).toBe(6) // julho
    })
  })

  describe('isCurrentMonth', () => {
    it('true se ano+mês = atual em SP', () => {
      const now = new Date('2026-06-15T12:00:00.000Z')
      expect(isCurrentMonth(2026, 5, now)).toBe(true)
    })

    it('false se outro mês', () => {
      const now = new Date('2026-06-15T12:00:00.000Z')
      expect(isCurrentMonth(2026, 4, now)).toBe(false)
      expect(isCurrentMonth(2026, 6, now)).toBe(false)
      expect(isCurrentMonth(2025, 5, now)).toBe(false)
    })
  })

  describe('labelMesAno', () => {
    it('retorna nome em português', () => {
      expect(labelMesAno(2026, 0)).toBe('Janeiro 2026')
      expect(labelMesAno(2026, 5)).toBe('Junho 2026')
      expect(labelMesAno(2026, 11)).toBe('Dezembro 2026')
    })
  })
})
