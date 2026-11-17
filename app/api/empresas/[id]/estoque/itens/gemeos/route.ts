// ⭐⭐ A FILA DE CASAMENTO ASSISTIDO (16/11/2026). GET: os pares parecidos sem resposta (com saldo e unidade
// de cada lado). POST: a resposta do dono — "juntar" (funde com prova de saldo) ou "são diferentes".
// ⛔ A máquina nunca funde por semelhança: este POST exige sessão de quem gerencia o estoque.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { paresSuspeitos, decidirPar, ParError } from '@/lib/stock/itens/fila-de-gemeos'
import { MesclarError } from '@/lib/stock/itens/mesclar'
import { saldoItem } from '@/lib/stock/saldo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const pares = await paresSuspeitos(companyId, prisma)
  const ids = [...new Set(pares.flatMap((p) => [p.a.id, p.b.id]))]
  const saldos = new Map(await Promise.all(ids.map(async (id) => [id, (await saldoItem(prisma, companyId, id)).saldo] as const)))
  return NextResponse.json({ pares: pares.map((p) => ({ a: { ...p.a, saldo: saldos.get(p.a.id) ?? 0 }, b: { ...p.b, saldo: saldos.get(p.b.id) ?? 0 } })) })
}

const schema = z.object({ itemXId: z.string().min(1), itemYId: z.string().min(1), decisao: z.enum(['JUNTAR', 'DIFERENTES']) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Diga o par e a decisão.' }, { status: 400 })
  try {
    return NextResponse.json(await decidirPar({ companyId, ...parsed.data, userId: a.user!.sub }, prisma))
  } catch (e) {
    if (e instanceof ParError || e instanceof MesclarError) return NextResponse.json({ erro: e.message }, { status: 422 })
    console.error('[estoque/itens/gemeos] falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui gravar a resposta. Nada mudou — tente de novo.' }, { status: 500 })
  }
}
