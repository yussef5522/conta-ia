// POST /api/admin/coupons/[id]/pause — Sprint 1.7.

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

  if (existing.status !== 'ACTIVE') {
    return NextResponse.json(
      {
        erro: `Só cupons ATIVOS podem ser pausados (atual: ${existing.status}).`,
        success: false,
      },
      { status: 409 },
    )
  }

  await prisma.coupon.update({
    where: { id },
    data: { status: 'PAUSED' },
  })

  logAdminAudit({
    gerenciadorId: guard.gerenciador.id,
    action: 'COUPON_PAUSED',
    entityType: 'Coupon',
    entityId: id,
    metadata: { code: existing.code },
    ipAddress: guard.ipAddress,
    userAgent: guard.userAgent,
  })

  return NextResponse.json({ success: true })
}
