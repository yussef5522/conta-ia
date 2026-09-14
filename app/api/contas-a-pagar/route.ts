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
import { notasDeOrigem, type NotaDeOrigem } from '@/lib/stock/ponte/nota-de-origem'
import { whereDoStatus } from '@/lib/contas-pagar/escopo'

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

    const [items, total, kpiPagas, kpiPendentes, kpiVencidas] =
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
        /**
         * ⭐⭐⭐ OS STATS SAEM DO DONO ÚNICO (13/09/2026) — `whereDoStatus`.
         *
         * ⛔ Antes cada card tinha a sua régua aqui, e elas **brigavam com o aging e com a
         * lista**: o KPI comparava `dueDate < now` (um TIMESTAMP) e o aging por DIA. O
         * print do dono: `VENCIDAS 34 · R$ 48.502,57` × `inadimplência 9 · R$ 20.635,54`.
         * A diferença eram as **25 que vencem HOJE** (R$ 27.867,03) — fecha ao centavo.
         *
         * ⚠️ Sprint 5.0.3.1 (Bug #1) preservado: **AND explícito**, nunca spread — spread
         * com `OR` próprio APAGA o OR multi-tenant do `whereBase` e a aggregate roda no
         * banco inteiro (já vazou tx de outra empresa uma vez).
         */
        prisma.transaction.aggregate({
          where: { AND: [whereBase, whereDoStatus('A_PAGAR', now)] },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.transaction.aggregate({
          where: { AND: [whereBase, whereDoStatus('VENCIDA', now)] },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ])

    // ⭐ "VER NOTA DE ORIGEM" (30/08) — a seta de volta da ponte. Só as linhas desta
    // página, e FAIL-SOFT: se o estoque estiver indisponível a lista abre sem o link.
    // Diagnóstico não derruba a tela de dinheiro (a mesma régua do selo de conferência).
    let notas = new Map<string, NotaDeOrigem>()
    try {
      const idsDoEstoque = items.filter((t) => t.origin === 'ESTOQUE_NF').map((t) => t.id)
      if (idsDoEstoque.length) notas = await notasDeOrigem(empresaId, idsDoEstoque, prisma)
    } catch { /* sem link, nunca sem lista */ }

    return NextResponse.json({
      items: items.map((t) => ({ ...t, notaOrigem: notas.get(t.id) ?? null })),
      paginacao: {
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
      },
      kpis: {
        // ⭐ TRÊS status, como no mundo real (13/09): VENCIDA · A PAGAR · PAGA.
        // ⛔ "A VENCER (3d)" morreu como card — era um SUBCONJUNTO de A PAGAR, então a
        // soma dos quatro contava a mesma conta 2×. O prazo virou texto na coluna da data.
        totalPagas: kpiPagas._sum.amount ?? 0,
        countPagas: kpiPagas._count._all,
        totalPendente: kpiPendentes._sum.amount ?? 0,
        countPendente: kpiPendentes._count._all,
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
