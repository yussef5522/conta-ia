// Sprint 4.0.1.b — Customer individual (PATCH editar, DELETE soft).
//
// Path /api/clientes/[id] (não nested por empresa) — o multi-tenant resolve via
// customer.companyId carregado da entidade. Mantém consistência com outras
// rotas de detail (transacoes/[id], regras/[id]).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { customerSchema } from '@/lib/validations/contas-ap-ar'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = customerSchema.partial().parse(body)

    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, companyId: true, razaoSocial: true },
    })
    if (!existing) {
      return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, existing.companyId)
    ctx.requirePermission('transaction.update')

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.razaoSocial !== undefined ? { razaoSocial: data.razaoSocial } : {}),
        ...(data.nomeFantasia !== undefined ? { nomeFantasia: data.nomeFantasia ?? null } : {}),
        ...(data.cnpj !== undefined ? { cnpj: data.cnpj ?? null } : {}),
        ...(data.cpf !== undefined ? { cpf: data.cpf ?? null } : {}),
        ...(data.email !== undefined ? { email: data.email ?? null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId ?? null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      },
    })

    await logAudit(ctx, {
      action: 'UPDATE',
      entityType: 'Customer',
      entityId: id,
      metadata: { razaoSocial: updated.razaoSocial },
      request,
    })

    return NextResponse.json({ customer: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  // Soft delete: isActive=false. Preserva tx vinculadas.
  try {
    const { id } = await params
    const existing = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, companyId: true, razaoSocial: true },
    })
    if (!existing) {
      return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, existing.companyId)
    ctx.requirePermission('transaction.delete')

    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    })

    await logAudit(ctx, {
      action: 'DELETE',
      entityType: 'Customer',
      entityId: id,
      metadata: { razaoSocial: existing.razaoSocial, softDelete: true },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
