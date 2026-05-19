// Tipos + helpers de normalização — Sprint 1.7.

import { describe, it, expect } from 'vitest'
import {
  COUPON_CODE_REGEX,
  normalizeCouponCode,
  isValidCouponCode,
} from '@/lib/coupons/types'

describe('normalizeCouponCode', () => {
  it('uppercase + trim', () => {
    expect(normalizeCouponCode('  fundador100 ')).toBe('FUNDADOR100')
  })

  it('idempotente em código já válido', () => {
    expect(normalizeCouponCode('FUNDADOR100')).toBe('FUNDADOR100')
  })

  it('string vazia retorna string vazia', () => {
    expect(normalizeCouponCode('   ')).toBe('')
  })
})

describe('COUPON_CODE_REGEX / isValidCouponCode', () => {
  it('aceita 4-20 chars alfanuméricos maiúsculos', () => {
    expect(isValidCouponCode('FUND')).toBe(true)
    expect(isValidCouponCode('FUNDADOR100')).toBe(true)
    expect(isValidCouponCode('A1B2C3D4E5F6G7H8I9J0')).toBe(true) // 20
  })

  it('rejeita < 4 chars', () => {
    expect(isValidCouponCode('ABC')).toBe(false)
  })

  it('rejeita > 20 chars', () => {
    expect(isValidCouponCode('A'.repeat(21))).toBe(false)
  })

  it('rejeita minúsculas', () => {
    expect(isValidCouponCode('fundador')).toBe(false)
  })

  it('rejeita espaços / hífens / símbolos', () => {
    expect(isValidCouponCode('FUND ADOR')).toBe(false)
    expect(isValidCouponCode('FUND-100')).toBe(false)
    expect(isValidCouponCode('FUND@100')).toBe(false)
  })

  it('regex exportado existe', () => {
    expect(COUPON_CODE_REGEX).toBeInstanceOf(RegExp)
  })
})
