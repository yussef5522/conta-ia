// ESTOQUE — mapear um produto do PDV pra REVENDA sem sair do hub (27/08).
//
// ⚠️ O PROBLEMA QUE ISTO RESOLVE: o link "é bebida? mapear lá" jogava na tela genérica do
// Suitable, onde o dono tinha que ACHAR o produto de novo numa lista de 80. O hub já sabe
// qual é o produto — perder essa informação no caminho é obrigar o usuário a repetir o que
// o sistema acabou de mostrar.
//
// REGRA 4: NÃO reimplementa o mapeamento — delega pro MESMO `upsertVendaMap`, que carrega o
// guard dos 3 níveis (venda só casa com ficha PRODUTO_FINAL ou item REVENDA; matéria-prima
// nunca). Se o guard mudar, este caminho muda junto de graça.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { upsertVendaMap, VendaMapError } from '@/lib/stock/vendas/venda-map'
import { parseChave } from '@/lib/stock/cardapio/detalhe'

interface Params { params: Promise<{ id: string; chave: string }> }

// ⭐ DOIS destinos possíveis, e a tela precisa dos dois: item de REVENDA (bebida) ou uma
// FICHA QUE JÁ EXISTE. ⚠️ O segundo nasceu de um aperto real (03/09): a faixa dizia "não
// vincule criando outra" e **não havia como apontar a que existe** — o dono ficava preso
// com a ficha órfã, e a única saída era criar a duplicada que a própria faixa proibia.
const schema = z.union([
  z.object({ itemId: z.string().min(1) }),
  z.object({ fichaId: z.string().min(1) }),
])

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, chave } = await params
  // decidir o que um produto vendido É = decisão de dono (define o que baixa do estoque).
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const body = schema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ erro: 'Escolha o item de revenda ou a ficha.' }, { status: 400 })

  const alvo = parseChave(decodeURIComponent(chave))
  // só produto AINDA sem destino entra por aqui: a chave carrega o nome exato do PDV.
  if (!alvo || alvo.tipo !== 'nome') {
    return NextResponse.json({ erro: 'Este produto já tem destino. Troque pelo mapeamento de vendas.' }, { status: 422 })
  }

  try {
    // REGRA 4: os dois destinos passam pelo MESMO `upsertVendaMap`, que carrega o guard
    // dos 3 níveis (nada de matéria-prima, nada de intermediário).
    await upsertVendaMap(companyId, alvo.valor,
      'fichaId' in body.data ? { tipo: 'FICHA', fichaId: body.data.fichaId } : { tipo: 'REVENDA', itemId: body.data.itemId },
      a.user.sub, prisma)
  } catch (e) {
    if (e instanceof VendaMapError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
  return NextResponse.json({ ok: true, chave: 'fichaId' in body.data ? `ficha:${body.data.fichaId}` : `item:${body.data.itemId}` })
}
