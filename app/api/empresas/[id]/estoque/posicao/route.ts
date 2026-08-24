// ESTOQUE FASE 1 item 2 — GET posição de estoque (saldo derivado). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listPosicao, posicaoToCsv } from '@/lib/stock/posicao'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const posicao = await listPosicao(companyId)
  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    return new NextResponse('﻿' + posicaoToCsv(posicao), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="posicao-estoque.csv"` },
    })
  }
  return NextResponse.json({ posicao })
}
