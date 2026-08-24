// ESTOQUE PARTE B — GET vendáveis (PRODUTO_FINAL + REVENDA) pro lançamento manual.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listVendaveis } from '@/lib/stock/vendas/lancamento-manual'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  return NextResponse.json({ vendaveis: await listVendaveis(companyId, prisma) })
}
