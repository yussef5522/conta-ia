// Validação de cupom — Sprint 1.7.
//
// Separação: decideCouponValidity (PURA, testável sem DB) +
// validateCoupon (lê do Prisma e delega).

import { prisma } from '@/lib/db'
import { normalizeCouponCode, type CouponInvalidReason } from './types'

export type CouponValidationResult =
  | {
      valid: true
      coupon: {
        id: string
        code: string
        type: string
        value: number
        freeMonths: number | null
        description: string | null
        maxUses: number | null
        currentUses: number
        maxUsesPerUser: number
        validUntil: Date | null
      }
    }
  | { valid: false; reason: CouponInvalidReason }

// Shape mínimo pra decisão (independente do Prisma client)
export interface CouponDecisionInput {
  status: string
  validFrom: Date
  validUntil: Date | null
  maxUses: number | null
  currentUses: number
}

// Função PURA — não toca DB, totalmente determinística.
// Retorna `reason` (invalid) ou null (válido até aqui).
export function decideCouponValidity(
  coupon: CouponDecisionInput,
  now: Date = new Date(),
): CouponInvalidReason | null {
  if (coupon.status === 'DEACTIVATED') return 'DEACTIVATED'
  if (coupon.status === 'PAUSED') return 'PAUSED'
  if (coupon.status === 'EXHAUSTED') return 'EXHAUSTED'
  if (coupon.validFrom > now) return 'NOT_YET_VALID'
  if (coupon.validUntil && coupon.validUntil < now) return 'EXPIRED'
  if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
    return 'EXHAUSTED'
  }
  return null
}

// Valida 6 razões + retorna cupom snapshot (sem dados sensíveis pra resposta pública).
export async function validateCoupon(
  rawCode: string,
  userId?: string,
  now: Date = new Date(),
): Promise<CouponValidationResult> {
  const code = normalizeCouponCode(rawCode)
  if (!code) {
    return { valid: false, reason: 'NOT_FOUND' }
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code },
  })

  if (!coupon) return { valid: false, reason: 'NOT_FOUND' }

  const decision = decideCouponValidity(coupon, now)
  if (decision !== null) {
    return { valid: false, reason: decision }
  }

  // Se userId fornecido, checa redemption prévia (maxUsesPerUser=1 enforce
  // via @@unique no schema; aqui só pra UX antecipada)
  if (userId) {
    const existing = await prisma.couponRedemption.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId } },
    })
    if (existing) {
      return { valid: false, reason: 'ALREADY_USED' }
    }
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      freeMonths: coupon.freeMonths,
      description: coupon.description,
      maxUses: coupon.maxUses,
      currentUses: coupon.currentUses,
      maxUsesPerUser: coupon.maxUsesPerUser,
      validUntil: coupon.validUntil,
    },
  }
}

// Mapeia reason → mensagem pt-BR genérica (anti-enumeration: front sempre
// mostra "Cupom inválido ou expirado", mas internamente sabemos o motivo).
export function reasonToUserMessage(reason: CouponInvalidReason): string {
  // Mesma mensagem pra TODOS os casos exceto ALREADY_USED (UX clara)
  if (reason === 'ALREADY_USED') return 'Você já usou esse cupom.'
  return 'Cupom inválido ou expirado.'
}
