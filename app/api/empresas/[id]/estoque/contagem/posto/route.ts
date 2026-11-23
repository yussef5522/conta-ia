// ⭐ R37/R40 — o POSTO DE COMANDO (abertura da contagem): acuracidade, R$ sob contagem, ajustes
// por semana, nunca contados e o mapa das zonas com o que conta hoje. Tudo derivado.
import { NextRequest, NextResponse } from 'next/server'
import { requireStock } from '@/lib/stock/require-stock'
import { postoDeComando } from '@/lib/stock/contagem/direcao-dados'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const posto = await postoDeComando(companyId)
  return NextResponse.json({ posto }, { headers: { 'Cache-Control': 'no-store' } })
}
