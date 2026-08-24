// ESTOQUE FASE 1 item 2 — GET extrato do estoque (+ CSV via ?formato=csv). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listMovimentos, movimentosToCsv } from '@/lib/stock/movimentos'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const sp = request.nextUrl.searchParams
  const filtro = { itemId: sp.get('itemId') ?? undefined, tipo: sp.get('tipo') ?? undefined, de: sp.get('de') ?? undefined, ate: sp.get('ate') ?? undefined, limite: sp.get('formato') === 'csv' ? 5000 : 500 }
  const movimentos = await listMovimentos(companyId, filtro)

  if (sp.get('formato') === 'csv') {
    return new NextResponse('﻿' + movimentosToCsv(movimentos), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="movimentos-estoque.csv"` },
    })
  }
  // itens pro filtro (dropdown)
  const itens = await prisma.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } })
  return NextResponse.json({ movimentos, itens })
}
