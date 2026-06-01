// Sprint Engine de Assinatura FATIA 1 — bônus de cupom → dias de trial

import { describe, expect, test } from 'vitest'
import { couponToTrialBonusDays } from '@/lib/subscription/apply-coupon-bonus'

describe('couponToTrialBonusDays (conecta FREE_MONTHS órfão)', () => {
  test('FREE_MONTHS=1 → 30 dias', () => {
    expect(couponToTrialBonusDays('FREE_MONTHS', 1)).toBe(30)
  })
  test('FREE_MONTHS=2 → 60 dias', () => {
    expect(couponToTrialBonusDays('FREE_MONTHS', 2)).toBe(60)
  })
  test('FREE_MONTHS=12 → 360 dias', () => {
    expect(couponToTrialBonusDays('FREE_MONTHS', 12)).toBe(360)
  })
  test('PERCENTAGE não afeta trial', () => {
    expect(couponToTrialBonusDays('PERCENTAGE', 100)).toBe(0)
  })
  test('FIXED_AMOUNT não afeta trial', () => {
    expect(couponToTrialBonusDays('FIXED_AMOUNT', 50)).toBe(0)
  })
  test('FREE_MONTHS sem valor → 0', () => {
    expect(couponToTrialBonusDays('FREE_MONTHS', null)).toBe(0)
    expect(couponToTrialBonusDays('FREE_MONTHS', undefined)).toBe(0)
    expect(couponToTrialBonusDays('FREE_MONTHS', 0)).toBe(0)
  })
  test('FREE_MONTHS negativo → 0 (defesa)', () => {
    expect(couponToTrialBonusDays('FREE_MONTHS', -3)).toBe(0)
  })
})
