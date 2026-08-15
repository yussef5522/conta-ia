// Sprint Cartao-Uso-Pessoal (14/08/2026) — categoria de RETIRADA VIA CARTÃO.
//
// Cartão de uso pessoal do sócio: a compra é DISTRIBUIÇÃO EM ESPÉCIE (a empresa
// pagou o gasto pessoal do sócio). NÃO é despesa operacional. Categoria com
// dreGroup DISTRIBUICAO_LUCROS → sai do DRE automaticamente (grupo não-DRE).
//
// ⚠️ SEM ponte de cash (decisão 14/08): distribuição em espécie não gera entrada
// de dinheiro na conta do sócio — forçar um PF CREDIT criaria dinheiro que não
// existiu. Só a categoria. type=EXPENSE pra aparecer no dropdown do cartão.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export const CARD_WITHDRAWAL_CATEGORY_NAME = 'Retirada via cartão'

/** Acha ou cria a categoria "Retirada via cartão" (DISTRIBUICAO_LUCROS) da empresa. */
export async function getOrCreateCardWithdrawalCategory(db: Db, companyId: string): Promise<string> {
  const existing = await db.category.findFirst({
    where: { companyId, dreGroup: 'DISTRIBUICAO_LUCROS', name: CARD_WITHDRAWAL_CATEGORY_NAME },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await db.category.create({
    data: {
      companyId,
      name: CARD_WITHDRAWAL_CATEGORY_NAME,
      type: 'EXPENSE',
      dreGroup: 'DISTRIBUICAO_LUCROS',
      description: 'Compras pessoais do sócio no cartão da empresa — distribuição em espécie, fora do DRE.',
    },
    select: { id: true },
  })
  return created.id
}
