// ⭐ R43 — os itens da zona: adicionar (POST), remover na linha (DELETE), arrastar a ordem (PUT).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStock } from '@/lib/stock/require-stock'
import { adicionarItemNaZona, ordenarZona, removerItemDaZona } from '@/lib/stock/contagem/zonas'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string; zonaId: string }> }
const umItem = z.object({ itemId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, zonaId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = umItem.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha o item.' }, { status: 400 })
  try {
    await adicionarItemNaZona(companyId, zonaId, parsed.data.itemId, auth.userId)
    return NextResponse.json({ ok: true })
  } catch (e) { return respostaDaDirecao(e) }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = umItem.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha o item.' }, { status: 400 })
  await removerItemDaZona(companyId, parsed.data.itemId)
  return NextResponse.json({ ok: true })
}

const ordem = z.object({ itemIds: z.array(z.string().min(1)).max(2000) })

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId, zonaId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = ordem.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Ordem inválida.' }, { status: 400 })
  try {
    await ordenarZona(companyId, zonaId, parsed.data.itemIds, auth.userId)
    return NextResponse.json({ ok: true })
  } catch (e) { return respostaDaDirecao(e) }
}
