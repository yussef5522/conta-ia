// ⭐ "NÃO BAIXAR — DECISÃO": marca e desmarca o dia. Ver `lib/stock/vendas/dia-dispensado.ts`.
//
// ⚠️ Permissão LITERAL em cada handler (o guard estrutural recusa ternário). Dispensar é
// decisão de operação sobre o dia — `stock.operate`, o mesmo nível de baixar.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { dispensarDia, reverterDispensa, listarDispensas, DispensaError, ESCOPOS } from '@/lib/stock/vendas/dia-dispensado'

interface Params { params: Promise<{ id: string }> }

const escopo = z.enum(ESCOPOS)
const schema = z.object({
  escopo,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha o dia.'),
  motivo: z.string().max(300).nullable().optional(),
  importId: z.string().nullable().optional(),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const e = escopo.safeParse(new URL(request.url).searchParams.get('escopo') ?? 'COMPLEMENTO')
  if (!e.success) return NextResponse.json({ erro: 'Escopo inválido.' }, { status: 400 })
  return NextResponse.json({ dispensas: await listarDispensas(companyId, e.data, prisma) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  try {
    return NextResponse.json(await dispensarDia({ companyId, ...parsed.data, userId: a.user!.sub }, prisma))
  } catch (e) {
    if (e instanceof DispensaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const { searchParams } = new URL(request.url)
  const parsed = schema.pick({ escopo: true, data: true }).safeParse({
    escopo: searchParams.get('escopo') ?? 'COMPLEMENTO', data: searchParams.get('data') ?? '',
  })
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  try {
    return NextResponse.json(await reverterDispensa(companyId, parsed.data.escopo, parsed.data.data, a.user!.sub, prisma))
  } catch (e) {
    if (e instanceof DispensaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
