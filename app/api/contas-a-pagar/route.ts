// Sprint 4.0.1.a — Contas a Pagar (PAYABLE).
// Sprint 5.0.2.4 — KPI Pagas no GET.
// Sprint 5.0.3.0a — Filtros completos (período, multi-select, busca, sort).
//
// POST cria nova conta a pagar. GET lista paginado com filtros expandidos.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { contaAPagarCreateSchema } from '@/lib/validations/contas-ap-ar'
import { createContaPendente, ContaCreateError } from '@/lib/contas-ap-ar/create'
import {
  buildPayableListWhere,
  buildPayableOrderBy,
  listPayableSchema,
} from '@/lib/contas-pagar/list-filters'

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
    const empresaId = sp.get('empresaId')
    if (!empresaId) {
      return NextResponse.json(
        { erro: 'empresaId obrigatório', code: 'EMPRESA_REQUIRED' },
        { status: 400 },
      )
    }

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // Parse + valida todos os filtros via Zod (defesa em profundidade)
    const input = listPayableSchema.parse(
      Object.fromEntries(sp.entries()),
    )

    const now = new Date()
    const whereList = buildPayableListWhere(input, now)
    const orderBy = buildPayableOrderBy(input)

    // Sprint 5.0.3.1 (Bug #2) — KPIs respeitam dataDe/dataAte do filtro do user.
    // Removida limpeza de dataDe/dataAte/dataField; mantém limpeza de
    // status/vencidasOnly/q (essas mudam a semântica de cada KPI).
    const kpiBaseInput = {
      ...input,
      status: undefined,
      vencidasOnly: false,
      q: undefined,
    } as typeof input
    const whereBase = buildPayableListWhere(kpiBaseInput, now)

    const [items, total, kpiPagas, kpiPendentes, kpiVencidas, kpiAVencer3d] =
      await Promise.all([
        prisma.transaction.findMany({
          where: whereList,
          orderBy,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: {
            category: { select: { id: true, name: true, color: true } },
            supplier: {
              select: { id: true, razaoSocial: true, nomeFantasia: true },
            },
            employee: { select: { id: true, nome: true } },
            bankAccount: {
              select: { id: true, name: true, bankName: true },
            },
          },
        }),
        prisma.transaction.count({ where: whereList }),
        // PAGAS = paymentDate preenchida (status RECONCILED ou EFFECTED)
        prisma.transaction.aggregate({
          where: { ...whereBase, paymentDate: { not: null } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        // A PAGAR PENDENTE = status PENDING, dueDate >= hoje (não vencida)
        // Sprint 5.0.3.1 (Bug #1) — AND explícito preserva OR multi-tenant
        // do whereBase. Spread + override do OR APAGAVA o filtro multi-tenant
        // e a aggregate rodava no banco inteiro (vazava txs de outras empresas).
        prisma.transaction.aggregate({
          where: {
            AND: [
              whereBase,
              { status: 'PENDING' },
              { OR: [{ dueDate: { gte: now } }, { dueDate: null }] },
            ],
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        // VENCIDAS = status PENDING, dueDate < hoje
        prisma.transaction.aggregate({
          where: { ...whereBase, status: 'PENDING', dueDate: { lt: now } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        // A VENCER em até 3 dias = status PENDING, dueDate entre hoje e +3d
        prisma.transaction.aggregate({
          where: {
            ...whereBase,
            status: 'PENDING',
            dueDate: {
              gte: now,
              lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ])

    return NextResponse.json({
      items,
      paginacao: {
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
      },
      kpis: {
        // Sprint 5.0.3.0a — 4 KPIs (PAGAS verde, A PAGAR azul, A VENCER 3d amarelo, VENCIDAS vermelho)
        totalPagas: kpiPagas._sum.amount ?? 0,
        countPagas: kpiPagas._count._all,
        totalPendente: kpiPendentes._sum.amount ?? 0,
        countPendente: kpiPendentes._count._all,
        totalAVencer3d: kpiAVencer3d._sum.amount ?? 0,
        countAVencer3d: kpiAVencer3d._count._all,
        totalVencido: kpiVencidas._sum.amount ?? 0,
        countVencido: kpiVencidas._count._all,
      },
      // Sprint 5.0.3.0a — Echo dos filtros parseados (UI sincroniza state)
      appliedFilters: {
        dataDe: input.dataDe,
        dataAte: input.dataAte,
        dataField: input.dataField,
        status: input.status,
        vencidasOnly: input.vencidasOnly,
        supplierIds: input.supplierIds,
        employeeIds: input.employeeIds,
        categoryIds: input.categoryIds,
        bankAccountIds: input.bankAccountIds,
        origins: input.origins,
        q: input.q,
        valorMin: input.valorMin,
        valorMax: input.valorMax,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
