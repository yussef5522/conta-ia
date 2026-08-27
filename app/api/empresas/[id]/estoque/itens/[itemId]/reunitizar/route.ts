// ESTOQUE — trocar a unidade de controle de um item (unidade de COMPRA → de CONSUMO).
// GET = prévia (não grava) · POST = aplica. Ver o porquê em lib/stock/reunitizar-item.ts.
//
// `stock.manage`: mexe na régua do item, no fator aprendido das notas e no ledger — é
// decisão de dono, não operação do dia.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { previewReunitizar, reunitizarItem, ReunitizarError } from '@/lib/stock/reunitizar-item'
import { MovementInvalidError } from '@/lib/stock/movement'

interface Params { params: Promise<{ id: string; itemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  // ⚠️ `view`, não `manage` — o guard estrutural pegou isto e está CERTO: a prévia não
  // grava nada, só faz a aritmética sobre números que a ficha do item já mostra. Quem só
  // lê pode ver a conta; mudar a régua é o POST, e esse é `manage`.
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const fator = Number(request.nextUrl.searchParams.get('fator') ?? '')
  try {
    return NextResponse.json(await previewReunitizar(companyId, itemId, fator, prisma))
  } catch (e) {
    if (e instanceof ReunitizarError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

const schema = z.object({
  fator: z.number().positive(),
  novoNome: z.string().min(1).max(160).optional(),
  unidadeControle: z.enum(['KG', 'UN', 'LT']).optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const body = schema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ erro: 'Informe o fator (quantas unidades novas cabem em 1 atual).' }, { status: 400 })
  try {
    const r = await reunitizarItem({ companyId, itemId, ...body.data, userId: a.user.sub }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ReunitizarError || e instanceof MovementInvalidError) {
      return NextResponse.json({ erro: e.message }, { status: 422 })
    }
    throw e
  }
}
