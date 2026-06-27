// Sprint Emprestimos Acompanhamento Mensal (27/06/2026)
// GET /api/empresas/[id]/emprestimos/parcelas-do-mes?mes=YYYY-MM
//
// Lista TODAS as parcelas dos empréstimos da empresa que vencem no mês
// selecionado, com status visual:
//   PAGA      — status=PAID + reconciledTransactionId
//   AGUARDANDO — OPEN/LATE + ainda dentro de ±3d do vencimento (não atrasou)
//   ATRASADA  — OPEN/LATE + passou 3+ dias do vencimento sem pagar
//   PLACEHOLDER — PAID + isEstimate=true + payment=0 (histórico pré-cadastro)

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }
  const acesso = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId },
    select: { companyId: true },
  })
  if (!acesso) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }

  const mesParam = request.nextUrl.searchParams.get('mes')
  const today = new Date()
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam)
    ? mesParam
    : `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`

  const [year, month] = mes.split('-').map(Number)
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  const installments = await prisma.loanInstallment.findMany({
    where: {
      loan: { companyId },
      dueDate: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      number: true,
      dueDate: true,
      payment: true,
      interest: true,
      amortization: true,
      status: true,
      paidDate: true,
      isEstimate: true,
      reconciledTransactionId: true,
      loan: {
        select: {
          id: true,
          lender: true,
          contractNumber: true,
          bankAccount: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { loan: { contractNumber: 'asc' } }],
  })

  const now = today
  const items = installments.map((li) => {
    let visualStatus: 'PAGA' | 'AGUARDANDO' | 'ATRASADA' | 'PLACEHOLDER' = 'AGUARDANDO'
    if (li.status === 'PAID' && li.payment === 0 && li.isEstimate) {
      visualStatus = 'PLACEHOLDER'
    } else if (li.status === 'PAID') {
      visualStatus = 'PAGA'
    } else {
      const dueDate = new Date(li.dueDate)
      const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      visualStatus = daysSinceDue > 3 ? 'ATRASADA' : 'AGUARDANDO'
    }
    return {
      id: li.id,
      number: li.number,
      dueDate: li.dueDate.toISOString().slice(0, 10),
      payment: li.payment,
      interest: li.interest,
      amortization: li.amortization,
      isEstimate: li.isEstimate,
      status: visualStatus,
      paidDate: li.paidDate?.toISOString().slice(0, 10) ?? null,
      reconciledTransactionId: li.reconciledTransactionId,
      loan: {
        id: li.loan.id,
        lender: li.loan.lender,
        contractNumber: li.loan.contractNumber,
        bankAccountName: li.loan.bankAccount?.name ?? null,
      },
    }
  })

  const counts = {
    total: items.length,
    paga: items.filter((i) => i.status === 'PAGA').length,
    aguardando: items.filter((i) => i.status === 'AGUARDANDO').length,
    atrasada: items.filter((i) => i.status === 'ATRASADA').length,
    placeholder: items.filter((i) => i.status === 'PLACEHOLDER').length,
  }

  const totals = {
    valorPago: round2(items.filter((i) => i.status === 'PAGA').reduce((s, i) => s + i.payment, 0)),
    valorEsperado: round2(items.filter((i) => i.status !== 'PAGA' && i.status !== 'PLACEHOLDER').reduce((s, i) => s + i.payment, 0)),
    jurosPago: round2(items.filter((i) => i.status === 'PAGA').reduce((s, i) => s + i.interest, 0)),
  }

  // Lista de meses disponíveis (qualquer mês com ao menos 1 parcela)
  const allLoans = await prisma.loan.findMany({
    where: { companyId },
    select: {
      installments: {
        select: { dueDate: true },
        orderBy: { dueDate: 'asc' },
      },
    },
  })
  const monthsSet = new Set<string>()
  for (const l of allLoans) {
    for (const inst of l.installments) {
      const d = inst.dueDate
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      monthsSet.add(ym)
    }
  }
  const availableMonths = Array.from(monthsSet).sort()

  return NextResponse.json({
    mes,
    items,
    counts,
    totals,
    availableMonths,
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
