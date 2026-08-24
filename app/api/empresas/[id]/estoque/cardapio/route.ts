// ESTOQUE FASE 2 item 2.4 — cardápio/margem (PRODUTO_FINAL). GET + CSV.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { cardapio, cardapioToCsv } from '@/lib/stock/producao/sugestao-cardapio'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const itens = await cardapio(companyId, prisma)
  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    return new NextResponse('﻿' + cardapioToCsv(itens), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="cardapio.csv"` } })
  }
  return NextResponse.json({ itens })
}
