// Sprint Export CSV+PDF (29/05/2026) — Endpoint export Fluxo de Caixa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  calculateConsolidatedCashflow,
  type CashflowTransaction,
} from '@/lib/cashflow/consolidated'
import {
  computeCashFlowProjection,
  computeAccumulatedBalance,
  type ProjectionInputTx,
} from '@/lib/relatorios/cash-flow'
import {
  renderFluxoCaixaCSV,
  renderFluxoCaixaPDF,
} from '@/lib/export/render/fluxo-caixa'
import { exportFilename } from '@/lib/export/csv/format'

export const runtime = 'nodejs'

const querySchema = z.object({
  meses: z.coerce.number().int().min(1).max(24).default(6),
  format: z.enum(['csv', 'pdf']).default('csv'),
})

interface Params {
  params: Promise<{ id: string }>
}

function formatGeradoEmBR(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    const empresa = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { name: true, tradeName: true },
    })
    const empresaNome = empresa?.tradeName ?? empresa?.name ?? 'Empresa'

    const now = new Date()
    const currentMonthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    )
    const startMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (input.meses - 1), 1),
    )

    const [txRealizadoRaw, txPrevistoRaw, accounts] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId: empresaId },
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          date: { gte: startMonth, lte: currentMonthEnd },
        },
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          category: { select: { dreGroup: true } },
        },
        take: 50_000,
      }),
      prisma.transaction.findMany({
        where: {
          OR: [
            { bankAccount: { companyId: empresaId } },
            { supplier: { companyId: empresaId } },
            { employee: { companyId: empresaId } },
            { customer: { companyId: empresaId } },
            { category: { companyId: empresaId } },
          ],
          lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
          paymentDate: null,
          dueDate: {
            gt: now,
            lte: new Date(now.getTime() + 90 * 86_400_000),
          },
        },
        select: { type: true, amount: true, dueDate: true },
        take: 10_000,
      }),
      prisma.bankAccount.findMany({
        where: { companyId: empresaId, isActive: true },
        select: { balance: true },
      }),
    ])

    const realizadoTxs: CashflowTransaction[] = txRealizadoRaw.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
      dreGroup: t.category?.dreGroup ?? null,
    }))

    const realizado = calculateConsolidatedCashflow(
      realizadoTxs,
      { startDate: startMonth, endDate: currentMonthEnd, groupBy: 'month' },
      empresaId,
    )

    const saldoAtual = accounts.reduce((s, a) => s + a.balance, 0)
    const saldoInicial = saldoAtual - realizado.totals.net

    const acumulado = computeAccumulatedBalance(
      realizado.byPeriod.map((b) => ({
        bucketStart: b.bucketStart,
        net: b.net,
      })),
      saldoInicial,
    )

    const projTxs: ProjectionInputTx[] = txPrevistoRaw.map((t) => ({
      type: t.type,
      amount: t.amount,
      dueDate: t.dueDate ?? now,
    }))
    const projecao = computeCashFlowProjection(projTxs, now)

    const data = {
      saldoAtual,
      realizado: {
        byMonth: realizado.byPeriod.map((b) => ({
          monthKey: b.bucketStart.toISOString().slice(0, 7),
          income: b.income,
          expense: b.expense,
          net: b.net,
        })),
        totals: realizado.totals,
        acumulado: acumulado.map((a) => ({
          monthKey: a.bucketKey,
          saldo: a.saldoAcumulado,
        })),
      },
      projecao,
    }

    if (input.format === 'csv') {
      const csv = renderFluxoCaixaCSV(data)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename('fluxo-caixa', empresaNome, 'csv')}"`,
          'X-Row-Count': String(data.realizado.byMonth.length),
        },
      })
    }

    const buf = await renderToBuffer(
      renderFluxoCaixaPDF(data, {
        empresaNome,
        geradoEm: formatGeradoEmBR(new Date()),
        meses: input.meses,
      }),
    )
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename('fluxo-caixa', empresaNome, 'pdf')}"`,
        'X-Row-Count': String(data.realizado.byMonth.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
