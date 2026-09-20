// ⭐ AS LISTAS DO RADAR — POST (pôr) e DELETE (tirar).
//
// ⛔ `stock.manage`, não `operate`: escolher o que a empresa VIGIA é decisão de gestão —
// a mesma fronteira do mín/máx e do mapa de vendas. Quem opera conta; quem manda decide
// o que é caro o bastante pra vigiar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { porNaLista, tirarDaLista, LISTAS } from '@/lib/stock/radar/watchlist'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string }> }

const corpo = z.object({
  lista: z.enum(['CAROS', 'PORCOES']),
  itemId: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  try {
    const p = corpo.safeParse(await request.json())
    if (!p.success) return NextResponse.json({ erro: `Escolha uma das listas (${LISTAS.join(' ou ')}) e um item.` }, { status: 422 })
    // ⚠️ REGRA 8 — o item tem que ser DESTA empresa: sem isto, um id de outra empresa
    // entraria na lista e o Radar mostraria (e somaria) dinheiro que não é dela.
    const item = await prisma.stockItem.findFirst({ where: { id: p.data.itemId, companyId }, select: { id: true } })
    if (!item) return NextResponse.json({ erro: 'Este item não é desta empresa.' }, { status: 404 })
    await porNaLista({ companyId, lista: p.data.lista, itemId: p.data.itemId, quem: auth.userId }, prisma)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  try {
    const sp = request.nextUrl.searchParams
    const p = corpo.safeParse({ lista: sp.get('lista'), itemId: sp.get('itemId') })
    if (!p.success) return NextResponse.json({ erro: 'Diga a lista e o item.' }, { status: 422 })
    await tirarDaLista({ companyId, lista: p.data.lista, itemId: p.data.itemId }, prisma)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}
