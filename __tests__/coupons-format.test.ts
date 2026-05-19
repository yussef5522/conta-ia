// Helpers PUROS de formatação — Sprint 1.7.

import { describe, it, expect } from 'vitest'
import {
  formatCouponValue,
  couponTypeLabel,
  couponStatusLabel,
  couponStatusColor,
  couponTypeColor,
  formatUsage,
  isKnownCouponType,
  isKnownCouponStatus,
} from '@/lib/coupons/format'

describe('formatCouponValue', () => {
  it('PERCENTAGE inteiro → "100%"', () => {
    expect(formatCouponValue('PERCENTAGE', 100, null)).toBe('100%')
    expect(formatCouponValue('PERCENTAGE', 25, null)).toBe('25%')
  })

  it('PERCENTAGE decimal → 1 casa', () => {
    expect(formatCouponValue('PERCENTAGE', 12.5, null)).toBe('12.5%')
  })

  it('FIXED_AMOUNT formato pt-BR R$', () => {
    expect(formatCouponValue('FIXED_AMOUNT', 49.9, null)).toContain('49,90')
    expect(formatCouponValue('FIXED_AMOUNT', 49.9, null)).toContain('R$')
  })

  it('FREE_MONTHS singular vs plural', () => {
    expect(formatCouponValue('FREE_MONTHS', 0, 1)).toBe('1 mês grátis')
    expect(formatCouponValue('FREE_MONTHS', 0, 3)).toBe('3 meses grátis')
    expect(formatCouponValue('FREE_MONTHS', 0, 12)).toBe('12 meses grátis')
  })

  it('FREE_MONTHS com freeMonths null → "0 meses grátis"', () => {
    expect(formatCouponValue('FREE_MONTHS', 0, null)).toBe('0 meses grátis')
  })

  it('aceita value como string (Decimal serializado)', () => {
    expect(formatCouponValue('PERCENTAGE', '100', null)).toBe('100%')
  })
})

describe('labels pt-BR', () => {
  it('couponTypeLabel cobre 3 tipos', () => {
    expect(couponTypeLabel('PERCENTAGE')).toBe('Porcentagem')
    expect(couponTypeLabel('FIXED_AMOUNT')).toBe('Valor fixo')
    expect(couponTypeLabel('FREE_MONTHS')).toBe('Meses grátis')
  })

  it('couponStatusLabel cobre 5 status', () => {
    expect(couponStatusLabel('ACTIVE')).toBe('Ativo')
    expect(couponStatusLabel('PAUSED')).toBe('Pausado')
    expect(couponStatusLabel('EXPIRED')).toBe('Expirado')
    expect(couponStatusLabel('EXHAUSTED')).toBe('Exaurido')
    expect(couponStatusLabel('DEACTIVATED')).toBe('Desativado')
  })

  it('fallback retorna a string crua se desconhecida', () => {
    expect(couponTypeLabel('SOMETHING')).toBe('SOMETHING')
    expect(couponStatusLabel('FOO')).toBe('FOO')
  })
})

describe('couponStatusColor', () => {
  it('retorna 3 chaves CSS pra cada status', () => {
    for (const s of ['ACTIVE', 'PAUSED', 'EXPIRED', 'EXHAUSTED', 'DEACTIVATED']) {
      const c = couponStatusColor(s)
      expect(c.bg).toBeTruthy()
      expect(c.border).toBeTruthy()
      expect(c.text).toBeTruthy()
    }
  })

  it('ACTIVE = verde (Conta IA #5DCAA5)', () => {
    expect(couponStatusColor('ACTIVE').text).toBe('#5DCAA5')
  })
})

describe('couponTypeColor', () => {
  it('cada tipo retorna bg/text', () => {
    expect(couponTypeColor('PERCENTAGE').text).toBe('#a5b4fc')
    expect(couponTypeColor('FIXED_AMOUNT').text).toBe('#86efac')
    expect(couponTypeColor('FREE_MONTHS').text).toBe('#d8b4fe')
  })
})

describe('formatUsage', () => {
  it('com maxUses', () => {
    expect(formatUsage(15, 100)).toBe('15 / 100')
    expect(formatUsage(0, 100)).toBe('0 / 100')
  })

  it('sem maxUses (null) usa ∞', () => {
    expect(formatUsage(42, null)).toBe('42 / ∞')
  })
})

describe('type guards', () => {
  it('isKnownCouponType', () => {
    expect(isKnownCouponType('PERCENTAGE')).toBe(true)
    expect(isKnownCouponType('FOO')).toBe(false)
  })

  it('isKnownCouponStatus', () => {
    expect(isKnownCouponStatus('ACTIVE')).toBe(true)
    expect(isKnownCouponStatus('DRAFT')).toBe(false)
  })
})
