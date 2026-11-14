// ⭐ EQUIPE (lei R20–R23, 13/11/2026) — contas e PIN. ⛔ R21: o PIN NUNCA volta em resposta (só `temPin`).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { contasDaEquipe, criarConta, EquipeError } from '@/lib/stock/producao/contas-da-equipe'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ contas: await contasDaEquipe(companyId, prisma) })
}

const criarSchema = z.object({
  nome: z.string().min(1).max(60),
  papel: z.enum(['cozinha', 'escritorio', 'aparelho']),
  pin: z.string().regex(/^\d{4}$/).optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const p = criarSchema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'Confira nome, papel e PIN (4 dígitos, só números).' }, { status: 400 })
  try {
    const r = await criarConta({ companyId, ...p.data, userId: a.user.sub }, prisma)
    return NextResponse.json({ ok: true, colaboradorId: r.colaboradorId })
  } catch (e) {
    if (e instanceof EquipeError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
