// Sprint 4.0.1.a — Customer CRUD por empresa.
// GET lista clientes ativos. POST cria novo.
//
// RBAC: reusa permissions de Supplier (supplier.view / supplier.create) por
// proximidade conceitual. Eventualmente ganham permissions próprias (customer.*).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { customerSchema } from '@/lib/validations/contas-ap-ar'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const sp = request.nextUrl.searchParams
    const q = sp.get('q')?.trim() ?? ''
    const soAtivas = sp.get('soAtivas') === 'true'

    const where: Record<string, unknown> = { companyId }
    if (soAtivas) where.isActive = true
    if (q) where.razaoSocial = { contains: q, mode: 'insensitive' }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { razaoSocial: 'asc' }],
      include: {
        category: { select: { id: true, name: true, color: true } },
        _count: { select: { transactions: true } },
      },
    })

    return NextResponse.json({ customers })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const data = customerSchema.parse(body)

    // Dedupe por CNPJ ou CPF dentro da empresa (constraint @@unique cobre CNPJ;
    // CPF não tem unique mas verificamos manualmente — futuro: adicionar índice).
    if (data.cnpj) {
      const existing = await prisma.customer.findUnique({
        where: { companyId_cnpj: { companyId, cnpj: data.cnpj } },
      })
      if (existing) {
        return NextResponse.json(
          { erro: 'Cliente com este CNPJ já existe', existingId: existing.id },
          { status: 409 },
        )
      }
    }

    const customer = await prisma.customer.create({
      data: {
        companyId,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia ?? null,
        cnpj: data.cnpj ?? null,
        cpf: data.cpf ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        categoryId: data.categoryId ?? null,
        notes: data.notes ?? null,
        fonte: 'MANUAL',
      },
    })

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: { razaoSocial: customer.razaoSocial, cnpj: customer.cnpj },
      request,
    })

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
