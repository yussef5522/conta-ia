// ESTOQUE — detalhe de um produto do cardápio. GET (leitura) + PATCH (preço de venda).
//
// O PATCH do preço vive aqui pra a tela do produto não precisar conhecer a rota de fichas —
// mas por baixo delega pro MESMO `atualizarFicha` (REGRA 4), então versionamento e validação
// continuam num lugar só.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { detalheProduto } from '@/lib/stock/cardapio/detalhe'
import { atualizarFicha, FichaError } from '@/lib/stock/producao/fichas'

interface Params { params: Promise<{ id: string; chave: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, chave } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  const det = await detalheProduto(companyId, decodeURIComponent(chave), prisma)
  if (!det) return NextResponse.json({ erro: 'Produto não encontrado no cardápio.' }, { status: 404 })
  return NextResponse.json(det)
}

const patchSchema = z.object({ valorVenda: z.number().positive().nullable() })

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, chave } = await params
  // preço é decisão de dono (define margem) → manage, igual ao resto do cardápio.
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const body = patchSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ erro: 'Preço inválido.' }, { status: 400 })

  const det = await detalheProduto(companyId, decodeURIComponent(chave), prisma)
  if (!det) return NextResponse.json({ erro: 'Produto não encontrado.' }, { status: 404 })
  if (!det.linha.fichaId) return NextResponse.json({ erro: 'Só produto com ficha guarda preço de cardápio. Revenda usa o preço do PDV.' }, { status: 422 })

  try {
    await atualizarFicha(companyId, det.linha.fichaId, { valorVenda: body.data.valorVenda, userId: a.user.sub }, prisma)
  } catch (e) {
    if (e instanceof FichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
  return NextResponse.json({ ok: true })
}
