// Sprint 6 — GET /api/empresas/[id]/despesas/transacoes
//
// Retorna as transações de despesa do período (drill-down do Top 5).
// Reusa loadExpenseTransactions do motor único — MESMOS filtros do
// dashboard (EFFECTED + EXPENSE_DRE_GROUPS + regime caixa/competência).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { getExpenseTransactions } from '@/lib/dashboard/expenses-breakdown'
import type { Regime } from '@/lib/dashboard/engine'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const url = new URL(request.url)
    const regime: Regime = url.searchParams.get('regime') === 'competencia' ? 'competencia' : 'caixa'
    const de = url.searchParams.get('de')
    const ate = url.searchParams.get('ate')
    if (!de || !ate) {
      return NextResponse.json({ error: 'parametros de e ate obrigatorios' }, { status: 400 })
    }

    const categoryId = url.searchParams.get('categoryId') ?? undefined
    const bankAccountId = url.searchParams.get('contaId') ?? undefined
    const q = url.searchParams.get('q') ?? undefined
    const limit = Number(url.searchParams.get('limit') ?? '100')
    const offset = Number(url.searchParams.get('offset') ?? '0')

    const result = await getExpenseTransactions({
      companyId,
      periodStart: new Date(`${de}T00:00:00.000Z`),
      periodEnd: new Date(`${ate}T23:59:59.999Z`),
      regime,
      categoryId,
      bankAccountId,
      q,
      limit,
      offset,
    })

    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err)
  }
}
