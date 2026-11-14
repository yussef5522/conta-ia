// ⭐ DESEMPENHO (lei R9–R16, 13/11/2026) — ?periodo=hoje|7d|30d|dia&dia=AAAA-MM-DD
// ⛔ stock.manage: comparativo entre pessoas — "SÓ na tela do dono/gerente, o TABLET NUNCA mostra o placar".
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { desempenhoDaProducao, lerPeriodo } from '@/lib/stock/producao/desempenho-da-producao'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const q = request.nextUrl.searchParams
  return NextResponse.json(await desempenhoDaProducao(companyId, lerPeriodo({ periodo: q.get('periodo'), dia: q.get('dia') }), new Date(), prisma))
}
