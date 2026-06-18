// Sprint Empréstimos UI (17/06/2026).
//
// GET  /api/empresas/[id]/emprestimos  — carteira + agregados
// POST /api/empresas/[id]/emprestimos  — cria Loan + generateSchedule

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { generateSchedule } from '@/lib/loans/amortization'
import { computeOutstandingBalance as compOut } from '@/lib/loans/auto-conciliacao'

interface Params {
  params: Promise<{ id: string }>
}

// ============================================================================
// GET — carteira + agregados
// ============================================================================
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const loans = await prisma.loan.findMany({
      where: { companyId: empresaId },
      select: {
        id: true,
        lender: true,
        contractNumber: true,
        principal: true,
        interestRateMonthly: true,
        termMonths: true,
        amortizationSystem: true,
        firstDueDate: true,
        iof: true,
        status: true,
        createdAt: true,
        disbursementTransactionId: true,
        bankAccount: { select: { id: true, name: true, bankName: true } },
        installments: {
          select: {
            number: true,
            dueDate: true,
            amortization: true,
            interest: true,
            payment: true,
            status: true,
          },
          orderBy: { number: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))

    let totalSaldoDevedor = 0
    let totalParcelaMes = 0
    let totalJurosMes = 0
    let proximoVencimento: { dueDate: string; loanId: string; lender: string } | null = null

    const carteira = loans.map((l) => {
      const totalPaid = l.installments.filter((i) => i.status === 'PAID').length
      const paidAmort = l.installments
        .filter((i) => i.status === 'PAID')
        .reduce((s, i) => s + i.amortization, 0)
      const saldoDevedor = Math.round((l.principal - paidAmort) * 100) / 100

      const proximaOpen = l.installments.find((i) => i.status === 'OPEN')

      // Vencidas (OPEN com dueDate < hoje) viram "LATE" visual
      const isAtrasada =
        proximaOpen !== undefined && proximaOpen.dueDate.getTime() < now.getTime()
      const statusVisual: 'EM_DIA' | 'PROXIMA_VENCER' | 'ATRASADA' | 'QUITADO' =
        l.status === 'PAID_OFF'
          ? 'QUITADO'
          : isAtrasada
            ? 'ATRASADA'
            : proximaOpen &&
                proximaOpen.dueDate.getTime() - now.getTime() < 7 * 86400000
              ? 'PROXIMA_VENCER'
              : 'EM_DIA'

      // Soma parcelas do mês
      const parcelasMes = l.installments.filter(
        (i) =>
          i.dueDate.getTime() >= startOfMonth.getTime() &&
          i.dueDate.getTime() <= endOfMonth.getTime() &&
          i.status !== 'PAID',
      )
      const compromissoMes = parcelasMes.reduce((s, i) => s + i.payment, 0)
      const jurosMes = parcelasMes.reduce((s, i) => s + i.interest, 0)

      totalSaldoDevedor += saldoDevedor
      totalParcelaMes += compromissoMes
      totalJurosMes += jurosMes

      if (proximaOpen) {
        if (
          !proximoVencimento ||
          proximaOpen.dueDate.getTime() < new Date(proximoVencimento.dueDate).getTime()
        ) {
          proximoVencimento = {
            dueDate: proximaOpen.dueDate.toISOString(),
            loanId: l.id,
            lender: l.lender,
          }
        }
      }

      return {
        id: l.id,
        lender: l.lender,
        contractNumber: l.contractNumber,
        principal: l.principal,
        amortizationSystem: l.amortizationSystem,
        termMonths: l.termMonths,
        interestRateMonthly: l.interestRateMonthly,
        status: l.status,
        statusVisual,
        bankAccount: l.bankAccount,
        saldoDevedor,
        totalPaid,
        proximaParcelaDate: proximaOpen?.dueDate.toISOString() ?? null,
        proximaParcelaValor: proximaOpen?.payment ?? null,
        progresso: l.installments.length
          ? Math.round((totalPaid / l.installments.length) * 100)
          : 0,
        disbursementVinculada: !!l.disbursementTransactionId,
      }
    })

    return NextResponse.json({
      loans: carteira,
      agregados: {
        totalSaldoDevedor: Math.round(totalSaldoDevedor * 100) / 100,
        compromissoMes: Math.round(totalParcelaMes * 100) / 100,
        jurosMes: Math.round(totalJurosMes * 100) / 100,
        proximoVencimento,
        contratosAtivos: carteira.filter((l) => l.status === 'ACTIVE').length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// ============================================================================
// POST — cria Loan + generateSchedule
// ============================================================================
const createSchema = z.object({
  bankAccountId: z.string().cuid(),
  lender: z.string().min(1).max(80),
  contractNumber: z.string().min(1).max(40).optional().nullable(),
  principal: z.coerce.number().positive(),
  interestRateMonthly: z.coerce.number().min(0).max(1),
  termMonths: z.coerce.number().int().min(1).max(480),
  amortizationSystem: z.enum(['PRICE', 'SAC']),
  firstDueDate: z.coerce.date(),
  iof: z.coerce.number().min(0).default(0),
  disbursementDate: z.coerce.date(),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const data = createSchema.parse(body)

    // Multi-tenant: confirma que bankAccount pertence à empresa
    const conta = await prisma.bankAccount.findUnique({
      where: { id: data.bankAccountId },
      select: { id: true, companyId: true },
    })
    if (!conta || conta.companyId !== empresaId) {
      return NextResponse.json(
        { erro: 'Conta bancária inválida' },
        { status: 400 },
      )
    }

    const schedule = generateSchedule({
      principal: data.principal,
      rateMonthly: data.interestRateMonthly,
      termMonths: data.termMonths,
      system: data.amortizationSystem,
      firstDueDate: data.firstDueDate,
    })

    const loan = await prisma.loan.create({
      data: {
        companyId: empresaId,
        bankAccountId: data.bankAccountId,
        lender: data.lender,
        contractNumber: data.contractNumber ?? null,
        principal: data.principal,
        interestRateMonthly: data.interestRateMonthly,
        termMonths: data.termMonths,
        amortizationSystem: data.amortizationSystem,
        firstDueDate: data.firstDueDate,
        iof: data.iof,
        disbursementDate: data.disbursementDate,
        installments: {
          create: schedule.map((r) => ({
            number: r.number,
            dueDate: r.dueDate,
            openingBalance: r.openingBalance,
            interest: r.interest,
            amortization: r.amortization,
            payment: r.payment,
            closingBalance: r.closingBalance,
          })),
        },
      },
      include: { installments: { orderBy: { number: 'asc' } } },
    })

    return NextResponse.json({ loan }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// Exporta helper pra detalhe usar
export async function computeOutstandingBalance(prismaArg: typeof prisma, loanId: string) {
  return compOut(prismaArg, loanId)
}
