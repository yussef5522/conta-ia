// ⭐ R41 — o item conta a própria história: saldo 14 dias, pontos das contagens, nunca-bate e a caixa.
import { NextRequest, NextResponse } from 'next/server'
import { requireStock } from '@/lib/stock/require-stock'
import { historiaDoItem } from '@/lib/stock/contagem/direcao-dados'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string; itemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  try {
    return NextResponse.json({ historia: await historiaDoItem(companyId, itemId) })
  } catch (e) { return respostaDaDirecao(e) }
}
