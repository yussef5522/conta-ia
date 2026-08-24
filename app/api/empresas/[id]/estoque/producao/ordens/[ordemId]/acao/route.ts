// ESTOQUE FASE 2 item 2.1 — ações da ordem: separar / iniciar / devolver / cancelar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { confirmarSeparacao, iniciarProducao, devolverInsumo, cancelarOrdem, OrdemError } from '@/lib/stock/producao/ordens'

interface Params { params: Promise<{ id: string; ordemId: string }> }

const schema = z.object({
  acao: z.enum(['separar', 'iniciar', 'devolver', 'cancelar']),
  itens: z.array(z.object({ itemId: z.string(), qtdSeparada: z.number().nonnegative() })).optional(),
  itemId: z.string().optional(),
  qtd: z.number().positive().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 })

  try {
    switch (parsed.data.acao) {
      case 'separar':
        if (!parsed.data.itens?.length) return NextResponse.json({ erro: 'Informe os itens separados.' }, { status: 400 })
        return NextResponse.json({ ok: true, ...(await confirmarSeparacao(companyId, ordemId, parsed.data.itens, prisma, user.sub)) })
      case 'iniciar':
        await iniciarProducao(companyId, ordemId); return NextResponse.json({ ok: true })
      case 'devolver':
        if (!parsed.data.itemId || !parsed.data.qtd) return NextResponse.json({ erro: 'Informe item e quantidade.' }, { status: 400 })
        await devolverInsumo(companyId, ordemId, parsed.data.itemId, parsed.data.qtd, prisma, user.sub); return NextResponse.json({ ok: true })
      case 'cancelar':
        await cancelarOrdem(companyId, ordemId, prisma, user.sub); return NextResponse.json({ ok: true })
    }
  } catch (e) {
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
