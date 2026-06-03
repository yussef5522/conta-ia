// Sprint PF Fatia 4 — GET /api/pontes/summary
// Agregados pra dashboard. Filtra por user logado (privacidade).
// Aceita ?companyId= ou ?profileId= ou ambos.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getBridgeSummary } from '@/lib/bridges/queries'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId') ?? undefined
    const profileId = searchParams.get('profileId') ?? undefined
    const dateFromParam = searchParams.get('dateFrom') ?? ''
    const dateToParam = searchParams.get('dateTo') ?? ''

    const summary = await getBridgeSummary({
      userId: user.sub,
      companyId: companyId ?? undefined,
      profileId: profileId ?? undefined,
      dateFrom: dateFromParam ? new Date(dateFromParam) : undefined,
      dateTo: dateToParam ? new Date(dateToParam) : undefined,
    })

    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json(
      { erro: (err as Error).message ?? 'Erro interno' },
      { status: 500 },
    )
  }
}
