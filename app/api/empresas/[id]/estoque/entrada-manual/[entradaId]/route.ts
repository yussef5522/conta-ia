// ESTOQUE — recibo de uma entrada manual (URL estável, igual ao da conferência).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { getEntradaManual } from '@/lib/stock/entrada-manual'

interface Params { params: Promise<{ id: string; entradaId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, entradaId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const recibo = await getEntradaManual(companyId, entradaId, prisma)
  if (!recibo) return NextResponse.json({ erro: 'Entrada não encontrada.' }, { status: 404 })
  return NextResponse.json({ recibo })
}
