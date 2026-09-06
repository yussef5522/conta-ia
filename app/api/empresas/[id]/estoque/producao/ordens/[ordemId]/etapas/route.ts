// ETAPAS DA ORDEM — a gerência designa quem faz cada uma (06/09/2026).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { etapasDaOrdem, designarEtapa, EtapaError } from '@/lib/stock/producao/etapas'

interface Params { params: Promise<{ id: string; ordemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}

const schema = z.object({
  etapaId: z.string().min(1),
  // ⚠️ null = tirar a designação (a etapa volta a ser "quem pegar com o PIN")
  colaboradorId: z.string().min(1).nullable(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  // ⭐ designar é OPERAR, não gerenciar: é o encarregado montando o dia, não mexendo em ficha
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    await designarEtapa({ companyId, etapaId: parsed.data.etapaId, colaboradorId: parsed.data.colaboradorId, userId: a.user.sub }, prisma)
  } catch (e) {
    if (e instanceof EtapaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}
