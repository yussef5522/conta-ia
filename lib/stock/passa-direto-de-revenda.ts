// ⭐⭐ "COCA COLA 2L APARECE 2× NA BUSCA DA RECEITA" (09/09/2026) — e as duas eram itens reais.
//
// **MEDIDO ANTES DE MEXER, e a primeira hipótese caiu:** a busca **não** mistura ficha com
// item — ela lista **só `stock_item`** (conferido no `GET /estoque/itens`). O 2× são **dois
// itens de estoque de verdade**:
//
//   [cmt6ugy5t…] "COCA-COLA  2L"  · REVENDA        · via CONFERENCIA · 560 un de NF
//   [cmts4gqv9…] "COCA COLA 2L"   · PRODUTO_FINAL  · via MANUAL      · criado pela FICHA
//
// ⛔ **O SEGUNDO NASCE DA PRÓPRIA FICHA.** Toda ficha cria um item-invólucro pro produto que
// ela produz. Numa ficha de revenda esse invólucro é **a linha do cardápio** — e o conteúdo
// dela é *a garrafa ×1*. Oferecer o invólucro como ingrediente é oferecer a garrafa **com um
// degrau a mais no meio**, e é literalmente a linha duplicada que o dono viu.
//
// ⭐ A REGRA, estreita de propósito: só sai da busca o **passa-direto** — ficha com
// **exatamente 1 componente, quantidade 1, e o componente é um item REVENDA**. O "XIS
// COMPLETO" (vários componentes) e o "COMBO" (que leva o Xis) **continuam** na busca: lá o
// invólucro carrega conteúdo de verdade, e o Combo precisa dele.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { TIPO_PRODUTO_FINAL } from './tipos-ficha'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⭐ Os itens-invólucro que são só "a garrafa ×1".
 *
 * ⚠️ Recebe a lista de itens já lida: quem chama é a busca, que já tem os candidatos em mão.
 * Fazer a query aqui dobraria a leitura do catálogo por tecla digitada.
 */
export async function involucrosPassaDireto(
  companyId: string,
  itens: { id: string; categoria: string }[],
  db: Db = defaultPrisma,
): Promise<Set<string>> {
  const alvos = itens.filter((i) => i.categoria === TIPO_PRODUTO_FINAL).map((i) => i.id)
  if (!alvos.length) return new Set()

  const fichas = await db.stockFicha.findMany({
    where: { companyId, itemProduzidoId: { in: alvos }, ativo: true },
    select: { id: true, itemProduzidoId: true, versaoAtual: true },
  })
  if (!fichas.length) return new Set()

  const versoes = await db.stockFichaVersao.findMany({
    where: { fichaId: { in: fichas.map((f) => f.id) } },
    select: { id: true, fichaId: true, versao: true },
  })
  const versaoAtualDaFicha = new Map(
    fichas
      .map((f) => [f.id, versoes.find((v) => v.fichaId === f.id && v.versao === f.versaoAtual)?.id] as const)
      .filter((x): x is readonly [string, string] => !!x[1]),
  )

  const comps = await db.stockFichaComponente.findMany({
    where: { versaoId: { in: [...versaoAtualDaFicha.values()] } },
    select: { versaoId: true, itemId: true, qtdPlanejada: true },
  })
  const porVersao = new Map<string, { itemId: string; qtdPlanejada: number }[]>()
  for (const c of comps) porVersao.set(c.versaoId, [...(porVersao.get(c.versaoId) ?? []), c])

  // só precisa saber a categoria dos componentes candidatos
  const idsComp = [...new Set(comps.map((c) => c.itemId))]
  const cats = new Map(
    (await db.stockItem.findMany({ where: { companyId, id: { in: idsComp } }, select: { id: true, categoria: true } }))
      .map((i) => [i.id, i.categoria]),
  )

  const out = new Set<string>()
  for (const f of fichas) {
    const vId = versaoAtualDaFicha.get(f.id)
    if (!vId) continue
    const c = porVersao.get(vId) ?? []
    // ⛔ EXATAMENTE 1 componente, ×1, e ele é REVENDA. Qualquer outra forma FICA na busca —
    // afrouxar aqui esconderia um produto de verdade da receita, que é o erro caro.
    if (c.length === 1 && c[0].qtdPlanejada === 1 && cats.get(c[0].itemId) === 'REVENDA') {
      out.add(f.itemProduzidoId)
    }
  }
  return out
}
