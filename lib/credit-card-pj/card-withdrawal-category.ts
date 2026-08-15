// Sprint Cartao-A-Classificar (14/08/2026) — categoria de PARQUEAMENTO das compras
// de cartão pessoal.
//
// NÃO é "Retirada"/"Distribuição" nem "Investimento" — é "AINDA NÃO SEI". Uma FILA
// DE REVISÃO até o usuário decidir com o contador. dreGroup A_CLASSIFICAR:
//   - NÃO-DRE (não vira despesa nem receita; não afeta o lucro);
//   - NÃO aprendível (NON_LEARNABLE_DRE_GROUPS) → não vira o próximo "EQUIPAMENTOS";
//   - a tela GRITA quantas estão paradas (contador). O objetivo é ESVAZIAR.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export const CARD_REVIEW_CATEGORY_NAME = 'A CLASSIFICAR — cartão'
export const CARD_REVIEW_DRE_GROUP = 'A_CLASSIFICAR'

/** Acha ou cria a categoria-fila "A CLASSIFICAR — cartão" da empresa. */
export async function getOrCreateCardWithdrawalCategory(db: Db, companyId: string): Promise<string> {
  const existing = await db.category.findFirst({
    where: { companyId, dreGroup: CARD_REVIEW_DRE_GROUP, name: CARD_REVIEW_CATEGORY_NAME },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await db.category.create({
    data: {
      companyId,
      name: CARD_REVIEW_CATEGORY_NAME,
      type: 'EXPENSE', // pra aparecer no dropdown do cartão
      dreGroup: CARD_REVIEW_DRE_GROUP,
      color: '#a855f7',
      description:
        'Fila de revisão: compras de cartão pessoal parqueadas até decidir a categoria final (com o contador). Fora do DRE, não aprendida.',
    },
    select: { id: true },
  })
  return created.id
}
