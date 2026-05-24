// Sprint 4.0.1.b — Recorrentes CRUD.
// POST cria; GET lista com filtros.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { recurringScheduleCreateSchema } from '@/lib/validations/recurrence'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = recurringScheduleCreateSchema.parse(body)

    const ctx = await getAuthContext(request, data.companyId)
    ctx.requirePermission('transaction.create')

    const schedule = await prisma.recurringSchedule.create({
      data: {
        companyId: data.companyId,
        description: data.description,
        amount: data.amount,
        type: data.type,
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        supplierId: data.supplierId ?? null,
        customerId: data.customerId ?? null,
        categoryId: data.categoryId ?? null,
        notes: data.notes ?? null,
        active: true,
        createdById: ctx.user.id,
      },
    })

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'RecurringSchedule',
      entityId: schedule.id,
      metadata: {
        description: schedule.description,
        type: schedule.type,
        frequency: schedule.frequency,
        amount: schedule.amount,
      },
      request,
    })

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const companyId = sp.get('empresaId')
    if (!companyId) {
      return NextResponse.json({ erro: 'empresaId obrigatório' }, { status: 400 })
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const type = sp.get('type') // PAYABLE | RECEIVABLE
    const activeStr = sp.get('active') // 'true' | 'false'

    const where: Record<string, unknown> = { companyId }
    if (type) where.type = type
    if (activeStr === 'true') where.active = true
    if (activeStr === 'false') where.active = false

    const schedules = await prisma.recurringSchedule.findMany({
      where,
      orderBy: [{ active: 'desc' }, { description: 'asc' }],
      include: {
        supplier: { select: { id: true, razaoSocial: true } },
        customer: { select: { id: true, razaoSocial: true } },
        category: { select: { id: true, name: true, color: true } },
        _count: { select: { transactions: true } },
      },
    })

    return NextResponse.json({ schedules })
  } catch (error) {
    return handleApiError(error)
  }
}
