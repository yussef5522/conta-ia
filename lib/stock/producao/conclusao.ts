// ESTOQUE FASE 2 item 2.2 — CONCLUSÃO da ordem ("quantos saíram?"). O fluxo do dono,
// travado: confirma o que foi REALMENTE consumido (pré = em-produção; sobra volta) → diz
// quantos saíram → PRODUCAO_CONSUMO (baixa da produção) + PRODUCAO_GERACAO (produto entra
// com CUSTO REAL do lote) → rendimento MEDIDO contra o consumo real (nunca a escala) →
// compara com a média (±15%) → registra. Parcial: várias conclusões na mesma ordem. Só stock_.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { custoMedioPorItem, recomputeSaldoCache } from '../saldo'
import { separadoPorItem, TIPO_CONSUMO, TIPO_DEVOLUCAO, TIPO_GERACAO, OrdemError } from './ordens'
import { escalaDoConsumo, avaliarVariacao, type Variacao } from './previsao-rendimento'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round4 = (n: number) => Math.round((n + 1e-9) * 10000) / 10000
const RENDIMENTO_DESVIO = 0.15 // ±15% dispara alerta (config futura)

export interface ConsumoInput { itemId: string; qtdConsumida: number }
export interface ConcluirInput {
  companyId: string
  ordemId: string
  consumo: ConsumoInput[]
  qtdGerada: number
  colaboradorId?: string | null
  /** o que o dono escreveu quando o rendimento destoou — opcional, nunca cobrado */
  motivoDesvio?: string | null
  parcial?: boolean
  userId?: string
}
export interface ConcluirResult {
  conclusaoId: string
  qtdGerada: number
  rendimento: number
  escalaConsumida: number
  custoLoteReal: number
  custoUnitarioReal: number | null
  validadeAte: string | null
  rendimentoMedioAnterior: number | null // média das conclusões anteriores da ficha
  desvio: number | null // (rendimento − média) / média
  foraDaFaixa: boolean // |desvio| > 15%
  variacao: Variacao // ⭐ o MESMO julgamento que a tela mostrou antes de confirmar
  estado: string
}

/** Média móvel das últimas 5 conclusões da MESMA ficha + QUANTAS a compõem.
 *
 * ⭐ O `lotes` existe porque *"uma produção só não é média"* (dono, 01/09): a previsão e o
 * aviso só adotam a medida a partir de 2 lotes (`MIN_LOTES_PARA_MEDIA`), e a tela precisa
 * dizer de quantos lotes ela vem. ⚠️ O CUSTO continua usando desde o 1º — são perguntas
 * diferentes: *"custo é 'quanto custou', previsão é 'quanto vai sair'"*.
 */
export async function rendimentoMedidoDaFicha(companyId: string, fichaId: string, db: PrismaClient = defaultPrisma, exceptConclusaoId?: string): Promise<{ media: number | null; lotes: number }> {
  const ordens = await db.stockProductionOrder.findMany({ where: { companyId, fichaId }, select: { id: true } })
  const ids = ordens.map((o) => o.id)
  if (!ids.length) return { media: null, lotes: 0 }
  const cs = await db.stockProducaoConclusao.findMany({ where: { companyId, ordemId: { in: ids }, ...(exceptConclusaoId ? { id: { not: exceptConclusaoId } } : {}) }, orderBy: { criadoEm: 'desc' }, take: 5, select: { rendimento: true } })
  if (!cs.length) return { media: null, lotes: 0 }
  return { media: round4(cs.reduce((s, c) => s + c.rendimento, 0) / cs.length), lotes: cs.length }
}

/** casca fina histórica — só a média, pros callers que não precisam da contagem. */
export async function rendimentoMedioDaFicha(companyId: string, fichaId: string, db: PrismaClient = defaultPrisma, exceptConclusaoId?: string): Promise<number | null> {
  return (await rendimentoMedidoDaFicha(companyId, fichaId, db, exceptConclusaoId)).media
}

export async function concluir(input: ConcluirInput, db: PrismaClient = defaultPrisma): Promise<ConcluirResult> {
  if (!(input.qtdGerada > 0)) throw new OrdemError('Informe quantos saíram (maior que zero).')
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: input.ordemId, companyId: input.companyId } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA' && ordem.estado !== 'EM_PRODUCAO') throw new OrdemError('Só conclui uma ordem separada ou em produção.')

  const consumoPos = input.consumo.filter((c) => c.qtdConsumida > 0)
  if (!consumoPos.length) throw new OrdemError('Informe o que foi consumido (ao menos um item).')

  const [emProd, custoMap, versao] = await Promise.all([
    separadoPorItem(input.companyId, input.ordemId, db),
    custoMedioPorItem(db, input.companyId),
    db.stockFichaVersao.findFirst({ where: { companyId: input.companyId, fichaId: ordem.fichaId, versao: ordem.versaoFicha } }),
  ])
  // não dá pra consumir mais do que está em produção
  for (const c of consumoPos) {
    const disp = emProd.get(c.itemId) ?? 0
    if (c.qtdConsumida > disp + 0.001) throw new OrdemError(`Não dá pra consumir ${c.qtdConsumida} — só ${round2(disp)} desse item está em produção.`)
  }

  // componentes da versão (qtd por lote base) → escala consumida = média de (consumido / porLote)
  const comps = versao ? await db.stockFichaComponente.findMany({ where: { companyId: input.companyId, versaoId: versao.id }, select: { itemId: true, qtdPlanejada: true } }) : []
  const porLote = new Map(comps.map((c) => [c.itemId, c.qtdPlanejada]))
  // ⭐ FONTE ÚNICA (01/09): esta média de razões É a régua que a tela de separar usa pra
  // prever. Enquanto vivia aqui solta, a tela tinha uma 2ª cópia dela (o "~154× a receita")
  // e a previsão podia divergir do rendimento que este mesmo método grava.
  const escalaDaLib = escalaDoConsumo(consumoPos.map((c) => ({ qtd: c.qtdConsumida, porLote: porLote.get(c.itemId) ?? 0 })))
  const escalaConsumida = escalaDaLib ?? 1

  const custoLoteReal = round2(consumoPos.reduce((s, c) => s + c.qtdConsumida * (custoMap.get(c.itemId) ?? 0), 0))
  const custoUnitarioReal = input.qtdGerada > 0 ? round2(custoLoteReal / input.qtdGerada) : null
  const rendimento = round4(input.qtdGerada / (escalaConsumida || 1))
  const validadeAte = versao?.validadeDias ? new Date(ordem.dataProducao.getTime() + versao.validadeDias * 86_400_000) : null

  const medidoAnterior = await rendimentoMedidoDaFicha(input.companyId, ordem.fichaId, db)
  const rendimentoMedioAnterior = medidoAnterior.media
  // ⭐ FONTE ÚNICA DO JULGAMENTO: é a mesma função que a tela chamou pra mostrar
  // "78% do teórico · sua média é 92%" ANTES de confirmar. Se aqui fosse outra conta, o
  // aviso da tela e o desvio gravado poderiam discordar sobre a mesma produção.
  const variacao = avaliarVariacao(input.qtdGerada, escalaConsumida, {
    teorico: versao?.loteBase ?? 1, medido: medidoAnterior.media, lotes: medidoAnterior.lotes,
  })
  const desvio = rendimentoMedioAnterior && rendimentoMedioAnterior > 0 ? round4((rendimento - rendimentoMedioAnterior) / rendimentoMedioAnterior) : null
  const foraDaFaixa = desvio != null && Math.abs(desvio) > RENDIMENTO_DESVIO

  const conclusaoId = await db.$transaction(async (tx) => {
    // PRODUCAO_CONSUMO por item (baixa da produção; NÃO mexe na prateleira — já saiu no SEPARACAO)
    for (const c of consumoPos) {
      const custo = custoMap.get(c.itemId) ?? 0
      await criarMovimento(tx, { companyId: input.companyId, itemId: c.itemId, tipo: TIPO_CONSUMO, quantidade: -c.qtdConsumida, custoUnitario: custo, custoTotal: round2(-c.qtdConsumida * custo), receiptId: input.ordemId, origem: 'MANUAL', criadoPorId: input.userId ?? null })
    }
    // se FINAL (não parcial): sobra em-produção volta pro estoque (DEVOLUCAO)
    if (!input.parcial) {
      for (const [itemId, disp] of emProd) {
        const consumido = consumoPos.find((c) => c.itemId === itemId)?.qtdConsumida ?? 0
        const sobra = round2(disp - consumido)
        if (sobra > 0.001) {
          const custo = custoMap.get(itemId) ?? 0
          await criarMovimento(tx, { companyId: input.companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: sobra, custoUnitario: custo, custoTotal: round2(sobra * custo), receiptId: input.ordemId, origem: 'MANUAL', criadoPorId: input.userId ?? null })
        }
      }
    }
    // PRODUCAO_GERACAO: o produto ENTRA no estoque com o custo REAL do lote. O custo
    // unitário vai em PRECISÃO CHEIA (não arredondado) pra qtd×custoUnit == custoLoteReal
    // exato (senão o CHECK do ledger recusa por arredondamento). O custoMedio derivado
    // arredonda na leitura (montar/round2). custoLoteReal 0 → custoUnit 0 (a definir).
    const custoUnitProduto = input.qtdGerada > 0 ? custoLoteReal / input.qtdGerada : 0
    await criarMovimento(tx, { companyId: input.companyId, itemId: ordem.itemProduzidoId, tipo: TIPO_GERACAO, quantidade: input.qtdGerada, custoUnitario: custoUnitProduto, custoTotal: custoLoteReal, receiptId: input.ordemId, origem: 'MANUAL', criadoPorId: input.userId ?? null })

    const conc = await tx.stockProducaoConclusao.create({
      data: { companyId: input.companyId, ordemId: input.ordemId, qtdGerada: input.qtdGerada, colaboradorId: input.colaboradorId ?? null, escalaConsumida, custoLoteReal, custoUnitarioReal, rendimento, validadeAte, parcial: !!input.parcial, criadoPorId: input.userId ?? null },
    })
    // ⚠️ O DESVIO É GRAVADO SEMPRE, o motivo só se o dono escreveu. Guardar só quando
    // destoa perderia a linha de base — sem os lotes normais não dá pra dizer o que é
    // "normal" depois. E o motivo fica ao lado do número: número sem porquê vira mistério.
    await tx.stockProducaoDesvio.create({
      data: {
        companyId: input.companyId, conclusaoId: conc.id, ordemId: input.ordemId,
        pctTeorico: variacao.pctTeorico ?? 0, pctMedia: variacao.pctMedia,
        lotesNaMedia: medidoAnterior.lotes,
        motivo: input.motivoDesvio?.trim() ? input.motivoDesvio.trim() : null,
        criadoPorId: input.userId ?? null,
      },
    })
    await tx.stockProductionOrder.update({ where: { id: input.ordemId }, data: { estado: input.parcial ? 'EM_PRODUCAO' : 'CONCLUIDA' } })
    return conc.id
  })

  await recomputeSaldoCache(db, input.companyId) // o cache segue os movimentos (juiz E1)
  return { conclusaoId, qtdGerada: input.qtdGerada, rendimento, escalaConsumida, custoLoteReal, custoUnitarioReal, validadeAte: validadeAte?.toISOString() ?? null, rendimentoMedioAnterior, desvio, foraDaFaixa, variacao, estado: input.parcial ? 'EM_PRODUCAO' : 'CONCLUIDA' }
}

export interface ConclusaoView {
  id: string
  qtdGerada: number
  colaboradorId: string | null
  colaboradorNome: string | null
  escalaConsumida: number
  custoLoteReal: number
  custoUnitarioReal: number | null
  rendimento: number
  validadeAte: string | null
  parcial: boolean
  criadoEm: string
}

/**
 * As conclusões de um PERÍODO (o painel), com a MESMA projeção do `listConclusoes`.
 *
 * ⚠️ EXTRAÇÃO, não conta nova: `listConclusoes` respondia só "as conclusões desta ORDEM".
 * O painel precisa de "as do período" — mesmo select, mesmo mapeamento, só o `where` muda.
 * Escrever uma segunda projeção faria a lista da ordem e a do painel divergirem no primeiro
 * campo novo.
 */
export async function conclusoesNoPeriodo(companyId: string, de: Date, ate: Date, db: PrismaClient = defaultPrisma): Promise<(ConclusaoView & { ordemId: string })[]> {
  const cs = await db.stockProducaoConclusao.findMany({
    where: { companyId, criadoEm: { gte: de, lte: ate } },
    orderBy: { criadoEm: 'desc' },
  })
  return projetarConclusoes(companyId, cs, db)
}

/** a projeção COMPARTILHADA (o corpo que era do listConclusoes) */
async function projetarConclusoes(companyId: string, cs: { id: string; ordemId: string; qtdGerada: number; colaboradorId: string | null; escalaConsumida: number; custoLoteReal: number; custoUnitarioReal: number | null; rendimento: number; validadeAte: Date | null; parcial: boolean; criadoEm: Date }[], db: PrismaClient) {
  const colabIds = [...new Set(cs.map((c) => c.colaboradorId).filter((x): x is string => !!x))]
  const colabs = colabIds.length ? await db.stockColaborador.findMany({ where: { companyId, id: { in: colabIds } }, select: { id: true, nome: true } }) : []
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))
  return cs.map((c) => ({
    id: c.id, ordemId: c.ordemId, qtdGerada: c.qtdGerada, colaboradorId: c.colaboradorId,
    colaboradorNome: c.colaboradorId ? nome.get(c.colaboradorId) ?? null : null,
    escalaConsumida: c.escalaConsumida, custoLoteReal: c.custoLoteReal, custoUnitarioReal: c.custoUnitarioReal,
    rendimento: c.rendimento, validadeAte: c.validadeAte?.toISOString() ?? null,
    parcial: c.parcial, criadoEm: c.criadoEm.toISOString(),
  }))
}

export async function listConclusoes(companyId: string, ordemId: string, db: PrismaClient = defaultPrisma): Promise<ConclusaoView[]> {
  const cs = await db.stockProducaoConclusao.findMany({ where: { companyId, ordemId }, orderBy: { criadoEm: 'asc' } })
  return projetarConclusoes(companyId, cs, db)
}
