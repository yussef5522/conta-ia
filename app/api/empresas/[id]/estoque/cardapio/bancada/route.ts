// ⭐ A BANCADA DE VÍNCULOS (lei docs/bancada-referencia.html, R32–R35) — SÓ LÊ. As ligações usam as rotas
// que já existiam (cardapio/[chave]/mapear · vendas/mapear · vendas/complementos/mapear): mesmas gravações.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { bancadaDeVinculos } from '@/lib/stock/cardapio/bancada'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json(await bancadaDeVinculos(companyId, prisma))
}
