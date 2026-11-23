// ⭐ R42 — o recibo da sessão (itens, bateram, ajustes líquido/mexido, a apurar, tempo, zonas assinadas).
import { NextRequest, NextResponse } from 'next/server'
import { requireStock } from '@/lib/stock/require-stock'
import { reciboDaSessao } from '@/lib/stock/contagem/direcao-dados'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const contagemId = request.nextUrl.searchParams.get('contagemId')
  if (!contagemId) return NextResponse.json({ erro: 'Diga qual contagem.' }, { status: 400 })
  try {
    return NextResponse.json({ recibo: await reciboDaSessao(companyId, contagemId) })
  } catch (e) { return respostaDaDirecao(e) }
}
