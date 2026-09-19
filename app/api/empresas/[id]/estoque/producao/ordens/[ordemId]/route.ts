// ESTOQUE FASE 2 item 2.1 — detalhe da ordem + separação pré-preenchida (explode a ficha).

import { NextRequest, NextResponse } from 'next/server'
import { saidasDaOrdemParada } from '@/lib/stock/producao/saidas-da-ordem-parada'
import { dataEhPlausivel } from '@/lib/stock/producao/data-da-ordem'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { explodirSeparacao, OrdemError } from '@/lib/stock/producao/ordens'
import { listConclusoes, rendimentoMedidoDaFicha } from '@/lib/stock/producao/conclusao'

interface Params { params: Promise<{ id: string; ordemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  try {
    const { ordem, linhas } = await explodirSeparacao(companyId, ordemId)
    const [conclusoes, colaboradores, medido] = await Promise.all([
      listConclusoes(companyId, ordemId),
      prisma.stockColaborador.findMany({ where: { companyId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
      rendimentoMedidoDaFicha(companyId, ordem.fichaId),
    ])
    /**
     * ⭐⭐ AS TRÊS SAÍDAS quando a ordem está PARADA (19/09) — o aviso do painel deixa de
     * ser um texto sem ação. O estado vem do BANCO (etapa correndo, plano de continuar,
     * valor preso), nunca da tela: se a tela deduzisse, ela discordaria do P2 no primeiro
     * caso de borda — e o dono veria o aviso num lugar e a porta fechada no outro.
     */
    const [etapas, plano, movs, bruta] = await Promise.all([
      prisma.stockOrdemEtapa.findMany({ where: { companyId, ordemId }, select: { id: true, iniciadoEm: true, finalizadoEm: true } }),
      // ⚠️ o plano é por ETAPA, não por ordem (15/09) — resolve pelas etapas desta ordem
      prisma.stockOrdemEtapa.findMany({ where: { companyId, ordemId }, select: { id: true } })
        .then((es) => prisma.stockEtapaPlano.findFirst({
          where: { companyId, etapaId: { in: es.map((e) => e.id) }, diaPrevisto: { not: null } },
          orderBy: { diaPrevisto: 'desc' }, select: { diaPrevisto: true },
        })),
      prisma.stockMovement.findMany({ where: { companyId, receiptId: ordemId }, select: { tipo: true, custoTotal: true } }),
      prisma.stockProductionOrder.findFirstOrThrow({ where: { id: ordemId, companyId }, select: { atualizadoEm: true, dataProducao: true } }),
    ])
    const somaDe = (t: string) => movs.filter((m) => m.tipo === t).reduce((s, m) => s + Math.abs(m.custoTotal), 0)
    const parada = saidasDaOrdemParada({
      estado: ordem.estado,
      valorPreso: somaDe('SEPARACAO_SAIDA') - somaDe('DEVOLUCAO_PRODUCAO') - somaDe('PRODUCAO_CONSUMO'),
      horasParada: (Date.now() - bruta.atualizadoEm.getTime()) / 3_600_000,
      temEtapaEmAndamento: etapas.some((e) => e.iniciadoEm && !e.finalizadoEm),
      // ⚠️ só plano de HOJE pra frente cala o aviso: plano vencido é lote esquecido (15/09)
      temPlanoDeContinuar: !!plano?.diaPrevisto && plano.diaPrevisto.getTime() >= Date.now() - 86_400_000,
      dataPlausivel: dataEhPlausivel(bruta.dataProducao),
    })

    // `lotes` vai junto: a tela precisa dizer "média de 4 lotes" e só adota a medida com 2+
    return NextResponse.json({ ordem, linhas, conclusoes, colaboradores, rendimentoMedio: medido.media, rendimentoLotes: medido.lotes, parada })
  } catch (e) {
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 404 })
    throw e
  }
}
