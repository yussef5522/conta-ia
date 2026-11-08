// ⭐ 08/11/2026 — A MAÇANETA DO CONFLITO: GET lê o comparador, POST é o gesto do dono.
// A régua mora em `lib/stock/vendas/conflito-de-grafia.ts`; aqui é só a porta HTTP.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { lerComparadorDoConflito, escolherFichaDoConflito, ConflitoDeGrafiaError } from '@/lib/stock/vendas/conflito-de-grafia'
import { VendaMapError } from '@/lib/stock/vendas/venda-map'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const nome = request.nextUrl.searchParams.get('nome') ?? ''
  if (!nome.trim()) return NextResponse.json({ erro: 'Informe o nome.' }, { status: 400 })
  try {
    const comparador = await lerComparadorDoConflito(companyId, nome, prisma)
    return NextResponse.json({ comparador })
  } catch (e) {
    if (e instanceof ConflitoDeGrafiaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

const schema = z.object({
  nome: z.string().min(1),
  fichaEscolhidaId: z.string().min(1),
  inativar: z.array(z.string().min(1)).default([]),
  inativarMesmoComConsumidores: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha inválida.' }, { status: 400 })
  const { nome, ...escolha } = parsed.data
  try {
    const r = await escolherFichaDoConflito(companyId, nome, escolha, a.user.sub, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ConflitoDeGrafiaError || e instanceof VendaMapError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
