// VENDAS FASE 1 gatilho (17/08) — hook fail-soft do recompute. Chamado APÓS import
// confirm e APÓS categorização que toca venda. Regras duras:
//  - por companyId da transação, NUNCA global.
//  - NUNCA derruba o caller: se o recompute falhar, loga e segue — o import/
//    categorização completa e o JUIZ NOTURNO pega (V1 vermelho de manhã). O usuário
//    nunca trava no meio do import por causa do recompute.
//  - só empresa com perfil de recebimento (módulo ligado); senão no-op.
//
// Não é o único caminho: a rede final é o juiz (V1-V4). Estes hooks mantêm a
// VendaDiaria fresca em tempo real nos fluxos comuns; endpoints raros de
// recategorização caem no juiz.

import type { PrismaClient, Prisma } from '@prisma/client'
import { recomputeVendas } from './recompute-vendas'

type Db = PrismaClient | Prisma.TransactionClient

/** Recompute fail-soft por empresa. Resolve o início do módulo pelo perfil (min
 *  vigenteDe). Sem perfil → no-op. NUNCA lança. */
export async function recomputeVendasSafe(db: Db, companyId: string): Promise<void> {
  try {
    const primeira = await db.regraRecebimento.findFirst({
      where: { companyId }, orderBy: { vigenteDe: 'asc' }, select: { vigenteDe: true },
    })
    if (!primeira) return // empresa sem perfil de vendas — módulo desligado
    const r = await recomputeVendas(db, companyId, primeira.vigenteDe)
    if (r.vendasCriadas > 0) {
      console.log(`[vendas-hook] recompute ${companyId}: ${r.vendasCriadas} VendaDiaria · total ${r.valorTotal.toFixed(2)}`)
    }
  } catch (e) {
    // NÃO propaga — o import/categorização já completou; o juiz noturno pega.
    console.error(`[vendas-hook] recompute falhou (não bloqueia; juiz noturno pega) — ${companyId}:`, (e as Error).message)
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
): Promise<void> {
  if (await algumaEhVenda(db, categoryIds)) await recomputeVendasSafe(db, companyId)
}
