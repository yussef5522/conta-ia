// ESTOQUE PARTE B — GET catálogo (todos os itens, inclusive saldo zero). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listCatalogo } from '@/lib/stock/catalogo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  return NextResponse.json({ itens: await listCatalogo(companyId, prisma) })
}
