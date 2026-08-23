// ESTOQUE FASE 3 PARTE 2 — GET quadro da contagem · POST inicia a sessão.
// Rota NASCE com requireStock (Fase 3 Parte 1): view pra ver, operate pra contar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { getQuadro, iniciarContagem, ContagemError } from '@/lib/stock/contagem'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  return NextResponse.json({ quadro: await getQuadro(companyId, new Date(), prisma) })
}

const schemaPost = z.object({
  tipo: z.enum(['INICIAL', 'ROTINA']).optional(),
  observacao: z.string().max(300).optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schemaPost.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    const c = await iniciarContagem(companyId, { ...parsed.data, userId: auth.userId, userName: auth.userName }, prisma)
    return NextResponse.json({ ok: true, contagem: { id: c.id, tipo: c.tipo, status: c.status } })
  } catch (e) {
    if (e instanceof ContagemError) return NextResponse.json({ erro: e.message, code: e.code }, { status: 409 })
    throw e
  }
}
