// ⭐⭐⭐ ITEM ENCERRADO — "pra operação, ele NÃO EXISTE mais" (19/09/2026).
//
// **A ordem do dono, sobre a CUBA MAIONESE:** *"sai DE TUDO que é vivo (…) nenhum lugar
// oferece ela pra nada. O passado fica legível: as ordens e movimentos antigos continuam
// mostrando o nome dela — apagar isso reescreveria custos de poções já vendidas."*
//
// ⛔⛔ **POR QUE NÃO É SÓ `ativo = false`.** Desativado é *"parei de usar, posso voltar"* —
// e o Catálogo mostra os inativos num toggle, de propósito. **Encerrado é decisão final**,
// e a diferença precisa estar escrita: sem isso, daqui a três meses ninguém sabe se o item
// sumiu por engano, por faxina ou porque o dono aposentou a receita.
//
// ⭐ É a mesma distinção que esta casa já fez duas vezes: **mesclado ≠ arquivado** (30/08 —
// *"virou parte de outro"* contra *"saiu de uso"*) e **`ENCERRADA_SEM_FINALIZAR` ≠ FEITA**
// (07/09). O estado tem nome próprio porque significa coisa diferente.
//
// ⛔ **E O PASSADO NÃO SE REESCREVE** (a régua desde 16/09). O ledger é imutável e os
// movimentos antigos continuam citando o nome: as poções produzidas com esta cuba já foram
// vendidas, e mexer no custo delas reescreveria margem de venda que já aconteceu. O que o
// encerramento acrescenta ao histórico é o **SELO** — *"item encerrado em DD/MM"* — pra
// quem ler saber que aquele nome não volta.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export class EncerrarItemError extends Error {}

export interface EncerramentoDeItem {
  companyId: string
  itemId: string
  motivo: string
  userId?: string | null
}

/**
 * ⭐⭐ ENCERRA — some de tudo que é vivo, o passado fica.
 *
 * ⛔ **RECUSA com saldo diferente de zero**, e isso é o coração do gesto: encerrar um item
 * com estoque dentro **esconderia o dinheiro** em vez de resolvê-lo. O valor não evapora
 * por sumir da tela — ele continuaria no ledger, invisível, contaminando o total do
 * estoque e o Real vs Teórico. *A saída é contar (ou dar saída) primeiro; o encerramento é
 * o último passo, nunca o atalho.*
 */
export async function encerrarItem(e: EncerramentoDeItem, db: Db = defaultPrisma) {
  if (!e.motivo?.trim()) throw new EncerrarItemError('Diga por que ele está sendo encerrado — sem o motivo, em três meses ninguém sabe se foi engano ou decisão.')
  const item = await db.stockItem.findFirst({ where: { id: e.itemId, companyId: e.companyId }, select: { id: true, nome: true, unidadeControle: true } })
  if (!item) throw new EncerrarItemError('Item não encontrado nesta empresa.')

  const agg = await db.stockMovement.aggregate({
    where: { companyId: e.companyId, itemId: e.itemId, tipo: { not: 'PRODUCAO_CONSUMO' } },
    _sum: { quantidade: true, custoTotal: true },
  })
  const saldo = Math.round(((agg._sum.quantidade ?? 0) + 1e-9) * 1000) / 1000
  const valor = Math.round(((agg._sum.custoTotal ?? 0) + 1e-9) * 100) / 100
  if (Math.abs(saldo) > 0.001 || Math.abs(valor) > 0.01) {
    throw new EncerrarItemError(
      `«${item.nome}» ainda tem ${saldo} ${item.unidadeControle} valendo R$ ${valor.toFixed(2)} no estoque. ` +
      'Encerrar agora esconderia esse dinheiro em vez de resolver — conte o item (ou dê saída) primeiro, ' +
      'e então ele pode ser encerrado.',
    )
  }

  // ⚠️ o item deixa de existir pra OPERAÇÃO, e a ficha dele vai junto: ficha ativa de um
  // item encerrado continuaria oferecendo o gesto "produzir" num produto aposentado.
  await db.stockItem.update({ where: { id: item.id }, data: { ativo: false } })
  await db.stockFicha.updateMany({ where: { companyId: e.companyId, itemProduzidoId: item.id }, data: { ativo: false } })

  return db.stockItemEncerrado.upsert({
    where: { itemId: item.id },
    create: { companyId: e.companyId, itemId: item.id, motivo: e.motivo.trim(), criadoPorId: e.userId ?? null },
    update: {},
  })
}

export interface SeloDeEncerrado { itemId: string; encerradoEm: Date; motivo: string }

/**
 * ⭐ O SELO pro histórico — *"item encerrado em DD/MM"*.
 *
 * ⚠️ É uma consulta em LOTE de propósito: toda tela de histórico (extrato, ficha do item,
 * relatório de produção) lista muitos itens de uma vez, e uma consulta por linha viraria
 * N+1 numa tela que já é pesada.
 */
export async function selosDeEncerrado(companyId: string, itemIds: string[], db: Db = defaultPrisma): Promise<Map<string, SeloDeEncerrado>> {
  if (!itemIds.length) return new Map()
  const rows = await db.stockItemEncerrado.findMany({
    where: { companyId, itemId: { in: itemIds } },
    select: { itemId: true, criadoEm: true, motivo: true },
  })
  return new Map(rows.map((r) => [r.itemId, { itemId: r.itemId, encerradoEm: r.criadoEm, motivo: r.motivo }]))
}

/** ⭐ a frase que o histórico mostra — num lugar só, pra as telas não divergirem */
export function fraseDoSelo(s: SeloDeEncerrado): string {
  const d = s.encerradoEm.toISOString().slice(0, 10).split('-').reverse().join('/')
  return `item encerrado em ${d} — ${s.motivo}`
}
