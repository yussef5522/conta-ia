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
import { hubCardapio, hubToCsv, ehProntoNoCardapio } from '@/lib/stock/cardapio/hub'
import { agruparPorSecao } from '@/lib/stock/cardapio/secoes'
import { secoesDaEmpresa, secoesPorNome, secaoDaLinha } from '@/lib/stock/cardapio/secoes-db'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  const diasParam = request.nextUrl.searchParams.get('dias')
  const dias = diasParam && /^\d+$/.test(diasParam) ? Number(diasParam) : null
  const hub = await hubCardapio(companyId, { dias }, prisma)

  // ⭐⭐ A SEÇÃO DE CADA LINHA (08/09) — resolvida aqui, no servidor, junto do hub: a tela
  // ecoa. Calcular no cliente abriria a porta pra o header somar diferente da lista.
  const [secoes, gravadas] = await Promise.all([secoesDaEmpresa(companyId), secoesPorNome(companyId)])
  const linhas = hub.linhas.map((l) => {
    const s = secaoDaLinha(l.nomesSuitable, gravadas, l.nome)
    return { ...l, secao: s.secao, secaoSugerida: s.sugerida, secaoPorQue: s.porQue }
  })
  // ⛔ os totais POR SEÇÃO saem da MESMA lista que a tela desenha — é o que garante que o
  // header some certo (comFicha + semFicha === total).
  const grupos = agruparPorSecao(linhas.map((l) => ({
    chave: l.chave, nome: l.nome, nomesSuitable: l.nomesSuitable, secao: l.secao,
    sugerida: l.secaoSugerida, temFicha: ehProntoNoCardapio(l), vendasQtd: l.vendasQtd,
  })), secoes)
  const comSecao = { ...hub, linhas, secoes, grupos: grupos.map(({ linhas: _l, ...g }) => g) }

  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    return new NextResponse('﻿' + hubToCsv(hub.linhas), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="cardapio.csv"' },
    })
  }
  return NextResponse.json(comSecao)
}
