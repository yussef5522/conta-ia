// ESTOQUE FASE 2 item 2.2 — CONCLUSÃO da ordem ("quantos saíram?"). O fluxo do dono,
// travado: confirma o que foi REALMENTE consumido (pré = em-produção; sobra volta) → diz
// quantos saíram → PRODUCAO_CONSUMO (baixa da produção) + PRODUCAO_GERACAO (produto entra
// com CUSTO REAL do lote) → rendimento MEDIDO contra o consumo real (nunca a escala) →
// compara com a média (±15%) → registra. Parcial: várias conclusões na mesma ordem. Só stock_.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { custoMedioPorItem } from '../saldo'
import { separadoPorItem, TIPO_CONSUMO, TIPO_DEVOLUCAO, TIPO_GERACAO, OrdemError } from './ordens'

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
  estado: string
}

/** Média móvel das últimas 5 conclusões da MESMA ficha (rendimento por receita base). */
export async function rendimentoMedioDaFicha(companyId: string, fichaId: string, db: PrismaClient = defaultPrisma, exceptConclusaoId?: string): Promise<number | null> {
  const ordens = await db.stockProductionOrder.findMany({ where: { companyId, fichaId }, select: { id: true } })
  const ids = ordens.map((o) => o.id)
  if (!ids.length) return null
  const cs = await db.stockProducaoConclusao.findMany({ where: { companyId, ordemId: { in: ids }, ...(exceptConclusaoId ? { id: { not: exceptConclusaoId } } : {}) }, orderBy: { criadoEm: 'desc' }, take: 5, select: { rendimento: true } })
  if (!cs.length) return null
  return round4(cs.reduce((s, c) => s + c.rendimento, 0) / cs.length)
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
  const razoes = consumoPos.map((c) => (porLote.get(c.itemId) ? c.qtdConsumida / (porLote.get(c.itemId) as number) : null)).filter((r): r is number => r != null && r > 0)
  const escalaConsumida = razoes.length ? round4(razoes.reduce((a, b) => a + b, 0) / razoes.length) : 1

  const custoLoteReal = round2(consumoPos.reduce((s, c) => s + c.qtdConsumida * (custoMap.get(c.itemId) ?? 0), 0))
  const custoUnitarioReal = input.qtdGerada > 0 ? round2(custoLoteReal / input.qtdGerada) : null
  const rendimento = round4(input.qtdGerada / (escalaConsumida || 1))
  const validadeAte = versao?.validadeDias ? new Date(ordem.dataProducao.getTime() + versao.validadeDias * 86_400_000) : null

  const rendimentoMedioAnterior = await rendimentoMedioDaFicha(input.companyId, ordem.fichaId, db)
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
    await tx.stockProductionOrder.update({ where: { id: input.ordemId }, data: { estado: input.parcial ? 'EM_PRODUCAO' : 'CONCLUIDA' } })
    return conc.id
  })

  return { conclusaoId, qtdGerada: input.qtdGerada, rendimento, escalaConsumida, custoLoteReal, custoUnitarioReal, validadeAte: validadeAte?.toISOString() ?? null, rendimentoMedioAnterior, desvio, foraDaFaixa, estado: input.parcial ? 'EM_PRODUCAO' : 'CONCLUIDA' }
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

export async function listConclusoes(companyId: string, ordemId: string, db: PrismaClient = defaultPrisma): Promise<ConclusaoView[]> {
  const cs = await db.stockProducaoConclusao.findMany({ where: { companyId, ordemId }, orderBy: { criadoEm: 'asc' } })
  const colabIds = [...new Set(cs.map((c) => c.colaboradorId).filter((x): x is string => !!x))]
  const colabs = colabIds.length ? await db.stockColaborador.findMany({ where: { companyId, id: { in: colabIds } }, select: { id: true, nome: true } }) : []
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))
  return cs.map((c) => ({
    id: c.id, qtdGerada: c.qtdGerada, colaboradorId: c.colaboradorId, colaboradorNome: c.colaboradorId ? nome.get(c.colaboradorId) ?? null : null,
    escalaConsumida: c.escalaConsumida, custoLoteReal: c.custoLoteReal, custoUnitarioReal: c.custoUnitarioReal, rendimento: c.rendimento,
    validadeAte: c.validadeAte?.toISOString() ?? null, parcial: c.parcial, criadoEm: c.criadoEm.toISOString(),
  }))
}
