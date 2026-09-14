// ⭐⭐ A REVISÃO DO IMPORT — o extrato do que chegou (14/09/2026).
//
// GET  ?data=&relatorio= → a lista POR NOME com estado, destino e o que desconta
// POST ?preview          → o que muda se reprocessar (só os nomes que mudaram de estado)
//
// ⛔ `stock.manage`: mudar vínculo é **escrita em estoque** (o nome passa a descontar
// item), e isso é decisão do dono — a mesma fronteira do mapa de vendas desde 22/08.
// ⚠️ LER é `stock.view` (a régua "ler é ler" do guard estrutural de rotas).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { montarRevisao, previewDoAjuste } from '@/lib/stock/vendas/revisao-do-import'
import { reprocessarDia } from '@/lib/stock/vendas/baixa-venda'
import { processarComplementos } from '@/lib/stock/vendas/baixa-complemento'

interface Params { params: Promise<{ id: string }> }

const q = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  relatorio: z.enum(['PRODUTOS', 'COMPLEMENTOS']).default('PRODUTOS'),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const p = q.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!p.success) return NextResponse.json({ erro: 'Informe a data do import.' }, { status: 400 })
  return NextResponse.json({ revisao: await montarRevisao(companyId, p.data.data, p.data.relatorio, prisma) })
}

const body = q.extend({ confirmar: z.boolean().default(false), confirmouSanidade: z.boolean().default(false) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const p = body.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'Informe a data do import.' }, { status: 400 })
  const { data, relatorio, confirmar, confirmouSanidade } = p.data

  const preview = await previewDoAjuste(companyId, data, relatorio, prisma)
  // ⛔⛔ NADA BAIXA SEM O PREVIEW: mudança de vínculo é escrita em estoque, e a régua da
  // casa é preview → confirmo → rastro. A rota devolve o preview e PARA.
  if (!confirmar) return NextResponse.json({ ok: true, preview })

  try {
    const recibo = relatorio === 'COMPLEMENTOS'
      ? await processarComplementos(companyId, data, auth.userId, prisma)
      : await reprocessarDia(companyId, data, auth.userId, prisma, confirmouSanidade)
    return NextResponse.json({ ok: true, preview, recibo })
  } catch (e) {
    // ⚠️ a recusa da sanidade tem mensagem própria e ENSINA a saída — nunca um 500 mudo
    return NextResponse.json({ erro: (e as Error).message }, { status: 422 })
  }
}
