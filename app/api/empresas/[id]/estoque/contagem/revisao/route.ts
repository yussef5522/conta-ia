// ⭐ A REVISÃO — decisão do DONO, separada da contagem (gente diferente, momento diferente).
//
// ⚠️⚠️ "CONFERIDO" NÃO APLICA NADA, e o nome diz isso: o ajuste no ledger já aconteceu na
// hora da contagem (decisão de 23/08 — sessão de vários dias não pode segurar os ajustes
// reféns). Chamar de "aceitar" faria o botão MENTIR sobre o que o clique faz.
//
// ⚠️ PERMISSÃO: decidir é `stock.manage` (é do dono). A operadora VÊ a revisão — precisa
// enxergar o resultado do trabalho dela — mas não decide. Escrever OBSERVAÇÃO é outro
// caminho (`/linha` e `/marcar`, `stock.operate`): observação não é decisão, é o que ela VIU.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { historicoDaContagem } from '@/lib/stock/contagem'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const contagemId = request.nextUrl.searchParams.get('contagemId') ?? ''
  if (!contagemId) return NextResponse.json({ erro: 'Informe a contagem.' }, { status: 400 })

  const [historico, decisoes] = await Promise.all([
    historicoDaContagem(companyId, contagemId, prisma),
    prisma.stockContagemRevisao.findMany({ where: { companyId, contagemId }, orderBy: { decididoEm: 'desc' } }),
  ])
  // a decisão VIGENTE é a última de cada item (a tabela é append-only)
  const vigente = new Map<string, { decisao: string; motivo: string | null; decididoPorNome: string | null; decididoEm: string }>()
  for (const d of decisoes) {
    if (!vigente.has(d.itemId)) {
      vigente.set(d.itemId, { decisao: d.decisao, motivo: d.motivo, decididoPorNome: d.decididoPorNome, decididoEm: d.decididoEm.toISOString() })
    }
  }
  return NextResponse.json({
    historico: Object.fromEntries(historico),
    decisoes: Object.fromEntries(vigente),
  })
}

const schema = z.object({
  contagemId: z.string().min(1),
  itemId: z.string().min(1),
  decisao: z.enum(['CONFERIDO', 'RECONTAR', 'INVESTIGAR']),
  motivo: z.string().max(300).nullish(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe a contagem, o item e a decisão.' }, { status: 400 })

  const sessao = await prisma.stockContagem.findFirst({ where: { id: parsed.data.contagemId, companyId }, select: { id: true } })
  if (!sessao) return NextResponse.json({ erro: 'Contagem não encontrada.' }, { status: 404 })

  // ⚠️ APPEND-ONLY: mudar de ideia empilha outra decisão, não apaga a anterior.
  const r = await prisma.stockContagemRevisao.create({
    data: {
      companyId, contagemId: parsed.data.contagemId, itemId: parsed.data.itemId,
      decisao: parsed.data.decisao, motivo: parsed.data.motivo?.trim() || null,
      decididoPorId: auth.userId ?? null, decididoPorNome: auth.userName ?? null,
    },
  })
  return NextResponse.json({ ok: true, id: r.id, decisao: r.decisao })
}
