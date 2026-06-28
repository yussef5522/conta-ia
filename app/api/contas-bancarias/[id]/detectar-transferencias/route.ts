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
import { type OwnEntityRefs } from '@/lib/transfers/own-entity-signals'

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
      select: {
        id: true,
        name: true,
        companyId: true,
        company: {
          select: {
            cnpj: true,
            name: true,
            tradeName: true,
            // Sprint Transfer-Pairing-Retroativo (16/06/2026): inclui sócios
            // PF nas refs.names. Caso real: transferências internas Banrisul
            // → Stone vêm com memo "YUSSEF ABU ZAHRY MUSA - Transferência |
            // Pix" — sem isso, hasOwnName=false e o score não bate HIGH.
            sociosPF: { select: { nome: true } },
          },
        },
      },
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

    // Sprint Owner Detection (28/06/2026): refs centralizadas via helper.
    // Inclui CPFs + nomes dos sócios como sinais separados (CPF=FORTE +0.15,
    // nome=MEDIO +0.10). Antes os nomes dos sócios eram misturados em
    // `names` com peso de "nome empresa" — peso correto mas semântica errada.
    // Sprint R1: também inclui accountNames de TODAS as contas ativas
    // (bancos gravam nome próprio do destinatário às vezes).
    const { loadOwnEntityRefs } = await import('@/lib/transfers/load-own-entity-refs')
    const baseRefs = await loadOwnEntityRefs(prisma, conta.companyId)
    const todasContasNomes = [conta.name, ...outrasContas.map((c) => c.name)]
    const refs: OwnEntityRefs = {
      ...baseRefs,
      // Override accountNames pra incluir a conta importada
      accountNames: Array.from(new Set([...baseRefs.accountNames, ...todasContasNomes])),
    }

    const result = detectarTransferenciasNoPreview(
      novas,
      bundles,
      { id: conta.id, name: conta.name },
      refs,
    )

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
      const fromAccountName = accNames.get(c.fromAccountId) ?? '?'
      const toAccountName = accNames.get(c.toAccountId) ?? '?'
      return {
        ...c,
        fromAccountName,
        toAccountName,
        // Enriquecimento Sprint Card-Transfer: 2 lados + flag isPreview.
        // Datas em ISO string (Date não viaja em JSON nativo).
        from: {
          ...c.from,
          date: c.from.date.toISOString(),
          accountName: fromAccountName,
          isPreview: c.fromAccountId === conta.id,
        },
        to: {
          ...c.to,
          date: c.to.date.toISOString(),
          accountName: toAccountName,
          isPreview: c.toAccountId === conta.id,
        },
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
