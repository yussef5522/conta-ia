// ESTOQUE FASE 2 item 2.4 — cardápio/margem (PRODUTO_FINAL). GET + CSV.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { cardapio, cardapioToCsv } from '@/lib/stock/producao/sugestao-cardapio'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const itens = await cardapio(companyId, prisma)
  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    return new NextResponse('﻿' + cardapioToCsv(itens), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="cardapio.csv"` } })
  }
  return NextResponse.json({ itens })
}
