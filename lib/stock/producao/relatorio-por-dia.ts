/**
 * ⭐⭐⭐ RELATÓRIO DE PRODUÇÃO POR DIA — item 3 do dono (04/10/2026).
 *
 * **Pedido:** *"Calendário/período livre: escolho dia 25 do mês passado e vejo POR ORDEM/RECEITA
 * — pedido (UN) · separado do estoque (R$ total) · produzido real (UN) · eficiência % colorida ·
 * TEMPO de produção. Subtotais do dia e por receita no período. Clicar na linha abre a ordem."*
 *
 * ⛔⛔ **A ORDEM FOI EXPLÍCITA: "NENHUMA conta nova fora da porta `explodirReceita` /
 * `eficienciaDaOrdem` (REGRA 11: paralela = vermelho)".** Então este arquivo é **TRADUTOR**:
 *
 * | o que a tela mostra | de onde vem (e NUNCA é recalculado aqui) |
 * |---|---|
 * | pedido · produzido · minutos · dia | **`lotesDaJanela`** — o dono da janela desde 13/09 |
 * | eficiência % | **`stock_producao_desvio.pctTeorico`**, CONGELADO na conclusão |
 * | separado do estoque (R$) | **`custoLoteReal`** da conclusão (Σ consumido × custo médio) |
 * | "pedido → entregue (105%)" | **`rendimentoDoLote`** de `desempenho.ts` |
 * | tempo que conta na média | **`foiMedido` / `ehRelampago`** de `desempenho.ts` |
 * | soma de quantidade | **`somarQuantidades`** — UN e KG nunca viram um número só |
 *
 * ⭐⭐ **A EFICIÊNCIA É A CONGELADA, e isso é a decisão central.** Recalcular aqui faria a tela
 * discordar do juiz **P8** (que lê a coluna) e do bloco da própria ordem — e aí o dono veria
 * três percentuais pro mesmo lote. É a mesma razão de o selo do painel usar o pct congelado em
 * vez de recomputar (03/10).
 *
 * ⚠️ **E A COLUNA SE CHAMA `pctTeorico` POR HISTÓRIA, não por significado:** ela guarda
 * *"saiu ÷ o que a FICHA promete"* desde 03/10; o nome ficou porque migration de estoque é
 * CREATE-only (o isolamento proíbe ALTER).
 */

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { lotesDaJanela, type JanelaDeLotes } from './lotes'
import { foiMedido, ehRelampago, somarQuantidades, rendimentoDoLote, type Quantidade } from './desempenho'

type Db = PrismaClient

export interface LinhaDoRelatorio {
  ordemId: string
  dia: string
  tarefa: string
  /** ⭐ o item produzido — a chave por onde o dono OCULTA uma receita (por id, nunca por nome) */
  itemId: string
  unidade: string
  /** o pedido em unidades do produto — `null` quando a ordem nasceu sem meta */
  pedido: number | null
  produzido: number
  /** % do pedido (o "pedido → entregue" da casa) */
  pctDoPedido: number | null
  seloDoPedido: 'OK' | 'BAIXO' | 'ALTO' | 'SEM_META'
  /**
   * ⭐ a eficiência CONGELADA contra a ficha — a MESMA que o juiz P8 lê. `null` quando a
   * conclusão é anterior ao congelamento (03/10).
   */
  eficiencia: number | null
  /** o que saiu do estoque pra este lote, em R$ (`custoLoteReal`) */
  separadoReais: number | null
  /** minutos de trabalho MEDIDO (soma dos cronômetros) — `null` quando não dá pra dizer */
  minutos: number | null
  /** ⚠️ `true` quando o registro é retroativo (< 5 min): conta na produção, FORA do tempo */
  relampago: boolean
  setor: string | null
  quemConcluiu: string | null
  /**
   * quando a conclusão foi lançada (ISO) — alimenta o "encerrou às" do cabeçalho do dia.
   * ⚠️ OPCIONAL: campo obrigatório aqui obrigaria toda fixture de linha a inventar um instante,
   * e conclusão antiga legitimamente não tem. Ausente == `null` == a tela cala.
   */
  encerradoAs?: string | null
}

export interface SubtotalDoDia {
  dia: string
  lotes: number
  /** ⛔ POR UNIDADE: somar UN com KG num número só é o pecado de 13/09 */
  pedido: Quantidade
  produzido: Quantidade
  /** quantos lotes do dia não têm pedido registrado — a tela DIZ, nunca esconde */
  semPedido: number
  /** média da eficiência congelada, só sobre os lotes que a têm */
  eficienciaMedia: number | null
  lotesComEficiencia: number
  separadoReais: number
  /** minutos somados dos lotes MEDIDOS + quantos ficaram fora */
  minutos: number | null
  semTempo: number
  relampagos: number
  /**
   * ⭐ O SUBTÍTULO DO DIA — *"N ordens · setores · hora de encerramento"* (pedido do dono).
   * Sai daqui e não da tela: lista distinta e máximo são tradução, e a régua desta tela é
   * *"a tela desenha, a lib traduz"*.
   */
  setores: string[]
  /** HH:MM da ÚLTIMA ordem encerrada no dia — `null` quando nenhum lote carrega o instante */
  encerrouAs: string | null
}

export interface PorReceitaNoPeriodo {
  itemId: string
  tarefa: string
  unidade: string
  lotes: number
  pedido: Quantidade
  produzido: Quantidade
  semPedido: number
  pctMedio: number | null
  eficienciaMedia: number | null
  separadoReais: number
  /** média de minutos POR LOTE, só sobre os medidos */
  minutosPorLote: number | null
  semTempo: number
  relampagos: number
}

/** uma receita que produziu no período — a lista que o SELETOR oferece */
export interface ReceitaDoPeriodo {
  itemId: string
  tarefa: string
  /** quantos lotes ela fez no período — o seletor ordena por isso, não alfabético */
  lotes: number
  oculta: boolean
}

export interface RelatorioPorDia {
  linhas: LinhaDoRelatorio[]
  dias: SubtotalDoDia[]
  porReceita: PorReceitaNoPeriodo[]
  /**
   * ⭐⭐ TODAS as receitas do período, **antes** de esconder — com a marca de quem está oculta.
   *
   * ⛔ É a lista que o seletor desenha, e ela TEM que ser a completa: derivá-la das linhas
   * filtradas tiraria a receita oculta do próprio painel que existe pra desocultá-la. *Esconder
   * o gesto de desfazer é como uma escolha reversível vira permanente.*
   */
  receitasDoPeriodo: ReceitaDoPeriodo[]
  /**
   * ⚠️ Quantas receitas estão REALMENTE sendo escondidas DESTA VISTA — não o tamanho da
   * preferência. O dono pode ter 10 ocultas e só 3 terem produzido no recorte; dizer "10
   * ocultas" seria a tela afirmando um filtro que ela não está aplicando.
   */
  ocultasNoPeriodo: number
  /** o recorte que produziu estes números — a tela ECOA, nunca escreve a data na mão */
  periodo: { de: string | null; ate: string | null }
  /** ⚠️ quando o período não tem lote nenhum, a tela DIZ o motivo em vez de mostrar zeros */
  vazio: boolean
}

/**
 * ⭐⭐ O TEXTO DO PEDIDO — e ele existe por um defeito que SÓ a prova em prod pegou (04/10).
 *
 * ⛔⛔ Com as 471 ordens antigas sem meta, `somarQuantidades([])` devolve `texto: '0'` — o
 * contrato DELE está certo ("zero de nada"), mas a tela imprimia **"pedido 0"**, e isso lê
 * como ***"pedi zero"***. É exatamente o pecado que este sprint inteiro combate: *ausência
 * NÃO é zero* (a régua do "sem contagem" do estoque e do "a apurar" das vendas).
 *
 * ⚠️ A régua mora AQUI, não no JSX: a tela do relatório, o CSV e qualquer leitor futuro
 * precisam da mesma frase — duas versões divergiriam no primeiro ajuste de rótulo.
 */
export function textoDoPedido(q: Quantidade, semPedido: number, lotes: number): string {
  if (semPedido >= lotes) return 'sem pedido registrado'
  return q.texto
}

/** média honesta: `null` quando não há amostra (nunca 0, que leria como "deu zero") */
function media(xs: number[]): number | null {
  if (!xs.length) return null
  return Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100
}
const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface FiltrosDoRelatorio extends JanelaDeLotes {
  /** ⭐ os itemId que o DONO escolheu esconder (preparos miúdos). Decisão dele, persistida. */
  ocultas?: string[]
  setor?: string
  quemConcluiu?: string
}

export async function relatorioPorDia(
  companyId: string,
  filtros: FiltrosDoRelatorio = {},
  db: Db = defaultPrisma,
): Promise<RelatorioPorDia> {
  /**
   * ⭐ A JANELA E OS LOTES SAEM DO DONO DA PERGUNTA. Repetir a query aqui faria este relatório
   * e o de desempenho discordarem sobre quais lotes existem no mesmo dia — e os dois ficariam
   * plausíveis.
   */
  const lotes = await lotesDaJanela(companyId, { de: filtros.de, ate: filtros.ate, tarefa: filtros.tarefa }, db)
  const periodo = {
    de: filtros.de ? filtros.de.toISOString().slice(0, 10) : null,
    ate: filtros.ate ? filtros.ate.toISOString().slice(0, 10) : null,
  }
  if (!lotes.length) return { linhas: [], dias: [], porReceita: [], periodo, receitasDoPeriodo: [], ocultasNoPeriodo: 0, vazio: true }

  const ordemIds = lotes.map((l) => l.ordemId)
  const [desvios, conclusoes, ordens] = await Promise.all([
    // ⭐ a eficiência CONGELADA — a mesma coluna que o P8 lê
    db.stockProducaoDesvio.findMany({
      where: { companyId, ordemId: { in: ordemIds } },
      select: { ordemId: true, pctTeorico: true },
    }),
    db.stockProducaoConclusao.findMany({
      where: { companyId, ordemId: { in: ordemIds } },
      select: { ordemId: true, custoLoteReal: true, colaboradorId: true },
    }),
    db.stockProductionOrder.findMany({
      where: { companyId, id: { in: ordemIds } },
      select: { id: true, setorId: true },
    }),
  ])

  const setoresIds = [...new Set(ordens.map((o) => o.setorId).filter((x): x is string => !!x))]
  const colabIds = [...new Set(conclusoes.map((c) => c.colaboradorId).filter((x): x is string => !!x))]
  const [setores, colaboradores] = await Promise.all([
    setoresIds.length
      ? db.stockSetor.findMany({ where: { companyId, id: { in: setoresIds } }, select: { id: true, nome: true } })
      : Promise.resolve([]),
    colabIds.length
      ? db.stockColaborador.findMany({ where: { companyId, id: { in: colabIds } }, select: { id: true, nome: true } })
      : Promise.resolve([]),
  ])
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]))
  const nomeColab = new Map(colaboradores.map((c) => [c.id, c.nome]))
  const pctPorOrdem = new Map(desvios.map((d) => [d.ordemId, d.pctTeorico]))
  const setorPorOrdem = new Map(ordens.map((o) => [o.id, o.setorId]))

  /**
   * ⚠️ produção PARCIAL gera VÁRIAS conclusões na mesma ordem — o custo SOMA (é o material que
   * saiu) e quem concluiu é o do ÚLTIMO registro. `lotesDaJanela` já soma o produzido; repetir
   * a soma aqui duplicaria o lote.
   */
  const custoPorOrdem = new Map<string, number>()
  const quemPorOrdem = new Map<string, string | null>()
  for (const c of conclusoes) {
    custoPorOrdem.set(c.ordemId, (custoPorOrdem.get(c.ordemId) ?? 0) + c.custoLoteReal)
    if (c.colaboradorId) quemPorOrdem.set(c.ordemId, nomeColab.get(c.colaboradorId) ?? null)
  }

  let linhas: LinhaDoRelatorio[] = lotes.map((l) => {
    const rend = rendimentoDoLote(l.pedido, l.entregue, l.unidade)
    const setorId = setorPorOrdem.get(l.ordemId) ?? null
    return {
      ordemId: l.ordemId,
      dia: l.dia,
      tarefa: l.tarefa,
      itemId: l.itemId ?? '',
      unidade: l.unidade,
      pedido: rend.pedido,
      produzido: l.entregue,
      pctDoPedido: rend.pct,
      seloDoPedido: rend.selo,
      eficiencia: pctPorOrdem.get(l.ordemId) ?? null,
      separadoReais: custoPorOrdem.has(l.ordemId) ? r2(custoPorOrdem.get(l.ordemId)!) : null,
      // ⭐ o tempo só vale quando FOI MEDIDO — a régua de 13/09, num lugar só
      minutos: foiMedido(l.minutos) ? l.minutos : null,
      relampago: ehRelampago(l.minutos),
      setor: setorId ? nomeSetor.get(setorId) ?? null : null,
      quemConcluiu: quemPorOrdem.get(l.ordemId) ?? null,
      encerradoAs: l.encerradoAs ?? null,
    }
  })

  // ⚠️ os filtros de setor/pessoa entram DEPOIS: eles recortam a LISTA, e os subtotais saem
  // da lista recortada — senão o dia somaria lotes que a tela não mostra.
  if (filtros.setor) linhas = linhas.filter((l) => l.setor === filtros.setor)
  if (filtros.quemConcluiu) linhas = linhas.filter((l) => l.quemConcluiu === filtros.quemConcluiu)

  /**
   * ⭐⭐ O RECORTE DO QUE O DONO ESCOLHEU VER — **depois** dos outros filtros, **antes** das
   * agregações. A função é PURA e exportada (ver o bloco dela): é lá que o invariante vive.
   */
  const recorte = recortarPorReceitasVisiveis(linhas, filtros.ocultas ?? [])
  const { receitasDoPeriodo, ocultasNoPeriodo } = recorte
  linhas = recorte.linhas

  const vazio = { linhas: [], dias: [], porReceita: [], periodo, receitasDoPeriodo, ocultasNoPeriodo, vazio: true }
  if (!linhas.length) return vazio

  const dias = agruparPorDia(linhas)
  const porReceita = agruparPorReceita(linhas)
  return { linhas, dias, porReceita, periodo, receitasDoPeriodo, ocultasNoPeriodo, vazio: false }
}

/**
 * ⭐⭐ PURA — aplica a escolha "o que eu vejo" e devolve a lista do seletor junto.
 *
 * ⛔⛔ **A ORDEM É O INVARIANTE.** Esconder ANTES de agregar é o que faz `Σ(linhas) == total`
 * continuar fechando **por construção**: esconder só no desenho deixaria o subtotal do dia
 * somando lote que a tela não mostra, e o rodapé passaria a dizer um número que as linhas acima
 * não somam — a doença do cabeçalho que afirmava *"69 duplicatas"* com a aba dizendo 0.
 *
 * ⭐ **E a lista do seletor sai da lista COMPLETA**, antes do corte: derivá-la das linhas que
 * sobraram tiraria a receita oculta do próprio painel que existe pra desocultá-la. *Esconder o
 * gesto de desfazer é como escolha reversível vira permanente.*
 *
 * ⚠️ `ocultasNoPeriodo` conta o que está REALMENTE sendo escondido DESTA vista, nunca o tamanho
 * da preferência: 10 ocultas com 3 produzindo no recorte são **3**, senão a tela afirma um
 * filtro que ela não aplicou.
 */
export function recortarPorReceitasVisiveis(
  linhas: LinhaDoRelatorio[],
  ocultasIds: string[],
): { linhas: LinhaDoRelatorio[]; receitasDoPeriodo: ReceitaDoPeriodo[]; ocultasNoPeriodo: number } {
  const ocultas = new Set(ocultasIds)

  const contaPorItem = new Map<string, { tarefa: string; lotes: number }>()
  for (const l of linhas) {
    const a = contaPorItem.get(l.itemId) ?? { tarefa: l.tarefa, lotes: 0 }
    contaPorItem.set(l.itemId, { tarefa: a.tarefa, lotes: a.lotes + 1 })
  }
  const receitasDoPeriodo: ReceitaDoPeriodo[] = [...contaPorItem.entries()]
    .map(([itemId, v]) => ({ itemId, tarefa: v.tarefa, lotes: v.lotes, oculta: ocultas.has(itemId) }))
    // ⭐ por LOTES: o preparo miúdo que o dono quer esconder cai no fim sozinho
    .sort((a, b) => b.lotes - a.lotes || a.tarefa.localeCompare(b.tarefa))

  return {
    linhas: ocultas.size ? linhas.filter((l) => !ocultas.has(l.itemId)) : linhas,
    receitasDoPeriodo,
    ocultasNoPeriodo: receitasDoPeriodo.filter((r) => r.oculta).length,
  }
}

/**
 * PURA — a hora (HH:MM, fuso do Brasil) da última conclusão do dia.
 *
 * ⚠️ Formata em `America/Sao_Paulo` pelo MESMO motivo que o `dia` do lote é datado lá: o
 * servidor roda em UTC, e às 21h de SP o relógio cru diria a hora de amanhã.
 */
export function horaDeEncerramento(ls: { encerradoAs?: string | null }[]): string | null {
  const isos = ls.map((l) => l.encerradoAs ?? null).filter((x): x is string => !!x)
  if (!isos.length) return null
  const ultima = isos.reduce((a, b) => (a > b ? a : b))
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ultima))
}

/** PURA — os subtotais do dia. Exportada pra ser testável sem banco. */
export function agruparPorDia(linhas: LinhaDoRelatorio[]): SubtotalDoDia[] {
  const porDia = new Map<string, LinhaDoRelatorio[]>()
  for (const l of linhas) porDia.set(l.dia, [...(porDia.get(l.dia) ?? []), l])

  return [...porDia.entries()]
    .map(([dia, ls]) => {
      const medidos = ls.filter((l) => l.minutos != null)
      const comEf = ls.filter((l) => l.eficiencia != null)
      return {
        dia,
        lotes: ls.length,
        /**
         * ⛔⛔ POR UNIDADE. Num mesmo dia a cozinha faz porção (UN) e massa (KG): somar os dois
         * dá o `1.415,84 un` de 13/09 — *"um número que não existe"*.
         */
        pedido: somarQuantidades(ls.filter((l) => l.pedido != null).map((l) => ({ unidades: l.pedido!, unidade: l.unidade }))),
        produzido: somarQuantidades(ls.map((l) => ({ unidades: l.produzido, unidade: l.unidade }))),
        semPedido: ls.filter((l) => l.pedido == null).length,
        eficienciaMedia: media(comEf.map((l) => l.eficiencia!)),
        lotesComEficiencia: comEf.length,
        // ⭐ dinheiro SOMA — é a única grandeza que atravessa unidades sem mentir
        separadoReais: r2(ls.reduce((s, l) => s + (l.separadoReais ?? 0), 0)),
        minutos: medidos.length ? medidos.reduce((s, l) => s + l.minutos!, 0) : null,
        semTempo: ls.length - medidos.length,
        relampagos: ls.filter((l) => l.relampago).length,
        setores: [...new Set(ls.map((l) => l.setor).filter((x): x is string => !!x))].sort(),
        /**
         * ⚠️ O MÁXIMO, não o mínimo: *"encerrou às"* é a hora em que a cozinha fechou o dia.
         * Lote sem instante (conclusão antiga) simplesmente não entra — e se NENHUM tiver,
         * devolve `null`, que a tela cala. Inventar uma hora seria afirmar um fato.
         */
        encerrouAs: horaDeEncerramento(ls),
      }
    })
    .sort((a, b) => b.dia.localeCompare(a.dia))
}

/**
 * PURA — o acompanhamento de CADA receita no período (*"porção de frango nos últimos 30 dias"*).
 *
 * ⭐ Aqui a soma de quantidade é SEGURA por construção: uma receita produz uma coisa só, numa
 * unidade só — é o mesmo raciocínio que `tarefasDaJanela` já documenta.
 */
export function agruparPorReceita(linhas: LinhaDoRelatorio[]): PorReceitaNoPeriodo[] {
  const porTarefa = new Map<string, LinhaDoRelatorio[]>()
  for (const l of linhas) porTarefa.set(l.tarefa, [...(porTarefa.get(l.tarefa) ?? []), l])

  return [...porTarefa.entries()]
    .map(([tarefa, ls]) => {
      const medidos = ls.filter((l) => l.minutos != null)
      const comPct = ls.filter((l) => l.pctDoPedido != null)
      const comEf = ls.filter((l) => l.eficiencia != null)
      return {
        itemId: ls[0].itemId,
        tarefa,
        unidade: ls[0].unidade,
        lotes: ls.length,
        pedido: somarQuantidades(ls.filter((l) => l.pedido != null).map((l) => ({ unidades: l.pedido!, unidade: l.unidade }))),
        produzido: somarQuantidades(ls.map((l) => ({ unidades: l.produzido, unidade: l.unidade }))),
        semPedido: ls.filter((l) => l.pedido == null).length,
        pctMedio: media(comPct.map((l) => l.pctDoPedido!)),
        eficienciaMedia: media(comEf.map((l) => l.eficiencia!)),
        separadoReais: r2(ls.reduce((s, l) => s + (l.separadoReais ?? 0), 0)),
        minutosPorLote: media(medidos.map((l) => l.minutos!)),
        semTempo: ls.length - medidos.length,
        relampagos: ls.filter((l) => l.relampago).length,
      }
    })
    // ⭐ ordena pelo que mais produziu em LOTES, não em unidades: ordenar por unidade compararia
    // UN com KG (a correção de 13/09 no "top tarefa")
    .sort((a, b) => b.lotes - a.lotes || a.tarefa.localeCompare(b.tarefa))
}
