// ⭐ R37 — ZONA FECHADA ASSINA: a conta logada; em conta de APARELHO, o PIN de quem contou.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStock } from '@/lib/stock/require-stock'
import { assinarZona } from '@/lib/stock/contagem/direcao-dados'
import { respostaDaDirecao } from '@/lib/stock/contagem/resposta'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ contagemId: z.string().min(1), zonaChave: z.string().min(1), pin: z.string().max(12).nullable().optional() })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Diga qual zona fechar.' }, { status: 400 })
  try {
    const a = await assinarZona({ companyId, ...parsed.data, userId: auth.userId, userName: auth.userName })
    return NextResponse.json({ ok: true, assinatura: { quem: a.assinadoPorNome, quando: a.assinadoEm.toISOString(), viaPin: a.viaPin } })
  } catch (e) { return respostaDaDirecao(e) }
}
