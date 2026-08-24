// ESTOQUE PARTE C — GET relatório de perdas do período (por motivo e por item).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { relatorioPerdas } from '@/lib/stock/saida'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const sp = request.nextUrl.searchParams
  const hoje = new Date()
  const ate = sp.get('ate') || hoje.toISOString().slice(0, 10)
  const de = sp.get('de') || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  return NextResponse.json({ relatorio: await relatorioPerdas(companyId, de, ate, prisma) })
}
