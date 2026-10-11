// ESTOQUE FASE 2 item 2.1 — detalhe da ordem + separação pré-preenchida (explode a ficha).

import { NextRequest, NextResponse } from 'next/server'
import { saidasDaOrdemParada } from '@/lib/stock/producao/saidas-da-ordem-parada'
import { dataEhPlausivel } from '@/lib/stock/producao/data-da-ordem'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { explodirSeparacao, OrdemError } from '@/lib/stock/producao/ordens'
import { listConclusoes, rendimentoMedidoDaFicha } from '@/lib/stock/producao/conclusao'
import { pedidoDaOrdem } from '@/lib/stock/producao/pedido-da-ordem'
import { carimbosDasConclusoes } from '@/lib/stock/producao/conferencia'
import { configDeRetalho, ultimoRetalhoDaFicha, retalhoDasOrdens } from '@/lib/stock/producao/retalho'
import { rastroDoPedido } from '@/lib/stock/producao/confirmar-pedido'

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

    /**
     * ⭐⭐ O PEDIDO, DO INÍCIO AO FIM (item 2 do dono, 04/10) — *"o pedido fica visível o dia
     * inteiro"*.
     *
     * ⛔ Resolvido no SERVIDOR pelo dono único da pergunta, com a ORIGEM junto. Se a tela
     * resolvesse, ela diria um pedido e a eficiência (que vem do mesmo lugar) compararia com
     * outro — e o dono veria 98% de um número que ele não reconhece.
     *
     * ⚠️ As 471 ordens que nasceram antes deste campo não têm meta: elas caem no DERIVADO, e a
     * tela DIZ que é derivado. Carimbar meta retroativa inventaria um pedido que ninguém fez.
     */
    const meta = await prisma.stockOrdemMeta.findFirst({
      where: { companyId, ordemId }, select: { unidades: true },
    })
    const pedido = pedidoDaOrdem({
      meta: meta?.unidades ?? null,
      escala: ordem.escalaReceitas,
      loteBase: ordem.loteBase,
      estado: ordem.estado,
    })

    // `lotes` vai junto: a tela precisa dizer "média de 4 lotes" e só adota a medida com 2+
    /**
     * ⭐⭐ O SELO DA CONFERÊNCIA NA LINHA DA CONCLUSÃO (itens 2c e 3) — e ele cabe nesta rota,
     * que é `stock.view`, porque o carimbo **não carrega número esperado**: ele diz QUEM
     * conferiu, QUANDO e, na corrigida, de QUE número veio.
     * ⛔ O veredito do fiscal continua existindo só na fila do gerente (`stock.manage`) — é
     * ELE a cola de prova da lei de 05/10, não o carimbo.
     */
    const carimbos = await carimbosDasConclusoes(companyId, conclusoes.map((c) => c.id), prisma)
    const conclusoesComSelo = conclusoes.map((c) => ({ ...c, conferencia: carimbos.get(c.id) ?? null }))

    /**
     * ⭐⭐ A PERGUNTA DO RETALHO MUDOU PRA CÁ (11/10) — ela saiu da criação e vem junto do número,
     * porque é a MESMA decisão (*"quanto vou produzir, contando o que sobrou de ontem"*).
     *
     * ⛔ **Só consulta quando a ordem está PLANEJADA**: é o único estado em que a pergunta
     * existe. Pagar 2 queries em TODA abertura de ordem concluída seria a lição dos 4.909 ms
     * (28/09) em versão pequena — e esta tela abre muitas vezes por dia.
     *
     * ⚠️ E `aceita: false` **não manda peso nem último kg**: a ausência da pergunta tem que vir
     * da ausência do DADO, não de um `if` na tela que alguém remove num refactor (a régua que a
     * rota `/retalho` já escreve).
     */
    const planejada = ordem.estado === 'PLANEJADA'
    const cfgRetalho = planejada ? (await configDeRetalho(companyId, [ordem.fichaId], prisma)).get(ordem.fichaId) : undefined
    const [ultimo, jaDeclarado, rastro] = planejada
      ? await Promise.all([
          cfgRetalho?.aceita ? ultimoRetalhoDaFicha(companyId, ordem.fichaId, prisma) : Promise.resolve(null),
          retalhoDasOrdens(companyId, [ordemId], prisma),
          rastroDoPedido(companyId, ordemId, prisma),
        ])
      : [null, new Map(), []]
    const retalho = !planejada || !cfgRetalho?.aceita
      ? { aceita: false as const }
      : {
          aceita: true as const,
          pesoUnidadeG: cfgRetalho.pesoUnidadeG,
          /** ⚠️ o LEMBRETE, nunca o valor do campo: ele nasce VAZIO (ordem do dono, 09/10) */
          ultimoKg: ultimo?.kg ?? null,
          /** ⭐ o que ESTA ordem já declarou — pra a correção abrir com a resposta anterior à vista */
          declaradoKg: jaDeclarado.get(ordemId)?.kg ?? null,
        }

    return NextResponse.json({
      ordem, linhas, conclusoes: conclusoesComSelo, colaboradores,
      rendimentoMedio: medido.media, rendimentoLotes: medido.lotes, parada, pedido,
      retalho,
      /** ⭐ quem declarou quanto, e quando — a 1ª vez e cada correção (append-only) */
      rastroPedido: rastro,
    })
  } catch (e) {
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 404 })
    throw e
  }
}
