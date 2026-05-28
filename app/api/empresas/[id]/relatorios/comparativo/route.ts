// Sprint 5.0.4.0a (a2) — GET Comparativo 3 Meses.
//
// Carrega transactions da empresa nos últimos 3 meses (a partir de refMonth)
// e delega cálculo pra lib pura.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  computeComparativo,
  threeMonthsForRef,
  type ComparativoInputTx,
} from '@/lib/relatorios/comparativo'

const querySchema = z.object({
  refMonth: z.string().regex(/^\d{4}-\d{2}$/, 'refMonth deve ser YYYY-MM'),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
  /** Regime: competência (default) usa competenceDate || date; caixa usa paymentDate || date. */
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
})

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    const meses = threeMonthsForRef(input.refMonth)

    // Carrega transactions dos 3 meses. Multi-tenant via OR em supplier/employee/etc.
    const txs = await prisma.transaction.findMany({
      where: {
        OR: [
          { bankAccount: { companyId: empresaId } },
          { supplier: { companyId: empresaId } },
          { employee: { companyId: empresaId } },
          { customer: { companyId: empresaId } },
          { category: { companyId: empresaId } },
        ],
        // Filtra status válidos pra cálculo (não usar IGNORED)
        status: { in: ['RECONCILED', 'PENDING'] },
        // Carregamos largo no SQL (range em date principal); lib pura aloca
        // por bucket usando competenceDate||date OR paymentDate||date conforme regime.
        date: { gte: meses.prev2.start, lte: meses.current.end },
      },
      select: {
        amount: true,
        type: true,
        date: true,
        competenceDate: true,
        paymentDate: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, dreGroup: true },
        },
      },
      take: 50_000, // cap defensivo (3 meses de uma empresa grande ~20k)
    })

    // Adapta pro tipo da lib pura
    const inputTxs: ComparativoInputTx[] = txs.map((t) => ({
      bucketDate:
        input.regime === 'caixa'
          ? (t.paymentDate ?? t.date)
          : (t.competenceDate ?? t.date),
      amount: t.amount,
      type: t.type,
      categoryId: t.category?.id ?? null,
      categoryName: t.category?.name ?? null,
      dreGroup: t.category?.dreGroup ?? null,
    }))

    const result = computeComparativo(inputTxs, input.refMonth, input.tipo)

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
