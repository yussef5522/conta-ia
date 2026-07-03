// Sprint Receitas-PF (02/07/2026).
//
// GET /api/perfis/[id]/receitas?de=YYYY-MM-DD&ate=YYYY-MM-DD&originFilter=&bankAccountId=
//
// Retorna breakdown de receitas + cashflow em 1 chamada (reusa
// getPersonalCashFlow do Sprint Despesas-PF — já traz entrou/saiu/sobrou
// + entrou_bridge/entrou_outros).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import { getPersonalIncomeBreakdown } from '@/lib/dashboard-pf/income-breakdown'
import { getPersonalCashFlow } from '@/lib/dashboard-pf/expenses-breakdown'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: profileId } = await params
    const ctx = await getAuthContext(request)
    await checkProfileAccess(ctx.user.id, profileId, 'OWNER')

    const url = new URL(request.url)
    const now = new Date()
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const deParam = url.searchParams.get('de')
    const ateParam = url.searchParams.get('ate')
    const periodStart = deParam ? new Date(`${deParam}T00:00:00.000Z`) : defaultStart
    const periodEnd = ateParam ? new Date(`${ateParam}T00:00:00.000Z`) : defaultEnd

    const originFilterRaw = url.searchParams.get('originFilter')
    const originFilter: 'bridge' | 'externa' | 'both' | undefined =
      originFilterRaw === 'bridge' || originFilterRaw === 'externa' || originFilterRaw === 'both'
        ? originFilterRaw
        : undefined
    const bankAccountId = url.searchParams.get('bankAccountId') ?? undefined

    const [breakdown, cashflow] = await Promise.all([
      getPersonalIncomeBreakdown({
        profileId,
        periodStart,
        periodEnd,
        originFilter,
        bankAccountId,
      }),
      getPersonalCashFlow({ profileId, periodStart, periodEnd }),
    ])

    return NextResponse.json({ breakdown, cashflow })
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      return NextResponse.json({ erro: err.message }, { status: 403 })
    }
    return handleApiError(err)
  }
}
