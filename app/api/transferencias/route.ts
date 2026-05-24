// POST /api/transferencias — cria par de transações TRANSFER atomic.
// GET  /api/transferencias?empresaId=&page=&limit= — lista paginada agrupada por transferGroupId.
//
// Sprint 0.5 Dia 2. Reusa permissions transaction.create / transaction.view.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { transferCreateSchema, TransferValidationError } from '@/lib/transfers/validate'
import { createTransfer } from '@/lib/transfers/create'
import { BalanceCheckError } from '@/lib/balance/check'

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

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // Conta total de grupos distintos (= count de uma das pontas; usamos a "saída"
    // determinada por createdAt mínimo dentro do grupo). Simplificação: count
    // total de transações TRANSFER dividido por 2.
    const totalTransacoesTransfer = await prisma.transaction.count({
      where: {
        bankAccount: { companyId: empresaId },
        type: 'TRANSFER',
        transferGroupId: { not: null },
      },
    })
    const totalGrupos = Math.floor(totalTransacoesTransfer / 2)

    // Busca as transações TRANSFER da empresa, ordenadas. Agrupa em memória
    // pelo transferGroupId. Paginação aplica no NÍVEL DOS GRUPOS, não das transações.
    const transacoes = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        type: 'TRANSFER',
        transferGroupId: { not: null },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true } },
      },
    })

    // Agrupa por transferGroupId mantendo ordem da primeira ocorrência (desc por data).
    const grupos = new Map<
      string,
      {
        groupId: string
        date: Date
        amount: number
        fromAccount: { id: string; name: string; bankName: string | null }
        toAccount: { id: string; name: string; bankName: string | null }
        description: string
        notes: string | null
      }
    >()
    for (const tx of transacoes) {
      const gid = tx.transferGroupId!
      // Sprint 4.0.1.a — transferências SEMPRE têm bankAccount (são tx EFFECTED por construção).
      if (!tx.bankAccount) continue
      const existing = grupos.get(gid)
      if (!existing) {
        // Primeira ponta vista = saída (ordem ASC de createdAt dentro do grupo)
        grupos.set(gid, {
          groupId: gid,
          date: tx.date,
          amount: tx.amount,
          fromAccount: tx.bankAccount,
          // toAccount preenche na segunda iteração
          toAccount: tx.bankAccount,
          description: tx.description,
          notes: tx.notes,
        })
      } else {
        // Segunda ponta = entrada (chega depois no orderBy)
        existing.toAccount = tx.bankAccount
      }
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
