// ⭐ ARQUIVAR / EXCLUIR ITEM (29/08/2026) — a peça da câmara fria.
//
// GET    → a situação (dá pra excluir? onde o item está sendo usado? tem saldo?)
// POST   → arquiva ou desarquiva (avisos exigem `confirmado: true`)
// DELETE → exclui DE VERDADE, e só quando o item nunca teve movimento nenhum

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { situacaoDoItem, arquivarItem, excluirItem, ArquivarError } from '@/lib/stock/itens/arquivar'

interface Params { params: Promise<{ id: string; itemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  try {
    return NextResponse.json({ situacao: await situacaoDoItem(companyId, itemId, prisma) })
  } catch (e) {
    if (e instanceof ArquivarError) return NextResponse.json({ erro: e.message }, { status: 404 })
    throw e
  }
}

const schema = z.object({ arquivar: z.boolean(), confirmado: z.boolean().optional() })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe se é pra arquivar ou desarquivar.' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await arquivarItem({ companyId, itemId, ...parsed.data }, prisma)) })
  } catch (e) {
    // ⚠️ 409 = "precisa confirmar", não "deu erro": a tela mostra o aviso e pergunta.
    if (e instanceof ArquivarError) return NextResponse.json({ erro: e.message, code: 'CONFIRMAR' }, { status: 409 })
    throw e
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  try {
    return NextResponse.json({ ok: true, ...(await excluirItem({ companyId, itemId }, prisma)) })
  } catch (e) {
    if (e instanceof ArquivarError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
