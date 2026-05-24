// Sprint 4.0.1.b — Recorrente individual (PATCH editar/pausar/ativar, DELETE soft).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { recurringScheduleUpdateSchema } from '@/lib/validations/recurrence'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = recurringScheduleUpdateSchema.parse(body)

    const existing = await prisma.recurringSchedule.findUnique({
      where: { id },
      select: { id: true, companyId: true, active: true, description: true },
    })
    if (!existing) {
      return NextResponse.json({ erro: 'Recorrente não encontrado' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, existing.companyId)
    ctx.requirePermission('transaction.update')

    const updated = await prisma.recurringSchedule.update({
      where: { id },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth ?? null } : {}),
        ...(data.dayOfWeek !== undefined ? { dayOfWeek: data.dayOfWeek ?? null } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ?? null } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.supplierId !== undefined ? { supplierId: data.supplierId ?? null } : {}),
        ...(data.customerId !== undefined ? { customerId: data.customerId ?? null } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId ?? null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      },
    })

    await logAudit(ctx, {
      action: 'UPDATE',
      entityType: 'RecurringSchedule',
      entityId: id,
      metadata: { description: updated.description, active: updated.active },
      request,
    })

    return NextResponse.json({ schedule: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  // Soft delete: marca active=false. Preserva tx já geradas.
  try {
    const { id } = await params
    const existing = await prisma.recurringSchedule.findUnique({
      where: { id },
      select: { id: true, companyId: true, description: true },
    })
    if (!existing) {
      return NextResponse.json({ erro: 'Recorrente não encontrado' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, existing.companyId)
    ctx.requirePermission('transaction.delete')

    await prisma.recurringSchedule.update({
      where: { id },
      data: { active: false },
    })

    await logAudit(ctx, {
      action: 'DELETE',
      entityType: 'RecurringSchedule',
      entityId: id,
      metadata: { description: existing.description, softDelete: true },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
