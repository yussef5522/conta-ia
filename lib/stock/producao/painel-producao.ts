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
import { preverSaida, avaliarVariacao, type FaixaVariacao } from './previsao-rendimento'

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

  const [mapa, custo, conclusoes] = await Promise.all([
    lerEmProducao(companyId, db, abertas.map((o) => o.id)),
    custoMedioPorItem(db, companyId),
    conclusoesNoPeriodo(companyId, periodo.de, periodo.ate, db),
  ])

  // ⭐ o esperado de cada lote sai de `preverSaida` — a MESMA função da tela de separar e
  // da de concluir. A régua (teórico vs média medida) é da ficha do lote.
  const fichaDaOrdem = new Map(ordens.map((o) => [o.id, { fichaId: o.fichaId, versao: o.versaoFicha }]))
  const lotes: { qtdGerada: number; esperado: number | null }[] = []
  for (const c of conclusoes) {
    const f = fichaDaOrdem.get(c.ordemId)
    if (!f) continue
    const versao = await db.stockFichaVersao.findFirst({
      where: { companyId, fichaId: f.fichaId, versao: f.versao }, select: { loteBase: true },
    })
    const medido = await rendimentoMedidoDaFicha(companyId, f.fichaId, db, c.id)
    const p = preverSaida(c.escalaConsumida, { teorico: versao?.loteBase ?? 1, medido: medido.media, lotes: medido.lotes })
    lotes.push({ qtdGerada: c.qtdGerada, esperado: p.esperado })
  }
  const pond = rendimentoPonderado(lotes)

  // ⭐ a FAIXA (cor do card) vem do mesmo `avaliarVariacao` que julga o lote na conclusão —
  // um segundo limiar aqui faria o card e o aviso da tela discordarem sobre o mesmo dia.
  const totalSaiu = lotes.reduce((s, l) => s + l.qtdGerada, 0)
  const totalEsp = lotes.reduce((s, l) => s + (l.esperado ?? 0), 0)
  const faixa = pond.pct == null
    ? 'SEM_REGUA' as const
    : avaliarVariacao(totalSaiu, 1, { teorico: totalEsp, medido: totalEsp, lotes: pond.lotes }).faixa

  return {
    emAberto: abertas.length,
    valorEmProducao: valorEmProducao(mapa, custo),
    concluidasNoPeriodo: conclusoes.length,
    valorProduzidoNoPeriodo: round2(conclusoes.reduce((s, c) => s + c.custoLoteReal, 0)),
    rendimentoPeriodo: pond.pct,
    lotesNaMedia: pond.lotes,
    faixaRendimento: faixa,
    abertasDeOntem: abertas.filter((o) => ehDeOntem(o.atualizadoEm, agora)).length,
  }
}
