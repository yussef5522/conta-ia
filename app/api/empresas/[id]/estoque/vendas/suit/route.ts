// SUITAPI — o estado do laço (faixa + tela) e a DECISÃO do dono sobre pedido que mudou depois
// que o dia entrou. GET = stock.view · POST = stock.operate. ⛔ Nada de dado pessoal no payload.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { estadoDaSuit, decidirDia } from '@/lib/suit/decisao'
import { SanidadeNaoConfirmadaError } from '@/lib/stock/vendas/medir-sanidade'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json(await estadoDaSuit(prisma, companyId, new Date()))
}

const corpo = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dia inválido.'),
  decisao: z.enum(['MANTER', 'ATUALIZAR']),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const p = corpo.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: p.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  try {
    const r = await decidirDia(prisma, companyId, p.data.dia, p.data.decisao, a.user.sub, new Date())
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof SanidadeNaoConfirmadaError) return NextResponse.json({ erro: e.message }, { status: 409 })
    console.error('[vendas/suit] decisão falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: (e as Error)?.message ?? 'Não consegui aplicar a decisão.' }, { status: 500 })
  }
}
