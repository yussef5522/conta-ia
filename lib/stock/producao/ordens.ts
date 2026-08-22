// ESTOQUE FASE 2 item 2.1 — ORDENS de produção + SEPARAÇÃO. A separação é PRÉ-PREENCHIDA
// da ficha (componentes × escala) e o dono ajusta o que REALMENTE tirou da câmara → gera
// SEPARACAO_SAIDA no ledger (insumo sai do estoque geral e entra no armazém virtual
// "em-produção"). Sobra volta com DEVOLUCAO_PRODUCAO. O armazém em-produção é DERIVADO dos
// movimentos (receiptId = id da ordem), nunca uma tabela de saldo à parte. Só stock_.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { saldoItem, custoMedioPorItem } from '../saldo'

type Db = PrismaClient | Prisma.TransactionClient

export class OrdemError extends Error {}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export const TIPO_SEPARACAO = 'SEPARACAO_SAIDA'
export const TIPO_DEVOLUCAO = 'DEVOLUCAO_PRODUCAO'

// ---- criar ----

export interface CriarOrdemInput {
  companyId: string
  fichaId: string
  escalaReceitas: number
  dataProducao: Date
  setorId?: string | null
  colaboradorId?: string | null
  origem?: 'MANUAL' | 'SUGESTAO'
  observacao?: string | null
  userId?: string
}

export async function criarOrdem(input: CriarOrdemInput, db: Db = defaultPrisma): Promise<{ ordemId: string }> {
  if (!(input.escalaReceitas > 0)) throw new OrdemError('A escala (múltiplo do lote base) tem que ser maior que zero.')
  const ficha = await db.stockFicha.findFirst({ where: { id: input.fichaId, companyId: input.companyId }, select: { id: true, itemProduzidoId: true, versaoAtual: true, ativo: true } })
  if (!ficha) throw new OrdemError('Ficha não encontrada.')
  if (!ficha.ativo) throw new OrdemError('Essa ficha está inativa.')
  const ordem = await db.stockProductionOrder.create({
    data: {
      companyId: input.companyId, fichaId: ficha.id, versaoFicha: ficha.versaoAtual, itemProduzidoId: ficha.itemProduzidoId,
      setorId: input.setorId ?? null, colaboradorId: input.colaboradorId ?? null, dataProducao: input.dataProducao,
      escalaReceitas: input.escalaReceitas, origem: input.origem ?? 'MANUAL', observacao: input.observacao ?? null,
      estado: 'PLANEJADA', criadoPorId: input.userId ?? null,
    },
  })
  return { ordemId: ordem.id }
}

// ---- separação pré-preenchida (explode a ficha × escala) ----

export interface SeparacaoLinha {
  itemId: string
  nome: string
  unidade: string
  unidadeControle: string
  qtdPlanejada: number // ficha × escala
  qtdSeparada: number // já separado (Σ SEPARACAO_SAIDA − DEVOLUCAO), 0 antes de separar
  saldoDisponivel: number // saldo atual no estoque geral
  custoMedio: number | null
}

async function componentesDaVersao(companyId: string, fichaId: string, versao: number, db: Db) {
  const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId, versao }, select: { id: true } })
  if (!v) return []
  return db.stockFichaComponente.findMany({ where: { companyId, versaoId: v.id }, orderBy: { posicao: 'asc' } })
}

/** em-produção por item DESTA ordem = Σ|SEPARACAO_SAIDA| − Σ DEVOLUCAO (receiptId=ordemId). */
async function separadoPorItem(companyId: string, ordemId: string, db: Db): Promise<Map<string, number>> {
  const movs = await db.stockMovement.findMany({ where: { companyId, receiptId: ordemId, tipo: { in: [TIPO_SEPARACAO, TIPO_DEVOLUCAO] } }, select: { itemId: true, tipo: true, quantidade: true } })
  const m = new Map<string, number>()
  for (const mv of movs) {
    // SEPARACAO_SAIDA tem quantidade NEGATIVA (saiu do estoque); DEVOLUCAO positiva (voltou).
    // em-produção = Σ|SEPARACAO| − Σ DEVOLUCAO = Σ(−quantidade) sobre os dois tipos.
    m.set(mv.itemId, round2((m.get(mv.itemId) ?? 0) - mv.quantidade))
  }
  return m
}

export async function explodirSeparacao(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<{ ordem: OrdemView; linhas: SeparacaoLinha[] }> {
  const ordem = await getOrdem(companyId, ordemId, db)
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  const comps = await componentesDaVersao(companyId, ordem.fichaId, ordem.versaoFicha, db)
  const [custoMap, separado] = await Promise.all([custoMedioPorItem(db, companyId), separadoPorItem(companyId, ordemId, db)])
  const itemIds = comps.map((c) => c.itemId)
  const its = itemIds.length ? await db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, unidadeControle: true } }) : []
  const meta = new Map(its.map((i) => [i.id, i]))

  const linhas: SeparacaoLinha[] = []
  for (const c of comps) {
    const saldo = await saldoItem(db, companyId, c.itemId)
    linhas.push({
      itemId: c.itemId,
      nome: meta.get(c.itemId)?.nome ?? '(item removido)',
      unidade: c.unidade,
      unidadeControle: meta.get(c.itemId)?.unidadeControle ?? '—',
      qtdPlanejada: round2(c.qtdPlanejada * ordem.escalaReceitas),
      qtdSeparada: round2(separado.get(c.itemId) ?? 0),
      saldoDisponivel: saldo.saldo,
      custoMedio: custoMap.get(c.itemId) ?? null,
    })
  }
  return { ordem, linhas }
}

// ---- confirmar separação (gera SEPARACAO_SAIDA) ----

export interface SepararInput { itemId: string; qtdSeparada: number }

export async function confirmarSeparacao(companyId: string, ordemId: string, itens: SepararInput[], db: PrismaClient = defaultPrisma, userId?: string): Promise<{ movimentos: number }> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'PLANEJADA') throw new OrdemError('Essa ordem já foi separada (ou está em outro estado).')
  const positivos = itens.filter((i) => i.qtdSeparada > 0)
  if (!positivos.length) throw new OrdemError('Separe ao menos um item (quantidade maior que zero).')

  const custoMap = await custoMedioPorItem(db, companyId)
  await db.$transaction(async (tx) => {
    for (const it of positivos) {
      const custo = custoMap.get(it.itemId) ?? 0
      // SEPARACAO_SAIDA: sai do estoque geral (quantidade NEGATIVA)
      await criarMovimento(tx, { companyId, itemId: it.itemId, tipo: TIPO_SEPARACAO, quantidade: -it.qtdSeparada, custoUnitario: custo, custoTotal: round2(-it.qtdSeparada * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
    }
    await tx.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'SEPARADA' } })
  })
  return { movimentos: positivos.length }
}

export async function iniciarProducao(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<void> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA') throw new OrdemError('Só entra em produção depois de separar.')
  await db.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'EM_PRODUCAO' } })
}

/** Devolve sobra pro estoque geral (DEVOLUCAO_PRODUCAO). */
export async function devolverInsumo(companyId: string, ordemId: string, itemId: string, qtd: number, db: PrismaClient = defaultPrisma, userId?: string): Promise<void> {
  if (!(qtd > 0)) throw new OrdemError('Quantidade a devolver tem que ser maior que zero.')
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA' && ordem.estado !== 'EM_PRODUCAO') throw new OrdemError('Só dá pra devolver de uma ordem separada ou em produção.')
  const separado = await separadoPorItem(companyId, ordemId, db)
  const emProd = separado.get(itemId) ?? 0
  if (qtd > emProd + 0.001) throw new OrdemError(`Não dá pra devolver ${qtd} — só ${round2(emProd)} desse item está em produção.`)
  const custo = (await custoMedioPorItem(db, companyId)).get(itemId) ?? 0
  await criarMovimento(db, { companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: qtd, custoUnitario: custo, custoTotal: round2(qtd * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
}

/** Cancela: devolve TUDO que está em produção pro estoque geral e marca CANCELADA. */
export async function cancelarOrdem(companyId: string, ordemId: string, db: PrismaClient = defaultPrisma, userId?: string): Promise<void> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado === 'CONCLUIDA' || ordem.estado === 'CANCELADA') throw new OrdemError('Essa ordem já foi encerrada.')
  const separado = await separadoPorItem(companyId, ordemId, db)
  const custoMap = await custoMedioPorItem(db, companyId)
  await db.$transaction(async (tx) => {
    for (const [itemId, emProd] of separado) {
      if (emProd > 0.001) {
        const custo = custoMap.get(itemId) ?? 0
        await criarMovimento(tx, { companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: round2(emProd), custoUnitario: custo, custoTotal: round2(emProd * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
      }
    }
    await tx.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'CANCELADA' } })
  })
}

// ---- leitura ----

export interface OrdemView {
  id: string
  fichaId: string
  versaoFicha: number
  itemProduzidoId: string
  nomeProduzido: string
  unidadeProduzido: string
  setorId: string | null
  setorNome: string | null
  dataProducao: string
  escalaReceitas: number
  estado: string
  origem: string
  observacao: string | null
}

export async function getOrdem(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<OrdemView | null> {
  const o = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId } })
  if (!o) return null
  const [prod, setor] = await Promise.all([
    db.stockItem.findFirst({ where: { companyId, id: o.itemProduzidoId }, select: { nome: true, unidadeControle: true } }),
    o.setorId ? db.stockSetor.findFirst({ where: { companyId, id: o.setorId }, select: { nome: true } }) : Promise.resolve(null),
  ])
  return {
    id: o.id, fichaId: o.fichaId, versaoFicha: o.versaoFicha, itemProduzidoId: o.itemProduzidoId,
    nomeProduzido: prod?.nome ?? '(item removido)', unidadeProduzido: prod?.unidadeControle ?? '—',
    setorId: o.setorId, setorNome: setor?.nome ?? null, dataProducao: o.dataProducao.toISOString(),
    escalaReceitas: o.escalaReceitas, estado: o.estado, origem: o.origem, observacao: o.observacao,
  }
}

export async function listOrdens(companyId: string, db: Db = defaultPrisma): Promise<OrdemView[]> {
  const os = await db.stockProductionOrder.findMany({ where: { companyId }, orderBy: [{ dataProducao: 'desc' }, { criadoEm: 'desc' }], take: 200 })
  const out: OrdemView[] = []
  for (const o of os) {
    const v = await getOrdem(companyId, o.id, db)
    if (v) out.push(v)
  }
  return out
}
