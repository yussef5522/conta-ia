// VENDAS FASE 1 gatilho (17/08) — hook fail-soft do recompute. Chamado APÓS import
// confirm e APÓS categorização que toca venda. Regras duras:
//  - por companyId da transação, NUNCA global.
//  - NUNCA derruba o caller: se o recompute falhar, loga e segue — o import/
//    categorização completa e o JUIZ NOTURNO pega (V1 vermelho de manhã). O usuário
//    nunca trava no meio do import por causa do recompute.
//  - só empresa com perfil de recebimento (módulo ligado); senão no-op.
//
// ⭐⭐ INSTRUMENTAÇÃO (27/08) — LOGA SEMPRE, INCLUSIVE O NO-OP.
//
// ⚠️ POR QUE: em 26/08 uma venda em dinheiro de **R$ 2.041,00** ficou fora do
// calendário. O juiz pegou (V1+V2) e o self-heal resolveu, mas **não deu pra saber por
// qual porta ela entrou** — e a razão é que o hook só logava quando REALMENTE
// recomputava. "Não logou" era ambíguo entre QUATRO coisas:
//    (a) não foi chamado · (b) chamado, mas a categoria não é venda ·
//    (c) chamado, mas a empresa não tem perfil · (d) chamado, recomputou, 0 linhas
// Caçar bug com sinal ambíguo é caçar no escuro. Agora cada chamada deixa UMA linha
// dizendo o que aconteceu E **de qual porta veio** (`origem`) — o campo que teria
// respondido a pergunta na hora.
//
// Não é o único caminho: a rede final é o juiz (V1-V6). Estes hooks mantêm a
// VendaDiaria fresca em tempo real nos fluxos comuns; endpoints raros de
// recategorização caem no juiz.

import type { PrismaClient, Prisma } from '@prisma/client'
import { recomputeVendas } from './recompute-vendas'

type Db = PrismaClient | Prisma.TransactionClient

/** De onde o hook foi chamado. Sem isto, "não logou" não distingue "não foi chamado"
 *  de "foi chamado e virou no-op" — foi o que impediu de achar a porta da venda de
 *  R$ 2.041,00 em 26/08. Toda chamada nova PRECISA se identificar. */
export type OrigemHook =
  | 'POST /api/transacoes'
  | 'PATCH /api/transacoes/[id]'
  | 'POST /api/transacoes/lote'
  | 'import-ofx/confirm'
  | 'conciliacao/reconcile'
  | 'createContaPendente'
  | 'desconhecida'

const log = (origem: OrigemHook, companyId: string, o: string) =>
  console.log(`[vendas-hook] ${origem} · ${companyId} · ${o}`)

/** Recompute fail-soft por empresa. Resolve o início do módulo pelo perfil (min
 *  vigenteDe). Sem perfil → no-op. NUNCA lança. */
export async function recomputeVendasSafe(
  db: Db,
  companyId: string,
  origem: OrigemHook = 'desconhecida',
): Promise<void> {
  try {
    const primeira = await db.regraRecebimento.findFirst({
      where: { companyId }, orderBy: { vigenteDe: 'asc' }, select: { vigenteDe: true },
    })
    if (!primeira) {
      // ⚠️ no-op LEGÍTIMO (empresa sem módulo de vendas) — mas registrado, senão vira
      // indistinguível de "não foi chamado".
      log(origem, companyId, 'no-op: empresa sem perfil de recebimento (módulo desligado)')
      return
    }
    const r = await recomputeVendas(db, companyId, primeira.vigenteDe)
    log(origem, companyId, `recomputado: ${r.vendasCriadas} VendaDiaria · ${r.origensLinkadas} origens · total ${r.valorTotal.toFixed(2)}`)
  } catch (e) {
    // NÃO propaga — o import/categorização já completou; o juiz noturno pega.
    console.error(`[vendas-hook] ${origem} · ${companyId} · FALHOU (não bloqueia; juiz noturno pega): ${(e as Error).message}`)
  }
}

/** True se algum dos categoryIds é categoria de VENDA (RECEITA_BRUTA) — pra só
 *  recomputar quando a categorização toca venda (evita recompute à toa). */
export async function algumaEhVenda(db: Db, categoryIds: (string | null | undefined)[]): Promise<boolean> {
  const ids = categoryIds.filter((c): c is string => !!c)
  if (ids.length === 0) return false
  const n = await db.category.count({ where: { id: { in: ids }, dreGroup: 'RECEITA_BRUTA' } })
  return n > 0
}

/** Hook de categorização: recompute só se a categoria (nova OU antiga) for venda. */
export async function recomputeVendasSeVenda(
  db: Db,
  companyId: string,
  categoryIds: (string | null | undefined)[],
  origem: OrigemHook = 'desconhecida',
): Promise<void> {
  const ids = categoryIds.filter((c): c is string => !!c)
  if (ids.length === 0) {
    log(origem, companyId, 'no-op: transação SEM categoria (nada a recomputar)')
    return
  }
  if (!(await algumaEhVenda(db, ids))) {
    log(origem, companyId, `no-op: categoria não é de venda (${ids.length} id(s) checado(s), nenhum RECEITA_BRUTA)`)
    return
  }
  await recomputeVendasSafe(db, companyId, origem)
}
