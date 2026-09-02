// ⭐⭐ OS NÚMEROS DO PAINEL DE PRODUÇÃO — todos rastreados a funções que já existiam.
//
// O dono pediu o plano de origem antes do código: *"quero conferir que nenhum nasceu de
// conta nova"*. O resultado da rastreagem, e o que ele mudou:
//   · "Em aberto"    → `listOrdens` + `ESTADOS_ABERTOS` (a MESMA lista que o P2 usa)
//   · "Em produção"  → `emProducaoPorOrdem` × `custoMedioPorItem`  ⚠️ ver abaixo
//   · "Concluídas"   → colunas `qtdGerada`/`custoLoteReal` gravadas pelo `concluir()`
//   · "Rendimento"   → `preverSaida`/`reguaDoRendimento`  ⚠️ a AGREGAÇÃO é nova
//   · "~N esperadas" → `escalaDoConsumo` → `preverSaida` (o que a tela da ordem já faz)
//   · % colorido     → `avaliarVariacao().faixa` (o mesmo julgamento do `concluir`)
//
// ⚠️ A PREMISSA QUE NÃO BATIA: o dono pediu que o card "Em produção" usasse "a mesma soma
// que o juiz P2 usa". **O P2 não soma dinheiro** — ele só conta horas paradas. Não havia
// soma pra reusar. Em vez de escrever a terceira expressão do em-produção, extraí
// `emProducaoPorOrdem` e migrei o P4 pra ela: de duas expressões pra uma.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { custoMedioPorItem } from '../saldo'
import { lerEmProducao, valorEmProducao } from './em-producao'
import { conclusoesNoPeriodo, rendimentoMedidoDaFicha } from './conclusao'
import { preverSaida, avaliarVariacao, MIN_LOTES_PARA_MEDIA, type FaixaVariacao } from './previsao-rendimento'

/** ⭐ Os estados de trabalho ABERTO. A MESMA lista que o P2 do juiz usa — antes estava
 *  literal nos dois lugares. Ordem aberta NUNCA obedece o filtro de período: trabalho
 *  aberto não é histórico. */
export const ESTADOS_ABERTOS = ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'] as const

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface CardsPainel {
  emAberto: number
  /** R$ de insumo parado no armazém virtual (o card âmbar: dinheiro parado) */
  valorEmProducao: number
  concluidasNoPeriodo: number
  valorProduzidoNoPeriodo: number
  /** média PONDERADA do rendimento do período; null = nada concluído ou sem régua */
  rendimentoPeriodo: number | null
  /** quantos lotes compõem a média (a tela mostra "de N lotes") */
  lotesNaMedia: number
  faixaRendimento: FaixaVariacao
  /** ordens abertas cuja última mexida foi em dia ANTERIOR (a faixa âmbar) */
  abertasDeOntem: number
}

/**
 * PURA. A média PONDERADA do rendimento — Σ(qtdGerada) ÷ Σ(esperado).
 *
 * ⚠️ POR QUE NÃO É A MÉDIA DOS PERCENTUAIS (a pergunta que alguém vai fazer):
 * porque um lote de 200 porções e um teste de 5 pesariam **igual**. Um único lote minúsculo
 * que rendeu mal derrubaria o dia inteiro — e o dono olha esse card pra decidir se a cozinha
 * está indo bem, não pra caçar o pior lote. A ponderada responde "de tudo que saiu hoje,
 * quanto do esperado a gente entregou?", que é a pergunta real.
 *
 * ⚠️ Lote SEM régua (ficha sem rendimento medido) fica FORA das duas somas — entrar com
 * esperado 0 faria a divisão explodir ou inflar o percentual.
 */
export function rendimentoPonderado(
  lotes: readonly { qtdGerada: number; esperado: number | null }[],
): { pct: number | null; lotes: number } {
  let saiu = 0
  let esperado = 0
  let n = 0
  for (const l of lotes) {
    if (l.esperado == null || l.esperado <= 0) continue
    saiu += l.qtdGerada
    esperado += l.esperado
    n++
  }
  if (n === 0 || esperado <= 0) return { pct: null, lotes: 0 }
  return { pct: round2(saiu / esperado), lotes: n }
}

/** ⚠️ "É DE ONTEM?" ≠ "PAROU?" — e a diferença é de propósito.
 *  A faixa âmbar pergunta se a ordem atravessou o dia (o insumo saiu da prateleira ontem e
 *  não virou produto). O **P2** pergunta se ela está parada há mais de 24h. Uma ordem criada
 *  ontem às 23h e mexida hoje às 8h é "de ontem" e **não** está parada — as duas coisas
 *  podem discordar sem que nenhuma esteja errada. */
export function ehDeOntem(atualizadoEm: Date, agora: Date): boolean {
  const dia = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
  return dia(atualizadoEm) !== dia(agora) && atualizadoEm.getTime() < agora.getTime()
}

export interface OrdemAberta {
  id: string
  estado: string
  atualizadoEm: Date
  fichaId: string
  loteBase: number
}

/**
 * ⭐⭐ OS TRÊS ESTADOS DO SELO (01/09/2026) — três aparências, sem promoção silenciosa.
 *
 *   MEDIDA   (≥2 lotes)  → % COLORIDO (verde/âmbar/vermelho). **Cor é julgamento.**
 *   TEORICO  (0-1 lote)  → "≈N% do teórico" em CINZA. Referência, não julgamento.
 *   SEM_DADO (fóssil)    → NADA.
 *
 * ⚠️ POR QUE O FÓSSIL NÃO GANHA SELO, e é a condição que mais importa: recalcular um lote
 * antigo com a régua de hoje produz ficção. O lote de 21/08 ("porção de carne", família de
 * LOTE FIXO: componentes de 1 KG, `loteBase` 1) dá **2500%** se recalculado — não porque
 * rendeu 25×, mas porque a ficha dele é de outra época. O julgamento fica congelado no
 * `stock_producao_desvio` do instante da conclusão; quem não tem linha lá, não tem selo.
 *
 * ⚠️ E o CINZA é o que impede o teórico de virar acusação: uma ficha com `loteBase` mal
 * preenchido geraria vermelho sem nada de errado ter acontecido na cozinha.
 */
export type EstadoSelo = 'MEDIDA' | 'TEORICO' | 'SEM_DADO'

export interface LoteDoPeriodo {
  conclusaoId: string
  ordemId: string
  qtdGerada: number
  esperado: number | null
  /** saiu ÷ esperado — o selo da linha */
  pct: number | null
  faixa: FaixaVariacao
  motivo: string | null
  selo: EstadoSelo
}

/** PURA. Qual dos três estados, a partir do que foi CONGELADO na conclusão. */
export function estadoDoSelo(
  desvio: { pctTeorico: number | null; pctMedia: number | null; lotesNaMedia: number } | null,
): EstadoSelo {
  if (!desvio) return 'SEM_DADO' // ⛔ lote anterior ao sprint: não se recalcula por cima
  if (desvio.lotesNaMedia >= MIN_LOTES_PARA_MEDIA && desvio.pctMedia != null) return 'MEDIDA'
  return desvio.pctTeorico != null ? 'TEORICO' : 'SEM_DADO'
}

/**
 * ⭐ Os lotes do período COM o julgamento por linha. É a MESMA lista que alimenta o card
 * "Rendimento" — o selo da linha e a média do card não têm como discordar.
 *
 * ⚠️ Isto nasceu de uma falha minha: o selo de % por linha estava no desenho aprovado e
 * ficou de fora do 1º deploy. O dado não faltava — a rota devolvia `rendimento` cru, mas
 * ninguém calculava o "% do esperado" nem lia o motivo do desvio. Em vez de calcular na
 * tela (uma 2ª régua), a conta sai daqui e serve os dois.
 */
export async function lotesDoPeriodo(
  companyId: string,
  periodo: { de: Date; ate: Date },
  db: PrismaClient = defaultPrisma,
): Promise<LoteDoPeriodo[]> {
  const conclusoes = await conclusoesNoPeriodo(companyId, periodo.de, periodo.ate, db)
  if (!conclusoes.length) return []
  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, id: { in: conclusoes.map((c) => c.ordemId) } },
    select: { id: true, fichaId: true, versaoFicha: true },
  })
  const porOrdem = new Map(ordens.map((o) => [o.id, o]))
  // ⭐ o julgamento CONGELADO na conclusão — é ele que decide o selo, não um recálculo.
  const desvios = await db.stockProducaoDesvio.findMany({
    where: { companyId, conclusaoId: { in: conclusoes.map((c) => c.id) } },
    select: { conclusaoId: true, motivo: true, pctTeorico: true, pctMedia: true, lotesNaMedia: true },
  })
  const desvioPorConclusao = new Map(desvios.map((d) => [d.conclusaoId, d]))

  const out: LoteDoPeriodo[] = []
  for (const c of conclusoes) {
    const o = porOrdem.get(c.ordemId)
    if (!o) continue
    const versao = await db.stockFichaVersao.findFirst({
      where: { companyId, fichaId: o.fichaId, versao: o.versaoFicha }, select: { loteBase: true },
    })
    const medido = await rendimentoMedidoDaFicha(companyId, o.fichaId, db, c.id)
    const regua = { teorico: versao?.loteBase ?? 1, medido: medido.media, lotes: medido.lotes }
    const p = preverSaida(c.escalaConsumida, regua)
    const v = avaliarVariacao(c.qtdGerada, c.escalaConsumida, regua)
    const d = desvioPorConclusao.get(c.id) ?? null
    const selo = estadoDoSelo(d)
    out.push({
      conclusaoId: c.id, ordemId: c.ordemId, qtdGerada: c.qtdGerada,
      esperado: p.esperado > 0 ? p.esperado : null,
      // ⚠️ O NÚMERO VEM DO CONGELADO, não do recálculo: é o mesmo que o operador viu ao
      // concluir. Recalcular faria o selo mudar sozinho quando a média da ficha andasse.
      pct: selo === 'MEDIDA' ? d!.pctMedia : selo === 'TEORICO' ? d!.pctTeorico : null,
      // ⚠️ a FAIXA (cor) só existe no estado MEDIDA — cor é julgamento, e teórico não julga.
      faixa: selo === 'MEDIDA' ? v.faixa : 'SEM_REGUA',
      motivo: d?.motivo ?? null,
      selo,
    })
  }
  return out
}

/** Monta os 4 cards. Nenhuma query de movimento fora de `lerEmProducao`. */
export async function cardsDoPainel(
  companyId: string,
  periodo: { de: Date; ate: Date },
  agora: Date,
  db: PrismaClient = defaultPrisma,
): Promise<CardsPainel> {
  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId },
    select: { id: true, estado: true, atualizadoEm: true, fichaId: true, versaoFicha: true },
  })
  const abertas = ordens.filter((o) => (ESTADOS_ABERTOS as readonly string[]).includes(o.estado))

  const [mapa, custo, lotes] = await Promise.all([
    lerEmProducao(companyId, db, abertas.map((o) => o.id)),
    custoMedioPorItem(db, companyId),
    // ⭐ A MESMA lista que a tela usa por linha — o card e o selo não podem discordar.
    lotesDoPeriodo(companyId, periodo, db),
  ])
  const pond = rendimentoPonderado(lotes)

  // ⭐ a FAIXA (cor do card) vem do mesmo `avaliarVariacao` que julga o lote na conclusão.
  const totalSaiu = lotes.reduce((s, l) => s + l.qtdGerada, 0)
  const totalEsp = lotes.reduce((s, l) => s + (l.esperado ?? 0), 0)
  const faixa = pond.pct == null
    ? ('SEM_REGUA' as const)
    : avaliarVariacao(totalSaiu, 1, { teorico: totalEsp, medido: totalEsp, lotes: pond.lotes }).faixa

  return {
    emAberto: abertas.length,
    valorEmProducao: valorEmProducao(mapa, custo),
    concluidasNoPeriodo: lotes.length,
    valorProduzidoNoPeriodo: round2(await valorProduzido(companyId, periodo, db)),
    rendimentoPeriodo: pond.pct,
    lotesNaMedia: pond.lotes,
    faixaRendimento: faixa,
    abertasDeOntem: abertas.filter((o) => ehDeOntem(o.atualizadoEm, agora)).length,
  }
}

/** Σ do custo real dos lotes do período — coluna gravada pelo `concluir()`, não conta nova. */
async function valorProduzido(companyId: string, periodo: { de: Date; ate: Date }, db: PrismaClient): Promise<number> {
  const r = await db.stockProducaoConclusao.aggregate({
    where: { companyId, criadoEm: { gte: periodo.de, lte: periodo.ate } },
    _sum: { custoLoteReal: true },
  })
  return r._sum.custoLoteReal ?? 0
}
