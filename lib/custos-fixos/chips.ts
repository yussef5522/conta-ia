/**
 * ⭐ OS INTERRUPTORES PERSISTIDOS POR USUÁRIO (07/10/2026).
 *
 * **Ordem do dono:** *"Estado dos chips PERSISTIDO por usuário (tabela, padrão da casa);
 * default = TUDO LIGADO (a realidade de hoje)."*
 *
 * ⛔ **AUSÊNCIA DE LINHA É O DEFAULT, não um registro semeado.** Usuário novo não ganha linha
 * de chips no cadastro — ele cai no `CHIPS_PADRAO`. Semear na criação criaria 1 linha por
 * (empresa × usuário) que ninguém pediu, e um backfill pra manter.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { CHIPS_PADRAO, type Chips } from './prateleira'

type Db = PrismaClient | Prisma.TransactionClient

export async function lerChips(
  companyId: string,
  userId: string | null,
  db: Db = prisma,
): Promise<Chips> {
  // ⚠️ sem usuário resolvido (caminho de script/cron) a conta é a COMPLETA — nunca um recorte
  // que ninguém escolheu.
  if (!userId) return CHIPS_PADRAO
  const r = await db.custoFixoChips.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { casa: true, banco: true, compromissos: true },
  })
  return r ?? CHIPS_PADRAO
}

export async function salvarChips(
  companyId: string,
  userId: string,
  chips: Chips,
  db: Db = prisma,
): Promise<Chips> {
  const r = await db.custoFixoChips.upsert({
    where: { companyId_userId: { companyId, userId } },
    create: { companyId, userId, ...chips },
    update: { ...chips },
    select: { casa: true, banco: true, compromissos: true },
  })
  return r
}
