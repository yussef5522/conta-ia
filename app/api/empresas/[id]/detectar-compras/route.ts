// Sprint 5.0.2.f — GET /api/empresas/[id]/detectar-compras
// Detecta compras (créditos PIS/COFINS) últimos 12m via heurística nas Transactions.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { detectComprasUltimos12m } from '@/lib/tax/detect-compras'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const result = await detectComprasUltimos12m(companyId)
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
