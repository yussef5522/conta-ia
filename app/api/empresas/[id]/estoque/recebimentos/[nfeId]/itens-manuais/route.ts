// ESTOQUE — POST itens digitados do DANFE de papel (nota só-resumo).
// Rota nasce com requireStock (stock.operate — está criando dado de recebimento).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { salvarItensManuais, ItensManuaisError } from '@/lib/stock/itens-manuais'

interface Params { params: Promise<{ id: string; nfeId: string }> }

const schema = z.object({
  itens: z.array(z.object({
    xProd: z.string().min(1).max(200),
    qCom: z.number().positive(),
    uCom: z.string().min(1).max(10),
    vUnCom: z.number().min(0),
    // ⭐ o VÍNCULO escolhido enquanto digitava (null = texto livre, como era antes)
    itemId: z.string().min(1).nullish(),
    // ⛔ nunca 1 por omissão: `null` significa "ainda não sei", e a lib recusa a linha
    fatorConversao: z.number().positive().nullish(),
  })).min(1).max(200),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe os itens (descrição, quantidade, unidade e preço unitário).' }, { status: 400 })
  try {
    const r = await salvarItensManuais({ companyId, nfeId, itens: parsed.data.itens, userId: auth.userId }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ItensManuaisError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
