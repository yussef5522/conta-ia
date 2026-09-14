// ESTOQUE FASE 3 — POST preview do import de vendas do Suitable (parse + resolve o mapa).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { previewImportSuitable } from '@/lib/stock/vendas/venda-map'
import { SuitableParseError } from '@/lib/stock/vendas/parse-suitable'
import { montarRevisaoDeLinhas } from '@/lib/stock/vendas/revisao-do-import'

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = z.object({
    html: z.string().min(1).max(5_000_000),
    // ⭐ o dia só serve pra rotular a revisão — o preview NÃO grava nada (14/09)
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Envie o conteúdo do arquivo.' }, { status: 400 })
  try {
    const preview = await previewImportSuitable(companyId, parsed.data.html, prisma)
    // ⭐⭐ A MESMA LISTA DA REVISÃO, antes do import — foi o que matou a tabela velha
    // "Mapeamento (N)". Duas vitrines do mesmo dado é a segunda derivação em forma de página.
    const revisao = await montarRevisaoDeLinhas(
      companyId, parsed.data.data ?? '', 'PRODUTOS',
      preview.linhas.map((l) => ({ nome: l.produto, ocorrencias: l.quantidade })), prisma,
    )
    return NextResponse.json({ preview, revisao })
  } catch (e) {
    if (e instanceof SuitableParseError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
