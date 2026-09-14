// ⭐ GET os destinos que o seletor oferece — a MESMA lista pra tela de produtos e pra
// revisão do import (fonte única do seletor, 14/09/2026).
//
// ⚠️ `stock.view`: ler o que existe é ler. Quem ESCOLHE grava pelas rotas de mapa, que
// exigem `stock.manage` — a fronteira de sempre.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { destinosPossiveis } from '@/lib/stock/vendas/destinos-de-venda'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const rel = new URL(request.url).searchParams.get('relatorio')
  const relatorio = rel === 'COMPLEMENTOS' ? 'COMPLEMENTOS' : 'PRODUTOS'
  return NextResponse.json({ destinos: await destinosPossiveis(companyId, relatorio, prisma) })
}
