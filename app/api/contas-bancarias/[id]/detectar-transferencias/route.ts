// POST /api/contas-bancarias/[id]/detectar-transferencias
// Sprint 0.5 Dia 4 — recebe transações do preview OFX e procura matches
// nas OUTRAS contas da MESMA empresa (sempre dentro do escopo da empresa
// da conta sendo importada — isolamento multi-tenant).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  detectarTransferenciasNoPreview,
  type AccountTransactionsBundle,
  type OfxCandidateTransaction,
} from '@/lib/ofx/detect-transfer'

interface Params {
  params: Promise<{ id: string }>
}

const previewTxSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number().nonnegative(),
  type: z.enum(['CREDIT', 'DEBIT']),
  date: z.coerce.date(),
})

const bodySchema = z.object({
  transacoesPreview: z.array(previewTxSchema).max(2000),
})

// Range de busca nas OUTRAS contas: ±7 dias em volta do range das transações
// do preview (cobre tolerância D/D+1 da heurística com folga).
const SEARCH_PADDING_DAYS = 7

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: contaId } = await params

    const conta = await prisma.bankAccount.findUnique({
      where: { id: contaId },
      select: { id: true, name: true, companyId: true },
    })
    if (!conta) {
      return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
    }

    const ctx = await getAuthContext(request, conta.companyId)
    ctx.requirePermission('bank_account.view')

    const body = await request.json()
    const { transacoesPreview } = bodySchema.parse(body)

    if (transacoesPreview.length === 0) {
      return NextResponse.json({ candidates: [] })
    }

    // Range de datas pra buscar nas outras contas
    const datas = transacoesPreview.map((t) => t.date.getTime())
    const minDate = new Date(Math.min(...datas))
    const maxDate = new Date(Math.max(...datas))
    minDate.setDate(minDate.getDate() - SEARCH_PADDING_DAYS)
    maxDate.setDate(maxDate.getDate() + SEARCH_PADDING_DAYS)

    // Outras contas da MESMA empresa (isolamento multi-tenant inviolável)
    const outrasContas = await prisma.bankAccount.findMany({
      where: {
        companyId: conta.companyId,
        id: { not: contaId },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        transactions: {
          where: {
            date: { gte: minDate, lte: maxDate },
            // Não considera TRANSFER (já pareada) nem PENDING órfã — só CREDIT/DEBIT confirmadas.
            type: { in: ['CREDIT', 'DEBIT'] },
          },
          select: {
            id: true,
            description: true,
            amount: true,
            type: true,
            date: true,
          },
        },
      },
    })

    const bundles: AccountTransactionsBundle[] = outrasContas.map((c) => ({
      accountId: c.id,
      accountName: c.name,
      transactions: c.transactions.map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        type: t.type as 'CREDIT' | 'DEBIT',
        date: t.date,
      })),
    }))

    const novas: OfxCandidateTransaction[] = transacoesPreview.map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date,
    }))

    const result = detectarTransferenciasNoPreview(novas, bundles, {
      id: conta.id,
      name: conta.name,
    })

    // Enriquece candidatos com nomes das contas + info da tx existente
    // (categoryName / hasNotes) pra UI exibir dialog de confirmação quando
    // a tx existente tem dados que serão perdidos no pareamento.
    const accNames = new Map<string, string>()
    accNames.set(conta.id, conta.name)
    for (const b of bundles) accNames.set(b.accountId, b.accountName)

    // Pra cada candidato, identifica qual lado é a tx EXISTENTE (no banco) vs
    // a tx do PREVIEW. A do preview tem accountId = conta.id (a importada).
    // Busca em batch as tx existentes pra evitar N+1.
    const existingTxIds = result.candidates.map((c) => {
      const importingIsFrom = c.fromAccountId === conta.id
      return importingIsFrom ? c.toTransactionId : c.fromTransactionId
    })

    const existingTxs = existingTxIds.length > 0
      ? await prisma.transaction.findMany({
          where: { id: { in: existingTxIds } },
          include: { category: { select: { name: true } } },
        })
      : []
    const existingTxMap = new Map(existingTxs.map((t) => [t.id, t]))

    const candidatesEnriched = result.candidates.map((c) => {
      const importingIsFrom = c.fromAccountId === conta.id
      const existingTxId = importingIsFrom ? c.toTransactionId : c.fromTransactionId
      const existing = existingTxMap.get(existingTxId)
      return {
        ...c,
        fromAccountName: accNames.get(c.fromAccountId) ?? '?',
        toAccountName: accNames.get(c.toAccountId) ?? '?',
        existingTxId,
        existingTxCategoryName: existing?.category?.name ?? null,
        existingTxHasNotes: !!(existing?.notes && existing.notes.trim().length > 0),
      }
    })

    return NextResponse.json({ candidates: candidatesEnriched })
  } catch (error) {
    return handleApiError(error)
  }
}
