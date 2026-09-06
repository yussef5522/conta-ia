// ESTOQUE PARTE C — GET relatório de perdas do período (por motivo e por item).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { relatorioPerdas } from '@/lib/stock/saida'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const sp = request.nextUrl.searchParams
  // ⚠️ o dia (e portanto o MÊS corrente) é o de São Paulo: das 21h à meia-noite o UTC já
  // virou, e no dia 30 às 22h o padrão saltaria pro mês seguinte — relatório de perdas vazio.
  const hoje = diaEmSaoPaulo()
  const ate = sp.get('ate') || hoje
  const de = sp.get('de') || `${hoje.slice(0, 8)}01`
  return NextResponse.json({ relatorio: await relatorioPerdas(companyId, de, ate, prisma) })
}
