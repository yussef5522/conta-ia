// ⭐ A FICHA QUE CHEGOU DEPOIS (25/11/2026) — GET: o que ficou pra trás (só leitura) · POST: o SIM do dono
// pra UM acerto (movimento novo, datado de hoje, idempotente). ⛔ Nada aqui reprocessa o passado.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listarFichaTardia, acertarFichaTardia, AcertoFichaTardiaError } from '@/lib/stock/vendas/ficha-tardia'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const fichaId = request.nextUrl.searchParams.get('fichaId')
  const nomes = request.nextUrl.searchParams.getAll('nome').filter(Boolean)
  return NextResponse.json({ pendencias: await listarFichaTardia(companyId, { fichaId, nomes }, prisma) })
}

const schema = z.object({ importId: z.string().min(1), nomeSuitable: z.string().min(1) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Acerto inválido.' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await acertarFichaTardia(companyId, parsed.data, a.user?.sub, prisma)) })
  } catch (e) {
    if (e instanceof AcertoFichaTardiaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    console.error(`[ficha-tardia] acerto falhou: ${e instanceof Error ? e.name : 'erro'}`)
    return NextResponse.json({ erro: 'Não consegui fazer o acerto agora.' }, { status: 500 })
  }
}
