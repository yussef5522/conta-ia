// Sprint 4.0.1.a — Contas a Pagar (PAYABLE).
// POST cria; GET lista paginado.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { contaAPagarCreateSchema } from '@/lib/validations/contas-ap-ar'
import { createContaPendente, ContaCreateError } from '@/lib/contas-ap-ar/create'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = contaAPagarCreateSchema.parse(body)

    const ctx = await getAuthContext(request, data.companyId)
    ctx.requirePermission('transaction.create')

    const transaction = await createContaPendente(
      {
        ...data,
        lifecycle: 'PAYABLE',
      },
      ctx,
    )

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    if (error instanceof ContaCreateError) {
      return NextResponse.json({ erro: error.reason }, { status: error.status })
    }
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

    const page = Math.max(1, Number(sp.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50)))
    const status = sp.get('status') // PENDING | RECONCILED | IGNORED
    const vencidasOnly = sp.get('vencidas') === 'true'
    const supplierId = sp.get('supplierId')
    const categoryId = sp.get('categoryId')

    const now = new Date()
    const where: Record<string, unknown> = {
      lifecycle: 'PAYABLE',
      // Multi-tenant via bankAccount.companyId NÃO funciona aqui (bankAccountId pode ser null).
      // Filtramos via supplier/customer/category todos ligados à empresa, OU via OR explícito.
      OR: [
        { bankAccount: { companyId } },
        { supplier: { companyId } },
        { customer: { companyId } },
        { category: { companyId } },
      ],
    }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId
    if (categoryId) where.categoryId = categoryId
    if (vencidasOnly) where.dueDate = { lt: now }

    const [items, total, kpiAggregates] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, color: true } },
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          bankAccount: { select: { id: true, name: true, bankName: true } },
        },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where: { ...where, status: 'PENDING' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    const kpiVencidas = await prisma.transaction.aggregate({
      where: { ...where, status: 'PENDING', dueDate: { lt: now } },
      _sum: { amount: true },
      _count: { _all: true },
    })

    return NextResponse.json({
      items,
      paginacao: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      kpis: {
        totalPendente: kpiAggregates._sum.amount ?? 0,
        countPendente: kpiAggregates._count._all,
        totalVencido: kpiVencidas._sum.amount ?? 0,
        countVencido: kpiVencidas._count._all,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
