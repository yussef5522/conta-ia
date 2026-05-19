// GET /api/admin/coupons — lista paginada com filtros
// POST /api/admin/coupons — criar cupom
// Sprint 1.7.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { adminGuard, logAdminAudit } from '@/lib/coupons/admin-helpers'
import {
  createCouponSchema,
  listCouponsQuerySchema,
} from '@/lib/coupons/admin-schemas'

export async function GET(request: NextRequest) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response

  const url = new URL(request.url)
  const parsed = listCouponsQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { erro: 'Filtros inválidos', success: false },
      { status: 400 },
    )
  }
  const { q, status, type, page, pageSize } = parsed.data

  const where: Prisma.CouponWhereInput = {}
  if (q) where.code = { contains: q }
  if (status !== 'ALL') where.status = status
  if (type !== 'ALL') where.type = type

  const [total, items] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        freeMonths: true,
        validFrom: true,
        validUntil: true,
        maxUses: true,
        currentUses: true,
        maxUsesPerUser: true,
        status: true,
        createdAt: true,
        createdById: true,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    items: items.map((c) => ({ ...c, value: Number(c.value) })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(request: NextRequest) {
  const guard = await adminGuard(request)
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { erro: 'JSON inválido', success: false },
      { status: 400 },
    )
  }

  const parsed = createCouponSchema.safeParse(body)
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
  const data = parsed.data

  // Checa duplicidade explicitamente (mensagem clara — code é UNIQUE)
  const existing = await prisma.coupon.findUnique({
    where: { code: data.code },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      {
        erro: `Já existe um cupom com o código ${data.code}.`,
        success: false,
      },
      { status: 409 },
    )
  }

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code,
        description: data.description ?? null,
        type: data.type,
        value: data.value,
        freeMonths: data.type === 'FREE_MONTHS' ? (data.freeMonths ?? null) : null,
        validFrom: data.validFrom ?? new Date(),
        validUntil: data.validUntil ?? null,
        maxUses: data.maxUses ?? null,
        maxUsesPerUser: data.maxUsesPerUser,
        status: 'ACTIVE',
        createdById: guard.gerenciador.id,
      },
    })

    logAdminAudit({
      gerenciadorId: guard.gerenciador.id,
      action: 'COUPON_CREATED',
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: {
        code: coupon.code,
        type: coupon.type,
        value: data.value,
      },
      ipAddress: guard.ipAddress,
      userAgent: guard.userAgent,
    })

    return NextResponse.json(
      {
        success: true,
        coupon: { ...coupon, value: Number(coupon.value) },
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { erro: 'Código de cupom já existe', success: false },
        { status: 409 },
      )
    }
    console.error('[POST /api/admin/coupons]', err)
    return NextResponse.json(
      { erro: 'Erro ao criar cupom', success: false },
      { status: 500 },
    )
  }
}
