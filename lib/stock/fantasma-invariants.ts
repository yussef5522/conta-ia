/**
 * ⛔⛔⛔ A REGRA DE OURO DO MRP VIRA GUARD — item 1.b do sprint do motor (02/10/2026).
 *
 * **A ordem do dono:** *"item ATRAVESSA (phantom) não pode ter saldo/ordem/contagem — phantom
 * com movimento de estoque = vermelho. E item que É estocado (tem ordem, contagem, saldo)
 * JAMAIS marcado ATRAVESSA."*
 *
 * ⭐ É a régua que o `Component × Item` do Crunchtime e o *phantom BOM* da manufatura
 * carregam: o phantom existe só pra **agrupar** (dar nome a uma linha de cardápio). Se ele
 * ganhar estoque próprio, aquele saldo entra num **LIMBO** — a explosão atravessa o item, então
 * **nenhuma venda e nenhuma produção vão baixá-lo nunca**. Ele fica no total do estoque pra
 * sempre, somando dinheiro que não existe.
 *
 * ⚠️⚠️ **E NÃO É HIPÓTESE: foi o que custou 9 ajustes fantasma em 09/09.** Montar o cardápio
 * de bebidas criou um invólucro ao lado de cada garrafa que a NF já alimentava
 * (`COCA COLA 2L` × `COCA-COLA  2L`), a contagem oferecia os DOIS, e as garrafas foram contadas
 * na linha errada. A cirurgia daquele dia estornou os ajustes — **mas curou 12 de 13**.
 *
 * ═══ ⚠️ POR QUE O INVARIANTE OLHA O SALDO LÍQUIDO, NÃO "TEM MOVIMENTO?" ═══
 *
 * Medido em prod antes de escrever: **25 movimentos** em itens phantom — e são **pares
 * `AJUSTE_CONTAGEM` + `ESTORNO`**, a própria cirurgia de 09/09, com Σ líquida ZERO. Um guard
 * que perguntasse *"existe movimento?"* nasceria com **13 alarmes falsos de um problema já
 * resolvido** — e alarme falso no dia 1 é como um alarme morre (os 111 de vendas, 26/08).
 *
 * ⭐ O que importa é o **SALDO**: ele é o dinheiro preso. E o saldo vem de `saldosDaEmpresa`, a
 * porta da casa — nunca de um `groupBy` próprio, senão o invariante e a Posição discordariam
 * sobre o mesmo item.
 */

import type { PrismaClient } from '@prisma/client'
import type { StockInvariantFail } from './stock-invariants'
import { comoConsome } from './explodir-receita'
import { saldosDaEmpresa } from './saldo'

export async function checkFantasmaInvariants(db: PrismaClient): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []

  const fichas = await db.stockFicha.findMany({
    select: { id: true, companyId: true, tipoProduto: true, itemProduzidoId: true },
  })
  if (!fichas.length) return fails

  const nomes = new Map(
    (await db.stockItem.findMany({ select: { id: true, nome: true } })).map((i) => [i.id, i.nome]),
  )

  /** itens que a explosão ATRAVESSA — invólucro de cardápio, sem estoque próprio */
  const phantomPorEmpresa = new Map<string, Set<string>>()
  for (const f of fichas) {
    if (comoConsome(f.tipoProduto) !== 'ATRAVESSA') continue
    const s = phantomPorEmpresa.get(f.companyId) ?? new Set<string>()
    s.add(f.itemProduzidoId)
    phantomPorEmpresa.set(f.companyId, s)
  }

  // ═══ M3 (erro) — phantom com SALDO ≠ 0: dinheiro no limbo ═══
  for (const [companyId, phantom] of phantomPorEmpresa) {
    const saldos = await saldosDaEmpresa(db, companyId)
    for (const s of saldos) {
      if (!phantom.has(s.itemId) || Math.abs(s.saldo) <= 0.001) continue
      fails.push({
        invariante: 'M3',
        companyId,
        detalhe:
          `«${nomes.get(s.itemId) ?? s.itemId}» é invólucro de cardápio (a explosão ATRAVESSA ele) ` +
          `e está com saldo ${s.saldo} / R$ ${s.valor.toFixed(2)} — esse estoque está num LIMBO: ` +
          `nenhuma venda e nenhuma produção vão baixá-lo. Provável contagem na linha errada ` +
          `(a cicatriz de 09/09). O conserto é estornar o ajuste e contar na GARRAFA, nunca no invólucro.`,
      })
    }
  }

  /**
   * ═══ M4 (erro) — A DIREÇÃO INVERSA DA REGRA DE OURO ═══
   *
   * ⭐ Item que **É** estocado (a cozinha produz por ORDEM) marcado como ATRAVESSA. Se isso
   * acontecer, a explosão passa a descer nos INSUMOS dele — e os insumos já saíram na ordem
   * de produção: **baixa DUPLA**, silenciosa, em cada venda.
   *
   * ⚠️ Medido em prod: **0 casos hoje** (as 452 ordens são todas de ficha `INTERMEDIARIO`).
   * O invariante nasce verde de propósito — ele existe pro dia em que alguém trocar o tipo de
   * uma ficha que a cozinha produz, que é um clique na tela.
   */
  const ordens = await db.stockProductionOrder.groupBy({
    by: ['fichaId'],
    _count: true,
  })
  const fichaPorId = new Map(fichas.map((f) => [f.id, f]))
  for (const o of ordens) {
    const f = fichaPorId.get(o.fichaId)
    if (!f || comoConsome(f.tipoProduto) !== 'ATRAVESSA') continue
    fails.push({
      invariante: 'M4',
      companyId: f.companyId,
      detalhe:
        `a ficha de «${nomes.get(f.itemProduzidoId) ?? f.itemProduzidoId}» tem ${o._count} ordem(ns) de ` +
        `produção — ou seja o item É ESTOCADO — mas está tipada como ${f.tipoProduto}, que a ` +
        `explosão ATRAVESSA. A venda passaria a baixar os INSUMOS dele, que já saíram na ordem: ` +
        `baixa DUPLA. Tipe a ficha como INTERMEDIARIO.`,
    })
  }

  return fails
}
