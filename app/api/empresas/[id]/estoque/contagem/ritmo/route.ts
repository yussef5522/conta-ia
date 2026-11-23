// ⭐ R36/R43 — o ritmo por grupo (padrão A todo dia · B semanal · C mensal), editável pelo dono.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStock } from '@/lib/stock/require-stock'
import { definirRitmo } from '@/lib/stock/contagem/zonas'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string }> }
const dias = z.number().int()
const schema = z.object({ A: dias, B: dias, C: dias })

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Diga os dias de cada grupo (A, B e C).' }, { status: 400 })
  try {
    await definirRitmo(companyId, parsed.data, auth.userId)
    return NextResponse.json({ ok: true })
  } catch (e) { return respostaDaDirecao(e) }
}
