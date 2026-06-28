// Sprint Pending Transfer State (27/06/2026, modelo QuickBooks/Xero).
//
// GET /api/empresas/[id]/transferencias/aguardando-par
// Lista tx com pendingTransfer=true escopo da empresa + KPIs + sugestões
// de pareamento (tx órfã na empresa que bate por valor + data + sinal oposto).
//
// READ-ONLY. Auth via getAuthContext + permission 'transaction.view'.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params { params: Promise<{ id: string }> }

// Janela de busca pra sugestão de par: ±N dias do dueDate/date da pendente.
const PAIR_WINDOW_DAYS = 3
const PAIR_AMOUNT_TOL = 0.01 // 1 centavo

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // Tx aguardando par DESTA empresa (filtra via bankAccount.companyId)
    const pendentes = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        pendingTransfer: true,
        transferGroupId: null, // safety: já pareado não aparece
      },
      select: {
        id: true,
        date: true,
        type: true,
        amount: true,
        description: true,
        pendingTransferDirection: true,
        pendingTransferSince: true,
        bankAccountId: true,
        bankAccount: { select: { id: true, name: true, bankName: true, accountKind: true } },
      },
      orderBy: { pendingTransferSince: 'desc' },
    })

    // Sugestões de par pra cada pendente: tx CREDIT/DEBIT órfã na empresa
    // com mesmo valor, conta DIFERENTE, dentro da janela ±3d, sinal oposto.
    const accountsById = new Map<string, { id: string; name: string; accountKind: string }>()
    const accounts = await prisma.bankAccount.findMany({
      where: { companyId: empresaId, isActive: true },
      select: { id: true, name: true, accountKind: true },
    })
    for (const a of accounts) accountsById.set(a.id, a)

    const sugestoesPorTxId = new Map<
      string,
      Array<{
        candidateId: string
        candidateDate: string
        candidateAccountId: string
        candidateAccountName: string
        candidateDescription: string
      }>
    >()

    for (const p of pendentes) {
      const startDate = new Date(p.date.getTime() - PAIR_WINDOW_DAYS * 86400_000)
      const endDate = new Date(p.date.getTime() + PAIR_WINDOW_DAYS * 86400_000)
      // Sinal oposto: se essa é DEBIT (saída), procuro CREDIT (entrada)
      const oppositeType = p.type === 'DEBIT' ? 'CREDIT' : 'DEBIT'

      const cands = await prisma.transaction.findMany({
        where: {
          bankAccount: { companyId: empresaId },
          // Conta DIFERENTE (transferência interna entre 2 contas)
          bankAccountId: { not: p.bankAccountId ?? '' },
          // Sinal oposto
          type: oppositeType,
          // Valor exato (±1 centavo)
          amount: { gte: p.amount - PAIR_AMOUNT_TOL, lte: p.amount + PAIR_AMOUNT_TOL },
          // Janela de data
          date: { gte: startDate, lte: endDate },
          // Tem que estar livre pra parear
          transferGroupId: null,
          // Não pareada via outro caminho
          reconciledWithId: null,
          // Não cartão / não parcela emprestimo
          isCardPayment: false,
          loanInstallmentPaid: { is: null },
          // O par pode ser: outra pendingTransfer (par esperando par juntos)
          // OU tx órfã sem categoria. Se já tiver categoria, evita romper o
          // trabalho do user — só sugere se categoryId=null.
          OR: [
            { pendingTransfer: true },
            { categoryId: null },
          ],
        },
        select: {
          id: true,
          date: true,
          description: true,
          bankAccountId: true,
        },
        take: 5, // ranking simples: limita pra não inundar UI
        orderBy: { date: 'asc' },
      })

      const out = cands
        .map((c) => {
          const acc = accountsById.get(c.bankAccountId ?? '')
          if (!acc) return null
          return {
            candidateId: c.id,
            candidateDate: c.date.toISOString(),
            candidateAccountId: acc.id,
            candidateAccountName: acc.name,
            candidateAccountKind: acc.accountKind as 'PJ' | 'PF',
            candidateDescription: c.description,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
      if (out.length > 0) sugestoesPorTxId.set(p.id, out)
    }

    const items = pendentes.map((p) => ({
      id: p.id,
      date: p.date.toISOString(),
      type: p.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
      amount: p.amount,
      description: p.description,
      direction: p.pendingTransferDirection as 'IN' | 'OUT' | null,
      since: p.pendingTransferSince?.toISOString() ?? null,
      account: p.bankAccount
        ? {
            id: p.bankAccount.id,
            name: p.bankAccount.name,
            bankName: p.bankAccount.bankName,
            accountKind: (p.bankAccount.accountKind as 'PJ' | 'PF'),
          }
        : null,
      sugestoes: sugestoesPorTxId.get(p.id) ?? [],
    }))

    const kpis = {
      total: items.length,
      somaSaidas: items
        .filter((i) => i.direction === 'OUT' || i.type === 'DEBIT')
        .reduce((s, i) => s + i.amount, 0),
      somaEntradas: items
        .filter((i) => i.direction === 'IN' || i.type === 'CREDIT')
        .reduce((s, i) => s + i.amount, 0),
      comSugestao: items.filter((i) => i.sugestoes.length > 0).length,
    }

    return NextResponse.json({ items, kpis })
  } catch (error) {
    return handleApiError(error)
  }
}
