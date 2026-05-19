// Tipos compartilhados de cupons — Sprint 1.7.

export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_MONTHS'

export type CouponStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'DEACTIVATED'

export type CouponInvalidReason =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'PAUSED'
  | 'DEACTIVATED'
  | 'NOT_YET_VALID'
  | 'ALREADY_USED'

export interface CouponSnapshot {
  code: string
  type: CouponType
  // Decimal vira string no Prisma client SQLite. Caller faz Number() se precisar.
  value: string | number
  freeMonths: number | null
  description: string | null
}

export const COUPON_CODE_REGEX = /^[A-Z0-9]{4,20}$/

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function isValidCouponCode(code: string): boolean {
  return COUPON_CODE_REGEX.test(code)
}
