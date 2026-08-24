// ESTOQUE FASE 1 item 2 — GET preview da conferência (MODO TESTE, não grava nada).
// Devolve a nota ilustrativa (golden) + os itens de estoque já existentes (pra o
// dono testar a busca ao mapear). Nenhuma escrita.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { buildPreviewConference } from '@/lib/stock/conference-preview'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const itensExistentes = await prisma.stockItem.findMany({
    where: { companyId, ativo: true },
    select: { id: true, nome: true, unidadeControle: true, categoria: true },
    orderBy: { nome: 'asc' },
    take: 200,
  })
  return NextResponse.json({ preview: buildPreviewConference(), itensExistentes })
}
