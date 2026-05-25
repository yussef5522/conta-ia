// Sprint 5.0.1 — histórico de cálculos DAS (últimos 12 meses por padrão).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const sp = request.nextUrl.searchParams
    const limit = Math.min(60, Math.max(1, Number(sp.get('limit') ?? 12)))

    const calculations = await prisma.taxCalculation.findMany({
      where: { companyId },
      orderBy: [{ paYear: 'desc' }, { paMonth: 'desc' }],
      take: limit,
    })

    return NextResponse.json({
      calculations: calculations.map((c) => ({
        ...c,
        breakdownParsed: safeParse(c.breakdown),
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
