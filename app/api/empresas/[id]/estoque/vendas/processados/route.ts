// ESTOQUE FASE 3 passo 2 — GET histórico "Processados" (um dia por linha).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listProcessados } from '@/lib/stock/vendas/baixa-venda'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  return NextResponse.json({ processados: await listProcessados(companyId, prisma) })
}
