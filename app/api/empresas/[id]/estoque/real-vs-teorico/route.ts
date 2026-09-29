/**
 * ⭐⭐⭐ REAL × TEÓRICO v2 — A MESA DE PERÍCIA (29/09/2026)
 *
 * **A lei do dono:** *"a tela passa a ler EXCLUSIVAMENTE o motor do Radar
 * (`calcularFechamentoDoDia`) — o cálculo próprio que ela tem hoje MORRE. Duas telas, uma
 * verdade."*
 *
 * ⛔⛔ **`calcularRealVsTeorico` NÃO É MAIS CHAMADO AQUI**, e o guard de página proíbe que
 * volte. Ele e o motor do Radar **discordavam de verdade**: aquele somava TODOS os
 * `AJUSTE_CONTAGEM` do período, o Radar usa a ÚLTIMA contagem de cada item — item contado
 * duas vezes no período dava dois números, e nenhuma tela dizia qual era o certo.
 *
 * ⚠️ O `PISO_DADOS` e os `TIPOS` continuam vindo de `real-vs-teorico.ts`: **eles são o
 * vocabulário do módulo** (o próprio Radar os importa), não a segunda conta.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { calcularFechamentoDoDia } from '@/lib/stock/radar/fechamento'
import { listasDoRadar } from '@/lib/stock/radar/watchlist'
import { janelaDoPeriodo, type ChavePeriodo } from '@/lib/stock/radar/periodo'
import { montarMesa, somaDaMesa, colunasValidas, COLUNAS, COLUNAS_PADRAO } from '@/lib/stock/radar/mesa'
import { formatarQtd } from '@/lib/stock/quantidade'

interface Params { params: Promise<{ id: string }> }

const CHAVES: ChavePeriodo[] = ['ONTEM_HOJE', 'SETE_DIAS', 'MES', 'LIVRE']

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  const sp = request.nextUrl.searchParams
  const chave = (CHAVES.includes(sp.get('periodo') as ChavePeriodo) ? sp.get('periodo') : 'SETE_DIAS') as ChavePeriodo
  // ⚠️ a janela e o RÓTULO saem do mesmo lugar (a lição dos 5 textos "12/08" literais em tela)
  const janela = janelaDoPeriodo(chave, { de: sp.get('de'), ate: sp.get('ate') })
  const itensFiltro = (sp.get('itens') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  // ⭐ as MESMAS watchlists do Radar — uma configuração só, editada em qualquer das telas
  const listas = await listasDoRadar(companyId, prisma)
  const radar = await calcularFechamentoDoDia(
    { companyId, de: janela.de, ate: janela.ate, caros: listas.caros, revenda: listas.revenda, porcoes: listas.porcoes },
    prisma,
  )
  const secoes = montarMesa(radar, itensFiltro)

  // ⭐ a escolha de colunas desta pessoa nesta empresa (sem linha = o padrão)
  const pref = await prisma.stockMesaPreferencia.findUnique({
    where: { companyId_userId: { companyId, userId: auth.userId } },
    select: { colunas: true },
  })
  const colunas = colunasValidas(pref?.colunas.split(','))

  if (sp.get('formato') === 'csv') {
    const cab = ['Seção', 'Item', 'Un', 'Desde', 'Até', 'Início', 'Entrou', 'Produzido', 'Vendeu', 'Perdeu', 'Separado', 'Teórico', 'Real', 'Variância', 'R$', '%']
    const linhas = secoes.flatMap((s) => s.linhas.map((l) => [
      s.titulo, l.nome, l.unidade, l.desde ?? '', l.ate ?? '',
      l.inicio ?? '', l.entrou, l.produziu, l.vendeu, l.perdeu, l.separado,
      l.teorico ?? '', l.real ?? 'falta contar', l.variancia ?? '', l.varianciaValor ?? '',
      l.pct == null ? '' : (l.pct * 100).toFixed(1),
    ]))
    const csv = [cab, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    return new NextResponse(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="real-x-teorico-${janela.de}-a-${janela.ate}.csv"`,
      },
    })
  }

  return NextResponse.json({
    janela,
    secoes,
    colunas,
    colunasDisponiveis: COLUNAS,
    /**
     * ⭐⭐ O PLACAR DO RADAR VIAJA JUNTO — é o que torna o guard de página POSSÍVEL na
     * própria tela: sem filtro, `soma.valor` tem que bater com `placar.valor`. Mandar só um
     * dos dois deixaria a divergência invisível até alguém abrir as duas telas lado a lado.
     */
    placarDoRadar: { valor: radar.placar.valor, itensContados: radar.placar.itensContados },
    soma: somaDaMesa(secoes),
    filtrado: itensFiltro.length > 0,
    avisos: radar.avisos,
  })
}

/** ⭐ salvar a escolha de colunas — é preferência de tela, então `stock.view` basta */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  const body = await request.json().catch(() => ({}))
  const escolhidas = Array.isArray(body?.colunas) ? body.colunas.map(String) : null
  // ⛔ a validação é a MESMA da leitura — lista vazia ou chave inventada cai no padrão,
  //    nunca grava tela sem coluna nenhuma (o dono não conseguiria nem ligar de volta)
  const colunas = colunasValidas(escolhidas)
  const texto = colunas.join(',')

  await prisma.stockMesaPreferencia.upsert({
    where: { companyId_userId: { companyId, userId: auth.userId } },
    create: { companyId, userId: auth.userId, colunas: texto },
    update: { colunas: texto },
  })
  return NextResponse.json({ colunas, padrao: COLUNAS_PADRAO, exemplo: formatarQtd(0.0003, 'KG') })
}
