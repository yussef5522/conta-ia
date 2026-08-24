// ESTOQUE FASE 1 item 4 — GET recibo da conferência (derivado do gravado). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { buildRecibo } from '@/lib/stock/recibo'

interface Params { params: Promise<{ id: string; conferenceId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, conferenceId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const recibo = await buildRecibo(companyId, conferenceId)
  if (!recibo) return NextResponse.json({ erro: 'Recibo não encontrado' }, { status: 404 })
  return NextResponse.json({ recibo })
}
