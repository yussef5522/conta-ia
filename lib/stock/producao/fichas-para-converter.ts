/**
 * ⭐ A LISTA DE PENDENTES DO ASSISTENTE DE CONVERSÃO — *"quantas fichas ainda faltam?"* (04/10/2026).
 *
 * **Pedido do dono:** *"Lista de pendentes com progresso (37 → 0) pra eu varrer numa sentada."*
 *
 * ⭐ Quem decide SE a ficha está pendente é `loteEhComparavel` — a MESMA régua do juiz **M5**.
 * Reescrever o `===` aqui faria a lista oferecer ficha que o juiz considera boa (ou calar sobre
 * uma que ele acusa), e o dono varreria a lista inteira com o alarme ainda aceso.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { comoConsome } from '../explodir-receita'
import { rendimentoMedidoDaFicha } from './conclusao'
import { loteEhComparavel } from './lote-comparavel'

/** ⚠️ aceita client TRANSACIONAL (04/10): esta função é SÓ LEITURA (conferido — zero
 *  `$transaction`/`$executeRaw` aqui dentro), e o produtor de avisos a chama de dentro do
 *  preview com rollback. Sem isso o preview leria de fora da transação. */
type Db = PrismaClient | Prisma.TransactionClient

export interface FichaParaConverter {
  fichaId: string
  versaoAtual: number
  itemProduzidoId: string
  nomeProduto: string
  /** a unidade em que o produto se CONTA — o destino da conversão */
  unidadeProduto: string
  loteBase: number
  unidadeLoteBase: string
  componentes: { itemId: string; nome: string; unidade: string; qtdPlanejada: number }[]
  /** a maior dose — é com ela que o peso do nome se compara */
  dosePrincipal: number | null
  /** mediana do rendimento medido (quantas UN saíram de 1 receita); `null` sem histórico */
  medido: number | null
  lotes: number
}

export interface ProgressoDaConversao {
  /** fichas de PRODUÇÃO ativas (as que a cozinha faz por ordem) */
  total: number
  /** já declaram o lote na unidade do produto */
  coerentes: number
  pendentes: FichaParaConverter[]
}

/**
 * As fichas que ainda declaram o lote numa unidade que não é a do produto.
 *
 * ⚠️ **Só ficha que a cozinha PRODUZ por ordem** (`comoConsome === 'ESTOCADO'`): no invólucro
 * de cardápio (PRODUTO_FINAL/SABOR) não existe "lote" — ele monta na venda. É o MESMO filtro
 * do M5, pela MESMA função.
 *
 * ⭐ Devolve o PROGRESSO junto porque *"37 pendentes"* sozinho não diz se é quase tudo ou quase
 * nada — e o dono pediu pra varrer numa sentada sabendo quanto falta.
 */
export async function fichasParaConverter(companyId: string, db: Db = defaultPrisma): Promise<ProgressoDaConversao> {
  const fichas = await db.stockFicha.findMany({
    where: { companyId, ativo: true },
    select: { id: true, tipoProduto: true, itemProduzidoId: true, versaoAtual: true },
  })
  const deProducao = fichas.filter((f) => comoConsome(f.tipoProduto) === 'ESTOCADO')
  if (!deProducao.length) return { total: 0, coerentes: 0, pendentes: [] }

  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: [...new Set(deProducao.map((f) => f.itemProduzidoId))] } },
    select: { id: true, nome: true, unidadeControle: true },
  })
  const prod = new Map(itens.map((i) => [i.id, i]))

  const pendentes: FichaParaConverter[] = []
  let coerentes = 0
  for (const f of deProducao) {
    const it = prod.get(f.itemProduzidoId)
    const v = await db.stockFichaVersao.findFirst({
      where: { companyId, fichaId: f.id, versao: f.versaoAtual },
      select: { id: true, loteBase: true, unidadeLoteBase: true },
    })
    if (!it || !v) continue
    if (loteEhComparavel(v.unidadeLoteBase, it.unidadeControle)) { coerentes++; continue }

    const comps = await db.stockFichaComponente.findMany({
      where: { companyId, versaoId: v.id }, orderBy: { posicao: 'asc' },
      select: { itemId: true, qtdPlanejada: true, unidade: true },
    })
    const nomesComp = await db.stockItem.findMany({
      where: { companyId, id: { in: comps.map((c) => c.itemId) } }, select: { id: true, nome: true },
    })
    const nomeDe = new Map(nomesComp.map((i) => [i.id, i.nome]))
    const medido = await rendimentoMedidoDaFicha(companyId, f.id, db)

    pendentes.push({
      fichaId: f.id,
      versaoAtual: f.versaoAtual,
      itemProduzidoId: f.itemProduzidoId,
      nomeProduto: it.nome,
      unidadeProduto: it.unidadeControle,
      loteBase: v.loteBase,
      unidadeLoteBase: v.unidadeLoteBase,
      componentes: comps.map((c) => ({ itemId: c.itemId, nome: nomeDe.get(c.itemId) ?? '(item removido)', unidade: c.unidade, qtdPlanejada: c.qtdPlanejada })),
      dosePrincipal: comps.length ? Math.max(...comps.map((c) => c.qtdPlanejada)) : null,
      medido: medido.media,
      lotes: medido.lotes,
    })
  }
  // ⭐ quem mais produz primeiro: é quem mais paga o rótulo torto todos os dias
  pendentes.sort((a, b) => b.lotes - a.lotes || a.nomeProduto.localeCompare(b.nomeProduto))
  return { total: deProducao.length, coerentes, pendentes }
}
