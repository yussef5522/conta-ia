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
    // Sprint 5.0.2.4 — `whereBase` SEM filtro de status/vencidas pra KPIs
    // sempre refletirem o universo todo da empresa. `whereList` aplica os
    // filtros adicionais só pro listing/paginação.
    const whereBase: Record<string, unknown> = {
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
    if (supplierId) whereBase.supplierId = supplierId
    if (categoryId) whereBase.categoryId = categoryId

    const whereList: Record<string, unknown> = { ...whereBase }
    if (status) whereList.status = status
    if (vencidasOnly) whereList.dueDate = { lt: now }

    const [items, total, kpiPendente, kpiVencidas, kpiPagas] = await Promise.all([
      prisma.transaction.findMany({
        where: whereList,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, color: true } },
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          bankAccount: { select: { id: true, name: true, bankName: true } },
        },
      }),
      prisma.transaction.count({ where: whereList }),
      prisma.transaction.aggregate({
        where: { ...whereBase, status: 'PENDING' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.transaction.aggregate({
        where: { ...whereBase, status: 'PENDING', dueDate: { lt: now } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      // Sprint 5.0.2.4 — KPI Pagas: PAYABLE com paymentDate preenchida
      // (status RECONCILED quando vem do efetivar OU import Excel PAID).
      prisma.transaction.aggregate({
        where: { ...whereBase, paymentDate: { not: null } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      items,
      paginacao: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      kpis: {
        totalPendente: kpiPendente._sum.amount ?? 0,
        countPendente: kpiPendente._count._all,
        totalVencido: kpiVencidas._sum.amount ?? 0,
        countVencido: kpiVencidas._count._all,
        totalPagas: kpiPagas._sum.amount ?? 0,
        countPagas: kpiPagas._count._all,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
