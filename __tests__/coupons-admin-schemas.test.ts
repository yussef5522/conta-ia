// Schemas Zod dos endpoints admin de cupons — Sprint 1.7.

import { describe, it, expect } from 'vitest'
import {
  createCouponSchema,
  updateCouponSchema,
  listCouponsQuerySchema,
  validatePublicSchema,
} from '@/lib/coupons/admin-schemas'

describe('createCouponSchema', () => {
  const valid = {
    code: 'FUNDADOR100',
    type: 'PERCENTAGE' as const,
    value: 100,
    maxUsesPerUser: 1,
  }

  it('aceita PERCENTAGE 100%', () => {
    const r = createCouponSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('REJEITA PERCENTAGE > 100', () => {
    const r = createCouponSchema.safeParse({ ...valid, value: 150 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.errors[0].message).toMatch(/100%/)
    }
  })

  it('aceita FIXED_AMOUNT 250.50', () => {
    const r = createCouponSchema.safeParse({
      ...valid,
      type: 'FIXED_AMOUNT',
      value: 250.5,
    })
    expect(r.success).toBe(true)
  })

  it('FREE_MONTHS EXIGE freeMonths > 0', () => {
    const r = createCouponSchema.safeParse({
      ...valid,
      type: 'FREE_MONTHS',
      value: 0,
    })
    expect(r.success).toBe(false)
  })

  it('FREE_MONTHS aceita com freeMonths>0', () => {
    const r = createCouponSchema.safeParse({
      ...valid,
      type: 'FREE_MONTHS',
      value: 0,
      freeMonths: 3,
    })
    expect(r.success).toBe(true)
  })

  it('normaliza code pra UPPERCASE + trim', () => {
    const r = createCouponSchema.safeParse({ ...valid, code: '  black50  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.code).toBe('BLACK50')
  })

  it('rejeita code com símbolos', () => {
    const r = createCouponSchema.safeParse({ ...valid, code: 'FUND-100' })
    expect(r.success).toBe(false)
  })

  it('rejeita code < 4 chars', () => {
    const r = createCouponSchema.safeParse({ ...valid, code: 'ABC' })
    expect(r.success).toBe(false)
  })

  it('rejeita value negativo', () => {
    const r = createCouponSchema.safeParse({ ...valid, value: -10 })
    expect(r.success).toBe(false)
  })

  it('validUntil <= validFrom é rejeitado', () => {
    const r = createCouponSchema.safeParse({
      ...valid,
      validFrom: new Date('2026-06-01'),
      validUntil: new Date('2026-05-01'),
    })
    expect(r.success).toBe(false)
  })

  it('aceita maxUses opcional ilimitado', () => {
    const r = createCouponSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.maxUses).toBeUndefined()
    }
  })

  it('default maxUsesPerUser=1', () => {
    const r = createCouponSchema.safeParse({
      code: 'TEST10',
      type: 'PERCENTAGE',
      value: 10,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.maxUsesPerUser).toBe(1)
  })
})

describe('updateCouponSchema', () => {
  it('aceita patch parcial', () => {
    const r = updateCouponSchema.safeParse({ description: 'nova descrição' })
    expect(r.success).toBe(true)
  })

  it('REJEITA tentativa de mudar code (strict)', () => {
    const r = updateCouponSchema.safeParse({ code: 'OUTRO100' })
    expect(r.success).toBe(false)
  })

  it('REJEITA tentativa de mudar type (strict)', () => {
    const r = updateCouponSchema.safeParse({ type: 'FIXED_AMOUNT' })
    expect(r.success).toBe(false)
  })

  it('REJEITA tentativa de mudar value (strict)', () => {
    const r = updateCouponSchema.safeParse({ value: 50 })
    expect(r.success).toBe(false)
  })

  it('aceita maxUses null pra desfazer limite', () => {
    const r = updateCouponSchema.safeParse({ maxUses: null })
    expect(r.success).toBe(true)
  })
})

describe('listCouponsQuerySchema', () => {
  it('defaults razoáveis quando vazio', () => {
    const r = listCouponsQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.status).toBe('ALL')
      expect(r.data.type).toBe('ALL')
      expect(r.data.page).toBe(1)
      expect(r.data.pageSize).toBe(20)
    }
  })

  it('q vira UPPERCASE', () => {
    const r = listCouponsQuerySchema.safeParse({ q: 'fund' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.q).toBe('FUND')
  })

  it('pageSize tem cap de 100', () => {
    const r = listCouponsQuerySchema.safeParse({ pageSize: 500 })
    expect(r.success).toBe(false)
  })
})

describe('validatePublicSchema', () => {
  it('aceita code válido + uppercase', () => {
    const r = validatePublicSchema.safeParse({ code: 'fundador100' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.code).toBe('FUNDADOR100')
  })

  it('rejeita code com 3 chars', () => {
    const r = validatePublicSchema.safeParse({ code: 'AB1' })
    expect(r.success).toBe(false)
  })

  it('rejeita ausência de code', () => {
    const r = validatePublicSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})
