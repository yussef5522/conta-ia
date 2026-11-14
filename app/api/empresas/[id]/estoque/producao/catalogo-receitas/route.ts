// ⭐ RECEITAS (lei R17–R19 + R24, 13/11/2026) — o catálogo com contadores vivos, numa leitura só
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { catalogoDeReceitas } from '@/lib/stock/producao/catalogo-de-receitas'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json(await catalogoDeReceitas(companyId, prisma))
}
