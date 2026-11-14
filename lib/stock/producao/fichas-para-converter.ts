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
import { rendimentoMedidoDeFichas } from './conclusao'
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

  /**
   * ⚡ (13/11, o N+1 do raio-X) ERA 4 CONSULTAS POR FICHA (versão, componentes, nomes, rendimento) — viram
   * 4 consultas FIXAS em lote. A resposta é a MESMA: mesma versão (a `versaoAtual`), mesma ordem de
   * componentes (`posicao`), mesmo rendimento (`rendimentoMedidoDeFichas` é a porta em lote do mesmo cálculo).
   */
  const versoes = await db.stockFichaVersao.findMany({
    where: { companyId, fichaId: { in: deProducao.map((f) => f.id) } },
    select: { id: true, fichaId: true, versao: true, loteBase: true, unidadeLoteBase: true },
  })
  const versaoAtualDe = new Map(deProducao.map((f) => [f.id, f.versaoAtual]))
  const versaoDe = new Map(versoes.filter((v) => v.versao === versaoAtualDe.get(v.fichaId)).map((v) => [v.fichaId, v]))

  const incoerentes = deProducao.filter((f) => {
    const it = prod.get(f.itemProduzidoId), v = versaoDe.get(f.id)
    return it && v && !loteEhComparavel(v.unidadeLoteBase, it.unidadeControle)
  })
  const coerentes = deProducao.filter((f) => {
    const it = prod.get(f.itemProduzidoId), v = versaoDe.get(f.id)
    return it && v && loteEhComparavel(v.unidadeLoteBase, it.unidadeControle)
  }).length

  const versaoIds = incoerentes.map((f) => versaoDe.get(f.id)!.id)
  const compsTodos = versaoIds.length
    ? await db.stockFichaComponente.findMany({
      where: { companyId, versaoId: { in: versaoIds } }, orderBy: { posicao: 'asc' },
      select: { versaoId: true, itemId: true, qtdPlanejada: true, unidade: true },
    })
    : []
  const [nomesComp, medidos] = await Promise.all([
    compsTodos.length
      ? db.stockItem.findMany({ where: { companyId, id: { in: [...new Set(compsTodos.map((c) => c.itemId))] } }, select: { id: true, nome: true } })
      : Promise.resolve([] as { id: string; nome: string }[]),
    rendimentoMedidoDeFichas(companyId, incoerentes.map((f) => f.id), db),
  ])
  const nomeDe = new Map(nomesComp.map((i) => [i.id, i.nome]))
  const compsDe = new Map<string, typeof compsTodos>()
  for (const c of compsTodos) compsDe.set(c.versaoId, [...(compsDe.get(c.versaoId) ?? []), c])

  const pendentes: FichaParaConverter[] = []
  for (const f of incoerentes) {
    const it = prod.get(f.itemProduzidoId)!, v = versaoDe.get(f.id)!
    const comps = compsDe.get(v.id) ?? []
    const medido = medidos.get(f.id) ?? { media: null, lotes: 0 }
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
  pendentes.sort((a, b) => b.lotes - a.lotes || a.nomeProduto.localeCompare(b.nomeProduto))
  return { total: deProducao.length, coerentes, pendentes }
}
