// ESTOQUE FASE 2 item 2.2 — POST concluir a ordem ("quantos saíram?"). Consumo real +
// qtd gerada + colaborador (+ parcial). Gera CONSUMO/GERACAO no ledger e o rendimento.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { concluir } from '@/lib/stock/producao/conclusao'
import { OrdemError } from '@/lib/stock/producao/ordens'

interface Params { params: Promise<{ id: string; ordemId: string }> }

const schema = z.object({
  consumo: z.array(z.object({ itemId: z.string(), qtdConsumida: z.number().nonnegative() })).min(1),
  qtdGerada: z.number().positive(),
  colaboradorId: z.string().nullable().optional(),
  // ⚠️ OPCIONAL de propósito: cobrar motivo em produção normal treina a pessoa a escrever
  // qualquer coisa, e aí o campo deixa de valer quando o desvio for de verdade.
  motivoDesvio: z.string().max(500).nullable().optional(),
  parcial: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da conclusão inválidos.' }, { status: 400 })
  try {
    const r = await concluir({ companyId, ordemId, userId: user.sub, ...parsed.data })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
