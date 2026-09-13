// ⭐ A FILA DAS NOTAS SEM VENCIMENTO — o F5 virando TELA (13/09/2026).
//
// ⚠️ **E-mail noturno não é lugar de dívida vencendo — o dono lê TELA** (a lição dos
// R$ 21.968,02 que ficaram parados em 30/08 com o F3 gritando no vazio). A fila nasce da
// MESMA pergunta do invariante, pra o e-mail e a tela nunca contarem números diferentes.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { notasSemVencimento, fraseDaFila } from '@/lib/stock/ponte/definir-parcelas'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const notas = await notasSemVencimento(companyId, prisma)
  return NextResponse.json({ notas, frase: notas.length ? fraseDaFila(notas) : null })
}
