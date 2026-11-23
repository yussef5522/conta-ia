// ⭐ R43 — as zonas do dono: listar (com o "sem zona") e criar.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStock } from '@/lib/stock/require-stock'
import { criarZona, zonasDoDono } from '@/lib/stock/contagem/zonas'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  return NextResponse.json(await zonasDoDono(companyId), { headers: { 'Cache-Control': 'no-store' } })
}

const schema = z.object({ nome: z.string().max(80) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dê um nome pra zona.' }, { status: 400 })
  try {
    const zona = await criarZona(companyId, parsed.data.nome, auth.userId)
    return NextResponse.json({ ok: true, zona: { id: zona.id, nome: zona.nome } })
  } catch (e) { return respostaDaDirecao(e) }
}
