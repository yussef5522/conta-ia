// Aplicação atomic de cupom — Sprint 1.7.
//
// Fluxo:
//   1. Re-valida (defesa em profundidade — caller pode ter validado antes)
//   2. Atomic via prisma.$transaction:
//      a. INSERT CouponRedemption (snapshot)
//      b. UPDATE Coupon SET currentUses += 1
//      c. SE currentUses === maxUses: UPDATE status = 'EXHAUSTED'
//   3. Audit GerenciadorAuditLog COUPON_REDEEMED (best-effort, gerenciadorId=null)

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { validateCoupon } from './validate'
import { normalizeCouponCode, type CouponInvalidReason } from './types'

export type CouponRedeemResult =
  | {
      success: true
      redemption: {
        id: string
        couponId: string
        codeSnapshot: string
        typeSnapshot: string
        valueSnapshot: number
      }
    }
  | { success: false; reason: CouponInvalidReason }

export interface RedeemContext {
  ipAddress?: string | null
  userAgent?: string | null
}

export async function redeemCoupon(
  rawCode: string,
  userId: string,
  ctx: RedeemContext = {},
): Promise<CouponRedeemResult> {
  const code = normalizeCouponCode(rawCode)

  // 1. Re-valida (servidor é fonte da verdade)
  const validation = await validateCoupon(code, userId)
  if (!validation.valid) {
    return { success: false, reason: validation.reason }
  }
  const { coupon } = validation

  // 2. Atomic
  try {
    const redemption = await prisma.$transaction(async (tx) => {
      const created = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          codeSnapshot: coupon.code,
          typeSnapshot: coupon.type,
          // Decimal aceita number diretamente
          valueSnapshot: coupon.value,
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      })

      // Increment + EXHAUSTED check
      const updated = await tx.coupon.update({
        where: { id: coupon.id },
        data: { currentUses: { increment: 1 } },
        select: { currentUses: true, maxUses: true },
      })

      if (
        updated.maxUses !== null &&
        updated.currentUses >= updated.maxUses
      ) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { status: 'EXHAUSTED' },
        })
      }

      return created
    })

    // 3. Audit (best-effort — não bloqueia retorno)
    void prisma.gerenciadorAuditLog
      .create({
        data: {
          gerenciadorId: null, // sistema (D11)
          action: 'COUPON_REDEEMED',
          entityType: 'Coupon',
          entityId: coupon.id,
          metadata: JSON.stringify({
            code: coupon.code,
            userId,
            type: coupon.type,
            value: coupon.value,
          }),
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      })
      .catch((e) =>
        console.error(
          '[coupon audit]',
          e instanceof Error ? e.message : 'erro',
        ),
      )

    return {
      success: true,
      redemption: {
        id: redemption.id,
        couponId: redemption.couponId,
        codeSnapshot: redemption.codeSnapshot,
        typeSnapshot: redemption.typeSnapshot,
        valueSnapshot: Number(redemption.valueSnapshot),
      },
    }
  } catch (err) {
    // Race condition: 2 redemptions simultâneos → @@unique([couponId,userId])
    // OU maxUses estourou enquanto re-validamos
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return { success: false, reason: 'ALREADY_USED' }
      }
    }
    console.error(
      '[redeemCoupon] erro',
      err instanceof Error ? err.message : err,
    )
    return { success: false, reason: 'NOT_FOUND' } // fail-safe genérico
  }
}
