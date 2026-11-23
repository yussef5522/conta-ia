// ⭐ R36 — o grupo do item (A/B/C) é clique do dono; `grupo: null` = ignorar o candidato.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStock } from '@/lib/stock/require-stock'
import { definirGrupo } from '@/lib/stock/contagem/zonas'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ itemId: z.string().min(1), grupo: z.enum(['A', 'B', 'C']).nullable() })

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Grupo é A, B ou C (ou ignorar).' }, { status: 400 })
  try {
    await definirGrupo(companyId, parsed.data.itemId, parsed.data.grupo, auth.userId)
    return NextResponse.json({ ok: true })
  } catch (e) { return respostaDaDirecao(e) }
}
