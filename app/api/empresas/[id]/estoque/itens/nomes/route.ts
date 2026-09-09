// ⭐ A REVISÃO DOS NOMES EM LOTE — GET lista a sugestão, POST confirma o que o dono aprovou.
//
// ⛔ O GET **não grava nada**: abrir a tela não pode renomear o catálogo inteiro (a mesma
// regra do lote das seções do cardápio — "ler não escreve").

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { itensParaRevisarNome, renomearEmLote, RenomearError } from '@/lib/stock/nomes/renomear-em-lote'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ itens: await itensParaRevisarNome(companyId, prisma) })
}

const schema = z.object({
  renomeios: z.array(z.object({ itemId: z.string().min(1), nomeNovo: z.string().min(1).max(120) })).min(1),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  // ⛔ renomear item do catálogo é decisão do dono, não operação do dia — `stock.manage`
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Marque ao menos um nome pra confirmar.' }, { status: 400 })
  try {
    const r = await renomearEmLote({ companyId, userId: a.user!.sub, pedidos: parsed.data.renomeios }, prisma)
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof RenomearError) return NextResponse.json({ erro: e.message }, { status: 409 })
    throw e
  }
}
