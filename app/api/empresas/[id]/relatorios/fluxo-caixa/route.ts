// Sprint 5.0.4.0b Fase 3 — Endpoint Fluxo de Caixa.
// Retorna: realizado mensal (6 meses) + projeção 30/60/90.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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

export const runtime = 'nodejs'

const querySchema = z.object({
  // Realizado: últimos N meses (default 6, máx 24)
  meses: z.coerce.number().int().min(1).max(24).default(6),
  modo: z.enum(['realizado', 'previsto', 'ambos']).default('ambos'),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    const now = new Date()
    const currentMonthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    )
    const startMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (input.meses - 1), 1),
    )

    // 2 queries paralelas: realizado + previsto
    const [txRealizadoRaw, txPrevistoRaw, accounts] = await Promise.all([
      // Realizado: EFFECTED no range, multi-tenant via bankAccount
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
      // Previsto: PAYABLE/RECEIVABLE não pagos com dueDate nos próximos 90d
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
        select: {
          type: true,
          amount: true,
          dueDate: true,
        },
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

    // Saldo atual = soma cacheada das contas (NÃO recalcula do zero — performance)
    const saldoAtual = accounts.reduce((s, a) => s + a.balance, 0)

    // Saldo inicial = saldo atual - net dos buckets já contabilizados.
    // Isso assume que o "saldo atual" é o saldo de HOJE; pra projetar pra trás,
    // subtraímos o net consolidado do período inteiro.
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

    return NextResponse.json({
      modo: input.modo,
      saldoAtual,
      meses: input.meses,
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
    })
  } catch (error) {
    return handleApiError(error)
  }
}
