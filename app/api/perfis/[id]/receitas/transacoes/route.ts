// Sprint Receitas-PF (02/07/2026).
//
// GET /api/perfis/[id]/receitas/transacoes?categoryId=&de=&ate=&q=&originFilter=&limit=&offset=
//
// Drill-down: lista tx CREDIT da categoria. Include bridge.pjTransaction.
// bankAccount.company pro selo "↩ {empresa} · {data}".

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import { getPersonalIncomeTransactions } from '@/lib/dashboard-pf/income-breakdown'

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

    const categoryIdRaw = url.searchParams.get('categoryId')
    const categoryId =
      categoryIdRaw === 'null' ? null : categoryIdRaw ?? undefined
    const q = url.searchParams.get('q') ?? undefined
    const limit = parseInt(url.searchParams.get('limit') ?? '100')
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    const originFilterRaw = url.searchParams.get('originFilter')
    const originFilter: 'bridge' | 'externa' | 'both' | undefined =
      originFilterRaw === 'bridge' || originFilterRaw === 'externa' || originFilterRaw === 'both'
        ? originFilterRaw
        : undefined
    const bankAccountId = url.searchParams.get('bankAccountId') ?? undefined

    const result = await getPersonalIncomeTransactions({
      profileId,
      periodStart,
      periodEnd,
      categoryId,
      q,
      limit,
      offset,
      originFilter,
      bankAccountId,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      return NextResponse.json({ erro: err.message }, { status: 403 })
    }
    return handleApiError(err)
  }
}
