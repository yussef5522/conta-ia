// ESTOQUE FASE 2 item 2.3 — etiqueta da conclusão (dados + ZPL). ?modo=lote|unidade.
// ?formato=zpl baixa o ZPL cru (pro agente da Zebra); default JSON pra tela imprimível.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { etiquetasDaConclusao } from '@/lib/stock/producao/etiqueta'

interface Params { params: Promise<{ id: string; conclusaoId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, conclusaoId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const modo = request.nextUrl.searchParams.get('modo') === 'unidade' ? 'unidade' : 'lote'
  const r = await etiquetasDaConclusao(companyId, conclusaoId, modo)
  if (!r) return NextResponse.json({ erro: 'Conclusão não encontrada' }, { status: 404 })
  if (request.nextUrl.searchParams.get('formato') === 'zpl') {
    return new NextResponse(r.zpl, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="etiqueta-${r.etiqueta.lote}.zpl"` } })
  }
  return NextResponse.json(r)
}
