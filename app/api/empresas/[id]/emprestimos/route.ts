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
import { saldoDevedorAtual } from '@/lib/loans/saldo'
import { validateSchedule, InvalidLoanScheduleError } from '@/lib/loans/validate-schedule'
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
        // FIX saldo (04/08): campos pra saldoDevedorAtual (agenda válida → closing).
        rateType: true,
        installmentsPaidBefore: true,
        scheduleSource: true,
        notes: true,
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
            openingBalance: true,
            amortization: true,
            interest: true,
            correcao: true,
            payment: true,
            closingBalance: true,
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
    let totalParcelaMensalRec = 0
    let proximoVencimento: { dueDate: string; loanId: string; lender: string } | null = null

    const carteira = loans.map((l) => {
      const totalPaid = l.installments.filter((i) => i.status === 'PAID').length
      // FIX saldo (04/08): agenda válida → closingBalance da última paga (verdade);
      // inválida → fórmula conservadora. Ver lib/loans/saldo.ts.
      const saldoDevedor = saldoDevedorAtual(l, l.installments)

      const proximaOpen = l.installments.find((i) => i.status === 'OPEN')

      // Mútuo FLEXIBLE (sem prazo fixo): NUNCA "Atrasada"/"Próxima" — a agenda é só
      // nominal, a devolução é conforme caixa. Só EM_DIA ou QUITADO.
      const flexible = l.scheduleSource === 'FLEXIBLE'
      // Vencidas (OPEN com dueDate < hoje) viram "LATE" visual
      const isAtrasada =
        !flexible && proximaOpen !== undefined && proximaOpen.dueDate.getTime() < now.getTime()
      const statusVisual: 'EM_DIA' | 'PROXIMA_VENCER' | 'ATRASADA' | 'QUITADO' =
        l.status === 'PAID_OFF'
          ? 'QUITADO'
          : isAtrasada
            ? 'ATRASADA'
            : !flexible && proximaOpen &&
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
      // Recorrência mensal: payment da PRÓXIMA OPEN de cada loan ainda ATIVO.
      // Diferente de "vence este mês" (que depende da data) — representa o
      // compromisso mensal típico do contrato.
      if (l.status === 'ACTIVE' && proximaOpen) {
        totalParcelaMensalRec += proximaOpen.payment
      }

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
        flexible: l.scheduleSource === 'FLEXIBLE',
        notes: l.notes,
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
        // "Vence este mês" — parcelas OPEN cujo dueDate cai no mês corrente
        compromissoMes: Math.round(totalParcelaMes * 100) / 100,
        // "Parcela mensal total" — soma da próxima OPEN de cada loan ativo
        // (representa o compromisso recorrente do contrato, independente do mês)
        parcelaMensalTotal: Math.round(totalParcelaMensalRec * 100) / 100,
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
// POST — cria Loan + schedule
//
// 2 modos:
//   NOVO         → passivo = principal; generateSchedule gera todas as parcelas
//   EM_ANDAMENTO → passivo = outstandingBalanceInitial (saldo devedor ATUAL);
//                  generateMidLifeSchedule gera SÓ as parcelas futuras;
//                  parcelas já pagas viram installmentsPaidBefore (histórico).
// ============================================================================
const createNovoSchema = z.object({
  modo: z.literal('NOVO').optional().default('NOVO'),
  bankAccountId: z.string().cuid(),
  lender: z.string().min(1).max(80),
  contractNumber: z.string().min(1).max(40).optional().nullable(),
  principal: z.coerce.number().positive(),
  interestRateMonthly: z.coerce.number().min(0).max(1),
  termMonths: z.coerce.number().int().min(1).max(480),
  amortizationSystem: z.enum(['PRICE', 'SAC']),
  firstDueDate: z.coerce.date(),
  iof: z.coerce.number().min(0).default(0),
  tarifas: z.coerce.number().min(0).default(0),
  disbursementDate: z.coerce.date(),
  rateType: z.enum(['PRE', 'POS']).optional().default('PRE'),
  indexer: z.enum(['CDI', 'SELIC', 'IPCA']).optional().nullable(),
  indexerPercent: z.coerce.number().min(0).max(1000).optional().nullable(),
  carencia: z.coerce.number().int().min(0).max(60).default(0),
})

const createMidLifeSchema = z.object({
  modo: z.literal('EM_ANDAMENTO'),
  bankAccountId: z.string().cuid(),
  lender: z.string().min(1).max(80),
  contractNumber: z.string().min(1).max(40).optional().nullable(),
  /** Saldo devedor ATUAL — esse é o passivo que entra. */
  outstandingBalanceInitial: z.coerce.number().positive(),
  /** Total de parcelas do contrato (informativo) */
  termMonths: z.coerce.number().int().min(1).max(480),
  /** Quantas parcelas já foram pagas ANTES da entrada (informativo) */
  installmentsPaidBefore: z.coerce.number().int().min(0).max(480),
  /** Taxa pré mensal (decimal) */
  interestRateMonthly: z.coerce.number().min(0).max(1),
  amortizationSystem: z.enum(['PRICE', 'SAC']),
  /** SAC: amortização constante extraída do contrato */
  amortizationConstant: z.coerce.number().positive().optional().nullable(),
  /** Pós-fixado quando indexer presente */
  rateType: z.enum(['PRE', 'POS']),
  indexer: z.enum(['CDI', 'SELIC', 'IPCA']).optional().nullable(),
  indexerPercent: z.coerce.number().min(0).max(1000).optional().nullable(),
  /** Estimativa mensal de correção pra pós-fixado (opcional, cliente decide) */
  estimatedCorrectionMonthly: z.coerce.number().min(0).max(0.5).optional().default(0),
  /** Data da PRÓXIMA parcela (a 1ª futura) */
  firstDueDate: z.coerce.date(),
  trackingStartDate: z.coerce.date(),
  // Em EM_ANDAMENTO disbursementDate é INFORMATIVA (passado). Quando ausente,
  // o handler usa firstDueDate como fallback (já que o save reusa pra
  // satisfazer FK do model).
  disbursementDate: z.coerce.date().optional(),
  iof: z.coerce.number().min(0).default(0),
  tarifas: z.coerce.number().min(0).default(0),
  carencia: z.coerce.number().int().min(0).max(60).default(0),
  /** Quantas parcelas FUTURAS gerar (= termMonths - installmentsPaidBefore) */
  futureCount: z.coerce.number().int().min(1).max(480),
  /** Sprint Fix-Previa: overrides de payment vindos do PDF (valor líquido
   *  da parcela, após desconto). Mapa { number: payment }. */
  paymentOverrides: z
    .array(z.object({ number: z.coerce.number().int().min(1), payment: z.coerce.number().positive() }))
    .max(480)
    .optional(),
  /** Sprint Fix-PRICE: parcela fixa do contrato PRICE (não recalcular PMT). */
  fixedPayment: z.coerce.number().positive().optional(),
})

const createSchema = z.union([createMidLifeSchema, createNovoSchema])

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const data = createSchema.parse(body)

    const conta = await prisma.bankAccount.findUnique({
      where: { id: data.bankAccountId },
      select: { id: true, companyId: true },
    })
    if (!conta || conta.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Conta bancária inválida' }, { status: 400 })
    }

    // ====== Modo NOVO (padrão) ======
    if (data.modo === 'NOVO' || data.modo === undefined) {
      const d = data as z.infer<typeof createNovoSchema>
      const schedule = generateSchedule({
        principal: d.principal,
        rateMonthly: d.interestRateMonthly,
        termMonths: d.termMonths,
        system: d.amortizationSystem,
        firstDueDate: d.firstDueDate,
      })

      // GUARD (03/08/2026): agenda tem que fechar antes de gravar. O DRE divide
      // juros × principal por aqui — agenda inconsistente = DRE errado com cara
      // de certo. Ver lib/loans/validate-schedule.ts.
      const vNovo = validateSchedule({
        rows: schedule,
        base: d.principal,
        ratePositive: d.interestRateMonthly > 0,
        isPostFixed: d.rateType === 'POS',
      })
      if (!vNovo.ok) {
        return NextResponse.json(
          { erro: 'A agenda gerada não fecha — revise principal, taxa ou prazo.', code: 'SCHEDULE_INVALID', detalhes: vNovo.errors },
          { status: 422 },
        )
      }

      const loan = await prisma.loan.create({
        data: {
          companyId: empresaId,
          bankAccountId: d.bankAccountId,
          lender: d.lender,
          contractNumber: d.contractNumber ?? null,
          principal: d.principal,
          interestRateMonthly: d.interestRateMonthly,
          termMonths: d.termMonths,
          amortizationSystem: d.amortizationSystem,
          firstDueDate: d.firstDueDate,
          iof: d.iof,
          tarifas: d.tarifas,
          disbursementDate: d.disbursementDate,
          rateType: d.rateType,
          indexer: d.indexer ?? null,
          indexerPercent: d.indexerPercent ?? null,
          carencia: d.carencia,
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
    }

    // ====== Modo EM_ANDAMENTO ======
    const d = data as z.infer<typeof createMidLifeSchema>
    const { generateMidLifeSchedule } = await import('@/lib/loans/mid-life-schedule')
    const startNumber = d.installmentsPaidBefore + 1
    const overridesMap = d.paymentOverrides
      ? new Map(d.paymentOverrides.map((o) => [o.number, o.payment]))
      : undefined
    const schedule = generateMidLifeSchedule({
      outstandingBalance: d.outstandingBalanceInitial,
      rateMonthly: d.interestRateMonthly,
      futureCount: d.futureCount,
      startNumber,
      firstDueDate: d.firstDueDate,
      system: d.amortizationSystem,
      amortizationConstant: d.amortizationConstant ?? undefined,
      isPostFixed: d.rateType === 'POS',
      estimatedCorrectionMonthly: d.estimatedCorrectionMonthly ?? 0,
      paymentOverrides: overridesMap,
      fixedPayment: d.fixedPayment,
    })

    // GUARD (03/08/2026): mesma trava do modo NOVO. Aqui a base é o SALDO
    // DEVEDOR inicial (não o principal original). Para pós-fixado a agenda é
    // estimativa, mas ainda tem que fechar (Σamort=saldo, final=0, identidade).
    const vMid = validateSchedule({
      rows: schedule,
      base: d.outstandingBalanceInitial,
      ratePositive: d.interestRateMonthly > 0,
      isPostFixed: d.rateType === 'POS',
    })
    if (!vMid.ok) {
      return NextResponse.json(
        { erro: 'A agenda gerada não fecha — revise saldo devedor, parcela, taxa ou prazo.', code: 'SCHEDULE_INVALID', detalhes: vMid.errors },
        { status: 422 },
      )
    }

    const loan = await prisma.loan.create({
      data: {
        companyId: empresaId,
        bankAccountId: d.bankAccountId,
        lender: d.lender,
        contractNumber: d.contractNumber ?? null,
        // Princípio crítico: passivo = SALDO ATUAL, não principal original.
        // Mantemos principal como o saldo devedor inicial pra coerência com o
        // engine de saldo devedor existente (= principal - SUM(amort)).
        principal: d.outstandingBalanceInitial,
        outstandingBalanceInitial: d.outstandingBalanceInitial,
        interestRateMonthly: d.interestRateMonthly,
        termMonths: d.termMonths,
        amortizationSystem: d.amortizationSystem,
        amortizationConstant: d.amortizationConstant ?? null,
        firstDueDate: d.firstDueDate,
        iof: d.iof,
        tarifas: d.tarifas,
        // EM_ANDAMENTO: disbursementDate é informativa; quando omitida,
        // fallback pra firstDueDate (Loan.disbursementDate é NOT NULL).
        disbursementDate: d.disbursementDate ?? d.firstDueDate,
        rateType: d.rateType,
        indexer: d.indexer ?? null,
        indexerPercent: d.indexerPercent ?? null,
        carencia: d.carencia,
        installmentsPaidBefore: d.installmentsPaidBefore,
        trackingStartDate: d.trackingStartDate,
        installments: {
          create: schedule.map((r) => ({
            number: r.number,
            dueDate: r.dueDate,
            openingBalance: r.openingBalance,
            interest: r.interest,
            amortization: r.amortization,
            correcao: r.correcao,
            payment: r.payment,
            closingBalance: r.closingBalance,
            isEstimate: r.isEstimate,
          })),
        },
      },
      include: { installments: { orderBy: { number: 'asc' } } },
    })
    return NextResponse.json({ loan }, { status: 201 })
  } catch (error) {
    // Gerador lança quando a parcela informada não resolve taxa efetiva que
    // feche a agenda (parcela × prazo < saldo) — erro de cadastro, não 500.
    if (error instanceof InvalidLoanScheduleError) {
      return NextResponse.json(
        { erro: 'A agenda gerada não fecha — revise parcela, prazo, taxa ou saldo devedor.', code: 'SCHEDULE_INVALID', detalhes: error.errors },
        { status: 422 },
      )
    }
    return handleApiError(error)
  }
}

// Exporta helper pra detalhe usar
export async function computeOutstandingBalance(prismaArg: typeof prisma, loanId: string) {
  return compOut(prismaArg, loanId)
}
