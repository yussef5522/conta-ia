// ⭐ R43 — renomear e EXCLUIR. ⛔ Excluir nunca apaga item: os itens ficam "sem zona".
// GET devolve quantos itens a zona tem — a frase da confirmação diz QUANTOS antes do clique.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStock } from '@/lib/stock/require-stock'
import { excluirZona, itensDaZona, renomearZona } from '@/lib/stock/contagem/zonas'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string; zonaId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, zonaId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  return NextResponse.json({ itens: await itensDaZona(companyId, zonaId) })
}

const schema = z.object({ nome: z.string().max(80) })

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, zonaId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dê um nome pra zona.' }, { status: 400 })
  try {
    const z2 = await renomearZona(companyId, zonaId, parsed.data.nome)
    return NextResponse.json({ ok: true, zona: { id: z2.id, nome: z2.nome } })
  } catch (e) { return respostaDaDirecao(e) }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, zonaId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  try {
    return NextResponse.json({ ok: true, ...(await excluirZona(companyId, zonaId)) })
  } catch (e) { return respostaDaDirecao(e) }
}
