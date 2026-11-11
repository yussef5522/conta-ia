// V11 · o PORTÃO da contagem: dia com venda ainda aberto → "feche o dia antes de contar".
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { portaoDaContagem } from '@/lib/suit/ao-vivo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json(await portaoDaContagem(prisma, companyId, new Date()), { headers: { 'Cache-Control': 'no-store' } })
}
