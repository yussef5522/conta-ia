// ESTOQUE FASE 3 PARTE 2 — GET histórico de sessões de contagem (retomar/consultar).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { listarContagens } from '@/lib/stock/contagem'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  return NextResponse.json({ contagens: await listarContagens(companyId, prisma) })
}
