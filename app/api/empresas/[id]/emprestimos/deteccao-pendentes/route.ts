// Sprint Casar Pagamento (04/08/2026) — FASE 3/6: detecção de pagamentos de
// empréstimo nas transações pendentes (janela JUL–AGO/2026). READ-ONLY. Alimenta
// a linha "🏦 Empréstimo … — Vincular" e o banner contextual em /pendentes.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { detectLoanPayment, type DetectLoanLite } from '@/lib/loans/detect-payment'
import { NEEDS_REVIEW_WHERE_PRISMA } from '@/lib/transacoes/needs-review'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string }> }

const WINDOW_START = new Date('2026-07-01T00:00:00.000Z')
const WINDOW_END = new Date('2026-08-31T23:59:59.999Z')

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // Empréstimos ativos por conta (dia de vencimento = dia do firstDueDate).
    const loans = await prisma.loan.findMany({
      where: { companyId: empresaId },
      select: { id: true, bankAccountId: true, contractNumber: true, lender: true, status: true, firstDueDate: true },
    })
    const byAccount = new Map<string, DetectLoanLite[]>()
    for (const l of loans) {
      const lite: DetectLoanLite = { id: l.id, contractNumber: l.contractNumber, lender: l.lender, status: l.status, dueDay: l.firstDueDate.getUTCDate() }
      const arr = byAccount.get(l.bankAccountId) ?? []
      arr.push(lite)
      byAccount.set(l.bankAccountId, arr)
    }
    if (loans.length === 0) return NextResponse.json({ detections: {}, count: 0 })

    // Tx pendentes DEBIT na janela, das contas que têm empréstimo.
    const pend = await prisma.transaction.findMany({
      where: {
        ...NEEDS_REVIEW_WHERE_PRISMA,
        bankAccount: { companyId: empresaId },
        bankAccountId: { in: [...byAccount.keys()] },
        type: 'DEBIT',
        date: { gte: WINDOW_START, lte: WINDOW_END },
      },
      select: { id: true, description: true, type: true, date: true, bankAccountId: true },
    })

    const detections: Record<string, unknown> = {}
    let count = 0
    for (const t of pend) {
      const accLoans = byAccount.get(t.bankAccountId ?? '') ?? []
      const d = detectLoanPayment({ description: t.description ?? '', type: t.type, date: t.date }, accLoans)
      if (d) { detections[t.id] = d; count++ }
    }

    return NextResponse.json({ detections, count })
  } catch (error) {
    return handleApiError(error)
  }
}
