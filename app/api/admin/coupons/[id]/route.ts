// GET /api/admin/coupons/[id] — detalhe com redemptions
// PATCH /api/admin/coupons/[id] — atualiza campos editáveis (code é imutável)
// DELETE /api/admin/coupons/[id] — soft-delete (status = DEACTIVATED)
// Sprint 1.7.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { adminGuard, logAdminAudit } from '@/lib/coupons/admin-helpers'
import { updateCouponSchema } from '@/lib/coupons/admin-schemas'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response

  const { id } = await params

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: {
      redemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  if (!coupon) {
    return NextResponse.json(
      { erro: 'Cupom não encontrado', success: false },
      { status: 404 },
    )
  }

  return NextResponse.json({
    success: true,
    coupon: {
      ...coupon,
      value: Number(coupon.value),
      redemptions: coupon.redemptions.map((r) => ({
        ...r,
        valueSnapshot: Number(r.valueSnapshot),
      })),
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { erro: 'JSON inválido', success: false },
      { status: 400 },
    )
  }

  const parsed = updateCouponSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return NextResponse.json(
      {
        erro: first?.message ?? 'Dados inválidos',
        path: first?.path,
        success: false,
      },
      { status: 400 },
    )
  }

  const existing = await prisma.coupon.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json(
      { erro: 'Cupom não encontrado', success: false },
      { status: 404 },
    )
  }

  if (existing.status === 'DEACTIVATED') {
    return NextResponse.json(
      { erro: 'Cupom desativado não pode ser editado', success: false },
      { status: 400 },
    )
  }

  // Coerção pra null (Prisma trata undefined como "não mexer")
  const data = parsed.data
  const updated = await prisma.coupon.update({
    where: { id },
    data: {
      description: data.description !== undefined ? data.description : undefined,
      validUntil: data.validUntil !== undefined ? data.validUntil : undefined,
      maxUses: data.maxUses !== undefined ? data.maxUses : undefined,
      maxUsesPerUser:
        data.maxUsesPerUser !== undefined ? data.maxUsesPerUser : undefined,
    },
  })

  logAdminAudit({
    gerenciadorId: guard.gerenciador.id,
    action: 'COUPON_UPDATED',
    entityType: 'Coupon',
    entityId: id,
    metadata: { code: existing.code, changes: data },
    ipAddress: guard.ipAddress,
    userAgent: guard.userAgent,
  })

  return NextResponse.json({
    success: true,
    coupon: { ...updated, value: Number(updated.value) },
  })
}

export async function DELETE(
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

  if (existing.status === 'DEACTIVATED') {
    return NextResponse.json(
      { erro: 'Cupom já está desativado', success: false },
      { status: 409 },
    )
  }

  await prisma.coupon.update({
    where: { id },
    data: {
      status: 'DEACTIVATED',
      deactivatedAt: new Date(),
      deactivatedById: guard.gerenciador.id,
    },
  })

  logAdminAudit({
    gerenciadorId: guard.gerenciador.id,
    action: 'COUPON_DEACTIVATED',
    entityType: 'Coupon',
    entityId: id,
    metadata: { code: existing.code, previousStatus: existing.status },
    ipAddress: guard.ipAddress,
    userAgent: guard.userAgent,
  })

  return NextResponse.json({ success: true })
}
