// ESTOQUE — HUB DO CARDÁPIO (27/08). Era "cardápio/margem" (só PRODUTO_FINAL cadastrado);
// virou o HUB DO DONO: a lista do que SE VENDE (mapeamento do PDV + fichas finais +
// revenda), com status da ficha, custo, preço e margem. GET + CSV.
//
// ⚠️ A leitura antiga (`cardapio()` de sugestao-cardapio.ts) foi REMOVIDA junto: ela ficaria
// sem caller e seria um SEGUNDO custo/margem pro mesmo produto, calculado por outra regra.
// `sugestoesDeProducao` (min/máx) fica — responde outra pergunta ("o que preciso produzir?").

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { hubCardapio, hubToCsv } from '@/lib/stock/cardapio/hub'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  const diasParam = request.nextUrl.searchParams.get('dias')
  const dias = diasParam && /^\d+$/.test(diasParam) ? Number(diasParam) : null
  const hub = await hubCardapio(companyId, { dias }, prisma)

  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    return new NextResponse('﻿' + hubToCsv(hub.linhas), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="cardapio.csv"' },
    })
  }
  return NextResponse.json(hub)
}
