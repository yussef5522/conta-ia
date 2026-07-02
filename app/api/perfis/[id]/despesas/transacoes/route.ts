// Sprint Despesas-PF (02/07/2026).
//
// GET /api/perfis/[id]/despesas/transacoes?categoryId=&de=&ate=&q=&limit=&offset=
// + sourceFilter + onlyBridgeSpend + bankAccountId + creditCardId
//
// Drill-down: lista tx da categoria escolhida. Include bridgeAsSpend
// pra marcar as que "vieram de retirada PJ".

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import { getPersonalExpenseTransactions } from '@/lib/dashboard-pf/expenses-breakdown'

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

    const sourceFilterRaw = url.searchParams.get('sourceFilter')
    const sourceFilter: 'card' | 'account' | 'both' | undefined =
      sourceFilterRaw === 'card' || sourceFilterRaw === 'account' || sourceFilterRaw === 'both'
        ? sourceFilterRaw
        : undefined
    const onlyBridgeSpend = url.searchParams.get('onlyBridgeSpend') === 'true'
    const bankAccountId = url.searchParams.get('bankAccountId') ?? undefined
    const creditCardId = url.searchParams.get('creditCardId') ?? undefined

    const result = await getPersonalExpenseTransactions({
      profileId,
      periodStart,
      periodEnd,
      categoryId,
      q,
      limit,
      offset,
      sourceFilter,
      onlyBridgeSpend,
      bankAccountId,
      creditCardId,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      return NextResponse.json({ erro: err.message }, { status: 403 })
    }
    return handleApiError(err)
  }
}
