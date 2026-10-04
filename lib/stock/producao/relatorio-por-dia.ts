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
}

export interface PorReceitaNoPeriodo {
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

export interface RelatorioPorDia {
  linhas: LinhaDoRelatorio[]
  dias: SubtotalDoDia[]
  porReceita: PorReceitaNoPeriodo[]
  /** o recorte que produziu estes números — a tela ECOA, nunca escreve a data na mão */
  periodo: { de: string | null; ate: string | null }
  /** ⚠️ quando o período não tem lote nenhum, a tela DIZ o motivo em vez de mostrar zeros */
  vazio: boolean
}

/** média honesta: `null` quando não há amostra (nunca 0, que leria como "deu zero") */
function media(xs: number[]): number | null {
  if (!xs.length) return null
  return Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100
}
const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface FiltrosDoRelatorio extends JanelaDeLotes {
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
  if (!lotes.length) return { linhas: [], dias: [], porReceita: [], periodo, vazio: true }

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
    }
  })

  // ⚠️ os filtros de setor/pessoa entram DEPOIS: eles recortam a LISTA, e os subtotais saem
  // da lista recortada — senão o dia somaria lotes que a tela não mostra.
  if (filtros.setor) linhas = linhas.filter((l) => l.setor === filtros.setor)
  if (filtros.quemConcluiu) linhas = linhas.filter((l) => l.quemConcluiu === filtros.quemConcluiu)
  if (!linhas.length) return { linhas: [], dias: [], porReceita: [], periodo, vazio: true }

  const dias = agruparPorDia(linhas)
  const porReceita = agruparPorReceita(linhas)
  return { linhas, dias, porReceita, periodo, vazio: false }
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
