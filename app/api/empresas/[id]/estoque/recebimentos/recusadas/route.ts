// A vista "Recusadas" — nota recusada nunca some do sistema.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listarRecusadas } from '@/lib/stock/recusa-nota'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ recusadas: await listarRecusadas(companyId, prisma) })
}
