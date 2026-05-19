// POST /api/admin/coupons/[id]/resume — Sprint 1.7.
// Reativa cupom pausado. Não muda PAUSED→ACTIVE se já expirou/esgotou.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { adminGuard, logAdminAudit } from '@/lib/coupons/admin-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response

  const { id } = await params

  const existing = await prisma.coupon.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json(
      { erro: 'Cupom não encontrado', success: false },
      { status: 404 },
    )
  }

  if (existing.status !== 'PAUSED') {
    return NextResponse.json(
      {
        erro: `Só cupons PAUSADOS podem ser reativados (atual: ${existing.status}).`,
        success: false,
      },
      { status: 409 },
    )
  }

  // Reativar respeitando estado real (validUntil/maxUses/etc)
  const now = new Date()
  let nextStatus = 'ACTIVE'
  if (existing.validUntil && existing.validUntil < now) {
    nextStatus = 'EXPIRED'
  } else if (
    existing.maxUses !== null &&
    existing.currentUses >= existing.maxUses
  ) {
    nextStatus = 'EXHAUSTED'
  }

  await prisma.coupon.update({
    where: { id },
    data: { status: nextStatus },
  })

  logAdminAudit({
    gerenciadorId: guard.gerenciador.id,
    action: 'COUPON_RESUMED',
    entityType: 'Coupon',
    entityId: id,
    metadata: { code: existing.code, resultStatus: nextStatus },
    ipAddress: guard.ipAddress,
    userAgent: guard.userAgent,
  })

  return NextResponse.json({
    success: true,
    status: nextStatus,
  })
}
