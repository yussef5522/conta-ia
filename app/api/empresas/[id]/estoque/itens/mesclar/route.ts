// ⭐ MESCLAR ITENS DUPLICADOS — GET prévia · POST executa (29/08/2026, caso das 2 BOBINAS).
//
// ⚠️ `stock.manage`: mesclar mexe no ledger e no cadastro — é decisão de quem gerencia,
// não de quem opera. Ler a prévia é `stock.view` (ler nunca exige gerenciar).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { previewMesclagem, mesclarItens, MesclarError } from '@/lib/stock/itens/mesclar'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const sobrevivente = request.nextUrl.searchParams.get('sobrevivente') ?? ''
  const absorvido = request.nextUrl.searchParams.get('absorvido') ?? ''
  if (!sobrevivente || !absorvido) return NextResponse.json({ erro: 'Escolha os dois itens.' }, { status: 400 })
  try {
    return NextResponse.json({ previa: await previewMesclagem(companyId, sobrevivente, absorvido, prisma) })
  } catch (e) {
    if (e instanceof MesclarError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

const schema = z.object({ sobreviventeId: z.string().min(1), absorvidoId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha qual item fica e qual é absorvido.' }, { status: 400 })
  try {
    const r = await mesclarItens({ companyId, ...parsed.data, userId: a.user?.sub ?? null }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof MesclarError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
