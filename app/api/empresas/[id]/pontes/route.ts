// Sprint PF Fatia 4 — GET /api/empresas/[id]/pontes
// Lista pontes (filtradas por user logado — privacidade multi-sócio).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { listBridges } from '@/lib/bridges/queries'
import type { BridgeKind } from '@/lib/bridges/types'

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  throw err
}

const VALID_KINDS: BridgeKind[] = [
  'PRO_LABORE', 'DISTRIBUICAO', 'REEMBOLSO', 'ADIANTAMENTO', 'RETIRADA_SOCIOS',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const { searchParams } = new URL(request.url)
    const kindParam = searchParams.get('kind') ?? ''
    const profileIdParam = searchParams.get('profileId') ?? ''
    const dateFromParam = searchParams.get('dateFrom') ?? ''
    const dateToParam = searchParams.get('dateTo') ?? ''
    const pageParam = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSizeParam = parseInt(searchParams.get('pageSize') ?? '20', 10)

    const result = await listBridges({
      userId: ctx.user.id,
      companyId,
      kind: VALID_KINDS.includes(kindParam as BridgeKind) ? (kindParam as BridgeKind) : undefined,
      profileId: profileIdParam || undefined,
      dateFrom: dateFromParam ? new Date(dateFromParam) : undefined,
      dateTo: dateToParam ? new Date(dateToParam) : undefined,
      page: isNaN(pageParam) ? 1 : pageParam,
      pageSize: isNaN(pageSizeParam) ? 20 : pageSizeParam,
    })

    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
