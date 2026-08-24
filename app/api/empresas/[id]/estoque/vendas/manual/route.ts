// ESTOQUE PARTE B — POST lançamento manual de vendas. confirmar=false → preview; true → baixa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { previewLancamentoManual, confirmarLancamentoManual } from '@/lib/stock/vendas/lancamento-manual'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data.'),
  entradas: z.array(z.object({ alvoTipo: z.enum(['FICHA', 'REVENDA']), alvoId: z.string().min(1), quantidade: z.number().positive() })).min(1),
  confirmar: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Informe data e ao menos um produto.' }, { status: 400 })
  const { data, entradas, confirmar } = parsed.data
  try {
    if (confirmar) return NextResponse.json({ ok: true, recibo: await confirmarLancamentoManual(companyId, data, entradas, user.sub, prisma) })
    return NextResponse.json({ plano: await previewLancamentoManual(companyId, data, entradas, user.sub, prisma) })
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 })
  }
}
