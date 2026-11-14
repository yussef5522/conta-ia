// ⭐⭐ PAPEL DA CONTA — porta única (leis R20/R13/R8, 13/11/2026).
//
// Conta SEM linha em `stock_colaborador_papel` é COZINHA. ESCRITORIO e APARELHO ficam FORA de toda
// comparação/ranking da cozinha (`foraDoRanking` da lei). Quem compara gente lê o papel AQUI —
// nunca por nome ("gerente") nem por palpite.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { ROTULO_DO_PAPEL, type PapelDaConta } from './leis-r'
export { ROTULO_DO_PAPEL }

type Db = PrismaClient | Prisma.TransactionClient

export const PAPEIS: readonly PapelDaConta[] = ['cozinha', 'escritorio', 'aparelho']
const DO_BANCO: Record<string, PapelDaConta> = { COZINHA: 'cozinha', ESCRITORIO: 'escritorio', APARELHO: 'aparelho' }
const PRO_BANCO: Record<PapelDaConta, string> = { cozinha: 'COZINHA', escritorio: 'ESCRITORIO', aparelho: 'APARELHO' }

export const ehPapel = (p: unknown): p is PapelDaConta => typeof p === 'string' && (PAPEIS as readonly string[]).includes(p)

/** o papel de cada conta pedida (sem linha → cozinha) */
export async function papeisDasContas(companyId: string, ids: readonly string[], db: Db = defaultPrisma): Promise<Map<string, PapelDaConta>> {
  const out = new Map<string, PapelDaConta>(ids.map((id) => [id, 'cozinha']))
  if (!ids.length) return out
  const rows = await db.stockColaboradorPapel.findMany({ where: { companyId, colaboradorId: { in: [...ids] } }, select: { colaboradorId: true, papel: true } })
  for (const r of rows) out.set(r.colaboradorId, DO_BANCO[r.papel] ?? 'cozinha')
  return out
}

/** define o papel (1 linha por conta; trocar = UPDATE) */
export async function definirPapel(
  input: { companyId: string; colaboradorId: string; papel: PapelDaConta; userId?: string | null }, db: Db = defaultPrisma,
): Promise<void> {
  const c = await db.stockColaborador.findFirst({ where: { id: input.colaboradorId, companyId: input.companyId }, select: { id: true } })
  if (!c) throw new Error('Essa conta não existe nesta empresa.')
  await db.stockColaboradorPapel.upsert({
    where: { colaboradorId: input.colaboradorId },
    create: { companyId: input.companyId, colaboradorId: input.colaboradorId, papel: PRO_BANCO[input.papel], definidoPorId: input.userId ?? null },
    update: { papel: PRO_BANCO[input.papel], definidoPorId: input.userId ?? null, definidoEm: new Date() },
  })
}
