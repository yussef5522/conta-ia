// POST /api/transferencias — cria par de transações TRANSFER atomic.
// GET  /api/transferencias?empresaId=&page=&limit= — lista paginada agrupada por transferGroupId.
//
// Sprint 0.5 Dia 2. Reusa permissions transaction.create / transaction.view.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { transferCreateSchema, TransferValidationError } from '@/lib/transfers/validate'
import { DuplicateTransferGroupError } from '@/lib/transfers/check-duplicate-group'
import { createTransfer } from '@/lib/transfers/create'
import { BalanceCheckError } from '@/lib/balance/check'
import { groupTransfersForList } from '@/lib/transfers/group-for-list'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = transferCreateSchema.parse(body)

    // Resolve companyId via fromAccount pra montar ctx correto
    const fromAccount = await prisma.bankAccount.findUnique({
      where: { id: input.fromAccountId },
      select: { id: true, companyId: true },
    })
    if (!fromAccount) {
      return NextResponse.json({ erro: 'Conta de origem não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, fromAccount.companyId)
    // createTransfer faz o requirePermission internamente

    const result = await createTransfer(input, ctx, request)
    return NextResponse.json({ transferencia: result }, { status: 201 })
  } catch (error) {
    if (error instanceof BalanceCheckError) {
      return NextResponse.json(
        { erro: error.message, saldoCheck: error.result },
        { status: error.status },
      )
    }
    if (error instanceof DuplicateTransferGroupError) {
      return NextResponse.json(
        {
          erro: error.message,
          code: error.code,
          existingGroupId: error.existing.groupId,
          existingGroupDate: error.existing.date.toISOString(),
        },
        { status: error.status },
      )
    }
    if (error instanceof TransferValidationError) {
      return NextResponse.json({ erro: error.message }, { status: error.status })
    }
    return handleApiError(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const empresaId = searchParams.get('empresaId')
    if (!empresaId) {
      return NextResponse.json({ erro: 'empresaId é obrigatório' }, { status: 400 })
    }
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    // Sprint Filtro de Data Parte A (15/06/2026): API agora honra inicio/fim
    // (?inicio=YYYY-MM-DD&fim=YYYY-MM-DD). Antes a /transferencias filtrava
    // apenas client-side, escondendo do user que páginas distantes tinham tx
    // fora do range visível.
    const inicio = searchParams.get('inicio')
    const fim = searchParams.get('fim')
    const dateFilter: Record<string, Date> = {}
    if (inicio) dateFilter.gte = new Date(inicio)
    if (fim) dateFilter.lte = new Date(fim + 'T23:59:59.999Z')

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // where compartilhado para count + findMany (mantém consistência).
    const baseWhere = {
      bankAccount: { companyId: empresaId },
      type: 'TRANSFER',
      transferGroupId: { not: null },
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    } as const

    // Sprint Filtro de Data Parte B (15/06/2026): count agora vai por
    // groupBy(transferGroupId) — antes era Math.floor(totalTxs/2), que com
    // filtro de data pegava pernas isoladas (1 perna dentro do range + irmã
    // fora) e dava off-by-one (ex: 9 returned / total=8).
    const gruposDistintos = await prisma.transaction.groupBy({
      by: ['transferGroupId'],
      where: baseWhere,
    })
    const totalGrupos = gruposDistintos.length

    // Busca as transações TRANSFER da empresa, ordenadas. Agrupa em memória
    // pelo transferGroupId. Paginação aplica no NÍVEL DOS GRUPOS, não das transações.
    const transacoes = await prisma.transaction.findMany({
      where: baseWhere,
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true } },
      },
    })

    // Fase 2: agrupamento via função PURA (testável). Usa transferDirection
    // EXPLÍCITA quando preenchida; fallback createdAt-ASC quando NULL.
    const grupos = new Map<string, ReturnType<typeof groupTransfersForList>[number]>()
    for (const g of groupTransfersForList(transacoes as any)) {
      grupos.set(g.groupId, g)
    }

    // Paginação no array agrupado
    const allGroups = Array.from(grupos.values())
    const start = (page - 1) * limit
    const slice = allGroups.slice(start, start + limit)

    return NextResponse.json({
      transferencias: slice,
      paginacao: {
        total: totalGrupos,
        page,
        limit,
        totalPages: Math.ceil(totalGrupos / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
