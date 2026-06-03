// Sprint PF Fatia 4 — GET /api/perfis/[id]/pontes
// Lista pontes do perfil PF — multi-tenant via checkProfileAccess.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listBridges } from '@/lib/bridges/queries'
import { checkProfileAccess, ProfileAccessError } from '@/lib/personal-profile/queries'
import type { BridgeKind } from '@/lib/bridges/types'

function errorResponse(err: unknown) {
  if (err instanceof ProfileAccessError) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
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
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { id: profileId } = await params
    await checkProfileAccess(user.sub, profileId, 'OWNER')

    const { searchParams } = new URL(request.url)
    const kindParam = searchParams.get('kind') ?? ''
    const companyIdParam = searchParams.get('companyId') ?? ''
    const dateFromParam = searchParams.get('dateFrom') ?? ''
    const dateToParam = searchParams.get('dateTo') ?? ''
    const pageParam = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSizeParam = parseInt(searchParams.get('pageSize') ?? '20', 10)

    const result = await listBridges({
      userId: user.sub,
      profileId,
      companyId: companyIdParam || undefined,
      kind: VALID_KINDS.includes(kindParam as BridgeKind) ? (kindParam as BridgeKind) : undefined,
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
