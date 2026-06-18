// POST/GET /api/empresas/[id]/emprestimos/[loanId]/linkar-liberacao
//
// GET  → sugere top CREDITs candidatos (valor próximo do principal, data próxima da disbursement)
// POST → linka a tx ao Loan.disbursementTransactionId (sai da receita do DRE)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; loanId: string }>
}

const WINDOW_DAYS = 15
const AMOUNT_TOL_PCT = 0.05

// ============================================================================
// GET — sugestão de tx CREDIT pra liberação
// ============================================================================
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        companyId: true,
        bankAccountId: true,
        principal: true,
        disbursementDate: true,
        disbursementTransactionId: true,
      },
    })
    if (!loan) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })
    }

    const ms = WINDOW_DAYS * 86400000
    const minDate = new Date(loan.disbursementDate.getTime() - ms)
    const maxDate = new Date(loan.disbursementDate.getTime() + ms)
    const minAmt = loan.principal * (1 - AMOUNT_TOL_PCT)
    const maxAmt = loan.principal * (1 + AMOUNT_TOL_PCT)

    const candidates = await prisma.transaction.findMany({
      where: {
        bankAccountId: loan.bankAccountId,
        type: 'CREDIT',
        origin: 'OFX',
        amount: { gte: minAmt, lte: maxAmt },
        date: { gte: minDate, lte: maxDate },
        loanDisbursement: null,
      },
      select: { id: true, date: true, amount: true, description: true },
      orderBy: [{ date: 'asc' }, { amount: 'desc' }],
      take: 20,
    })

    const scored = candidates
      .map((c) => {
        const dDays = Math.abs(
          (c.date.getTime() - loan.disbursementDate.getTime()) / 86400000,
        )
        const dAmount = Math.abs(c.amount - loan.principal)
        // score simples: quanto MENOR melhor → ordenamos crescente
        const score = dDays * 100 + dAmount
        return { id: c.id, date: c.date, amount: c.amount, description: c.description, deltaDays: Math.round(dDays), score }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)

    return NextResponse.json({
      jaVinculada: !!loan.disbursementTransactionId,
      candidates: scored.map((c) => ({
        id: c.id,
        date: c.date.toISOString(),
        amount: c.amount,
        description: c.description,
        deltaDays: c.deltaDays,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// ============================================================================
// POST — linka tx → Loan.disbursementTransactionId
// ============================================================================
const linkSchema = z.object({
  transactionId: z.string().cuid(),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const { transactionId } = linkSchema.parse(body)

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { companyId: true, bankAccountId: true, disbursementTransactionId: true },
    })
    if (!loan) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })

    // Multi-tenant: confirma tx pertence à mesma conta do Loan
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, type: true, bankAccountId: true, loanDisbursement: { select: { id: true } } },
    })
    if (!tx) return NextResponse.json({ erro: 'Tx não encontrada' }, { status: 404 })
    if (tx.bankAccountId !== loan.bankAccountId) {
      return NextResponse.json(
        { erro: 'Tx deve ser da mesma conta do empréstimo' },
        { status: 400 },
      )
    }
    if (tx.type !== 'CREDIT') {
      return NextResponse.json({ erro: 'Liberação deve ser CREDIT' }, { status: 400 })
    }
    if (tx.loanDisbursement && tx.loanDisbursement.id !== loanId) {
      return NextResponse.json(
        { erro: 'Tx já está vinculada a outro empréstimo' },
        { status: 409 },
      )
    }

    await prisma.loan.update({
      where: { id: loanId },
      data: { disbursementTransactionId: transactionId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE — desvincula
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { companyId: true },
    })
    if (!loan) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })

    await prisma.loan.update({
      where: { id: loanId },
      data: { disbursementTransactionId: null },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
