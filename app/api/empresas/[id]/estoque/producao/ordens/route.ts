// ESTOQUE FASE 2 item 2.1 — ordens de produção (GET lista, POST cria).

import { NextRequest, NextResponse } from 'next/server'
import { dataDaOrdem, DataDaOrdemError } from '@/lib/stock/producao/data-da-ordem'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listOrdens, criarOrdem, receitaDasOrdens, OrdemError } from '@/lib/stock/producao/ordens'
import { sugestoesDeProducao } from '@/lib/stock/producao/sugestao-cardapio'
import { cardsDoPainel, lotesDoPeriodo, ESTADOS_ABERTOS, ehDeOntem } from '@/lib/stock/producao/painel-producao'
import { conclusoesNoPeriodo } from '@/lib/stock/producao/conclusao'
import { fiscalDeOrdens } from '@/lib/stock/producao/fiscal-dos-lotes'
import { contextoDasAbertas, pedidoPorOrdem } from '@/lib/stock/producao/contexto-das-abertas'
import { somarQuantidades } from '@/lib/stock/producao/desempenho'
import { diaEmSaoPaulo, janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'

interface Params { params: Promise<{ id: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  // ⭐ PERÍODO só governa as CONCLUÍDAS. Ordem aberta aparece SEMPRE — trabalho aberto
  // não é histórico (a regra central do redesenho).
  const sp = request.nextUrl.searchParams
  const agora = new Date()
  // ⚠️⚠️ O DIA É O DE QUEM OPERA (São Paulo), NUNCA UTC.
  //
  // ⛔ ISTO JÁ FOI CORRIGIDO UMA VEZ, EM 02/09 — **no ramo sem parâmetros**. E a tela SEMPRE
  // manda `?de=&ate=`, então o ramo consertado é o único que ela nunca usa: o recorte
  // `${dia}T00:00:00.000Z` continuou cobrindo o dia UTC, que em São Paulo começa às 21h do
  // dia ANTERIOR. Medido em prod às 22:16 de 05/09: 9 conclusões do dia, "hoje" mostrando
  // ZERO. É a família "N caminhos, 1 esquecido" — consertar o vizinho e não o vizinho do lado.
  //
  // ⭐ Agora os dois ramos passam pela MESMA função (`janelaDoDiaSP`), então não há como um
  // responder um dia e o outro responder outro.
  const hoje = diaEmSaoPaulo(agora)
  const { de, ate } = janelaDoDiaSP(sp.get('de') || hoje, sp.get('ate') || hoje)

  const [ordens, sugestoes, painel, concluidas] = await Promise.all([
    listOrdens(companyId),
    sugestoesDeProducao(companyId, prisma),
    cardsDoPainel(companyId, { de, ate }, agora, prisma),
    conclusoesNoPeriodo(companyId, de, ate, prisma),
  ])
  // ⭐ o selo de % por linha — MESMA fonte do card "Rendimento"
  const lotes = await lotesDoPeriodo(companyId, { de, ate }, prisma)
  const seloPorConclusao = new Map(lotes.map((l) => [l.conclusaoId, l]))
  /**
   * ⭐⭐ O FISCAL — *"o declarado cabe no material separado?"*. Em LOTE (4 consultas pra N
   * ordens), nunca uma por ordem: esta é a tela que o dono abre todo dia.
   * ⛔ A tela recebe só o BOOLEANO: o pontinho é SINAL, e a conta mora na página da ordem.
   * Mandar o número pra cá abriria a porta pra alguém o desenhar e recriar a pílula que o dono
   * acabou de mandar embora.
   */
  const fiscal = await fiscalDeOrdens(companyId, [...new Set(concluidas.map((c) => c.ordemId))], prisma)
  const abertas = ordens
    .filter((o) => (ESTADOS_ABERTOS as readonly string[]).includes(o.estado))
    .map((o) => ({ ...o, deOntem: ehDeOntem(new Date(o.dataProducao), agora) }))

  /**
   * ⭐⭐ O CONTEXTO DAS ABERTAS (mock v3, 04/10) — *"quem · começou HHhMM"* + o PEDIDO.
   * ⛔ Em LOTE (3 queries pra N ordens), nunca uma por ordem: é a lição medida dos 4.909 ms
   * da lista de receitas (28/09).
   */
  const contexto = await contextoDasAbertas(companyId, abertas, prisma)

  /**
   * ⭐ O PEDIDO das concluídas, pro par *"pedido → fez"*. ⚠️ Vem do MESMO `pedidoDaOrdem` das
   * abertas — e NÃO é o denominador da pílula (ver o bloco em `contexto-das-abertas.ts`).
   */
  /**
   * ⛔⛔ **RESOLVIDO POR ID, nunca filtrando o `ordens` (que é TRUNCADO em 200 encerradas).**
   * Medido em prod no período de 30 dias: **379 conclusões × 207 ordens no payload → 200 linhas
   * com nome "—", sem logo, sem pedido e sem pílula.** É o teto de leitura escondendo o item,
   * pela 4ª vez nesta casa (o `take: 50` do fermento, o `take: 200` da ordem do ano 202, o
   * `take: 300` do recebimento) — e aqui ele apagava o visual de MAIS DA METADE da lista.
   */
  const idsDasConclusoes = [...new Set(concluidas.map((c) => c.ordemId))]
  const receitaDasConcluidas = await receitaDasOrdens(companyId, idsDasConclusoes, prisma)
  const metasDasConclusoes = idsDasConclusoes.length
    ? await prisma.stockOrdemMeta.findMany({
        where: { companyId, ordemId: { in: idsDasConclusoes } },
        select: { ordemId: true, unidades: true },
      })
    : []
  const pedidoDasConcluidas = pedidoPorOrdem(
    Object.entries(receitaDasConcluidas).map(([id, r]) => ({ id, escalaReceitas: r.escalaReceitas, loteBase: r.loteBase })),
    metasDasConclusoes,
  )

  /**
   * ⭐⭐ O Σ DE HOJE da linha editorial do topo (*"a cozinha já produziu N unidades hoje"*).
   *
   * ⛔⛔ **POR UNIDADE, pelo `somarQuantidades`** — somar porção (UN) com massa (KG) num número
   * só é o `1.415,84 un` de 13/09, *"um número que não existe"*.
   * ⚠️ E é SEMPRE o dia de hoje, independente do chip de período: a frase diz "hoje", então ela
   * não pode somar o mês. Quando o período JÁ é hoje, reusa a lista (zero query a mais).
   */
  const janelaHoje = janelaDoDiaSP(hoje, hoje)
  const mesmaJanela = de.getTime() === janelaHoje.de.getTime() && ate.getTime() === janelaHoje.ate.getTime()
  const doDia = mesmaJanela ? concluidas : await conclusoesNoPeriodo(companyId, janelaHoje.de, janelaHoje.ate, prisma)
  const unidadePorOrdem = new Map(ordens.map((o) => [o.id, o.unidadeProduzido]))
  const produzidoHoje = somarQuantidades(
    doDia.map((c) => ({ unidades: c.qtdGerada, unidade: unidadePorOrdem.get(c.ordemId) ?? 'UN' })),
  )

  return NextResponse.json({
    ordens, sugestoes, painel, abertas, contexto, pedidoDasConcluidas, receitaDasConcluidas,
    /** ⚠️ `lotes` é a contagem de conclusões de hoje — a frase usa o TEXTO por unidade */
    hoje: { dia: hoje, produzido: produzidoHoje, lotes: doDia.length },
    concluidas: concluidas.map((c) => {
      const s = seloPorConclusao.get(c.id)
      return {
        ...c,
        pct: s?.pct ?? null, faixa: s?.faixa ?? 'SEM_REGUA', motivo: s?.motivo ?? null,
        selo: s?.selo ?? 'SEM_DADO',
        fiscalImpossivel: fiscal.get(c.ordemId)?.impossivel ?? false,
      }
    }),
    // ⚠️ o período ECOA os DIAS pedidos (calendário de SP), nunca o recorte UTC — senão a
    // tela imprimiria 'de 04/09' pra uma janela que começa no dia 05.
    periodo: { de: sp.get('de') || hoje, ate: sp.get('ate') || hoje },
  })
}

const criarSchema = z.object({
  fichaId: z.string().min(1),
  escalaReceitas: z.number().positive(),
  // ⛔ NÃO é `.min(1)` — foi ele que aceitou "0202-09-18" e sumiu com um lote (19/09)
  dataProducao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data no calendário (ano com 4 dígitos).'),
  setorId: z.string().nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
  /**
   * ⭐⭐ O PEDIDO EM UNIDADES (item 2 do dono, 04/10) — *"quero produzir: 80 UN"*.
   *
   * ⚠️ **OPCIONAL no schema, e isso é o que mantém o caminho antigo vivo.** A sugestão de
   * min/máx cria ordem com a escala calculada e não "pede" nada; a cozinha pelo tablet
   * também não. Exigir aqui quebraria os dois — e quem cobre a ausência é o DERIVADO de
   * `pedidoDaOrdem`, **marcado como derivado**, nunca fingindo ser declarado.
   *
   * ⛔ E ele NÃO substitui `escalaReceitas`: a separação continua sendo ficha × pedido pela
   * porta única (a decisão de 03/10). Este campo é o que o DONO DISSE, pra tela e relatório
   * terem contra o que comparar o produzido.
   */
  pedidoUnidades: z.number().positive().max(1_000_000).nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da ordem inválidos.' }, { status: 400 })
  try {
    const r = await criarOrdem({ companyId, userId: a.user!.sub, ...parsed.data, dataProducao: dataDaOrdem(parsed.data.dataProducao) })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    // ⚠️ a data ruim recusa com a MESMA cara de erro de domínio: ela é decisão do dono
    //    (escolher a data), não bug — e a frase DIZ o que fazer.
    if (e instanceof OrdemError || e instanceof DataDaOrdemError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
