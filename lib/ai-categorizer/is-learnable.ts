// Sprint Cartao-A-Classificar (14/08/2026) — GUARD do aprendizado.
//
// A AiLearningRule NÃO pode aprender uma categoria de FILA DE REVISÃO (A_CLASSIFICAR).
// Se aprendesse "Outback → A CLASSIFICAR", reproduziria o erro do "EQUIPAMENTOS"
// catch-all em todo import futuro. Requisito do Yussef, não detalhe. Todo ponto que
// CRIA/UPSERT regra passa por aqui antes.

import type { PrismaClient, Prisma } from '@prisma/client'
import { NON_LEARNABLE_DRE_GROUPS } from '@/lib/dre/types'

type Db = PrismaClient | Prisma.TransactionClient

/** Uma categoria é aprendível? False pra categorias-fila (A_CLASSIFICAR) e sem id. */
export async function isCategoryLearnable(db: Db, categoryId: string | null | undefined): Promise<boolean> {
  if (!categoryId) return false
  const cat = await db.category.findUnique({ where: { id: categoryId }, select: { dreGroup: true } })
  return !(cat?.dreGroup != null && NON_LEARNABLE_DRE_GROUPS.has(cat.dreGroup))
}
