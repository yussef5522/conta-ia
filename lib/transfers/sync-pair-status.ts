// Sprint Transfer Display+Sync (20/06/2026) — Gap 5 invariante
// Helper que garante: TODOS os lados de um transferGroupId terminam com o
// MESMO status. Chamável por todo caminho que CRIA ou ATUALIZA um par.
//
// Função PURA pra decidir status canônico + função DB pra aplicar.

import type { PrismaClient, Prisma } from '@prisma/client'

export type TransferPairStatus = 'PENDING' | 'RECONCILED' | 'IGNORED'

/**
 * Decide o status canônico do par a partir dos statuses individuais.
 * Regra: RECONCILED vence PENDING; IGNORED só se TODOS forem IGNORED.
 *
 * RECONCILED é o status correto pra transferência pareada já conciliada
 * com extrato (caso default). PENDING só permanece se nenhum lado foi
 * conciliado ainda (raro pra TRANSFER pareada).
 */
export function canonicalPairStatus(
  statuses: ReadonlyArray<string>,
): TransferPairStatus {
  if (statuses.length === 0) return 'RECONCILED'
  if (statuses.every((s) => s === 'IGNORED')) return 'IGNORED'
  // Se ALGUM lado é RECONCILED, o par inteiro adota RECONCILED.
  if (statuses.some((s) => s === 'RECONCILED')) return 'RECONCILED'
  // Caso só PENDING (sem nenhum lado conciliado), mantém PENDING.
  return 'PENDING'
}

/**
 * Sincroniza status dos 2 lados de um transferGroupId pra o status canônico.
 * Idempotente: chamável após qualquer create/update do par.
 *
 * NÃO MEXE: amount, date, groupId, direction, type, origin, categoryId,
 * transferDismissedAt, dedupHash. Só `status`.
 *
 * Retorna { canonical, updated } pra log/telemetria.
 */
export async function syncPairStatus(
  db: PrismaClient | Prisma.TransactionClient,
  transferGroupId: string,
): Promise<{ canonical: TransferPairStatus; updated: number }> {
  const sides = await db.transaction.findMany({
    where: { transferGroupId },
    select: { id: true, status: true },
  })
  if (sides.length === 0) return { canonical: 'RECONCILED', updated: 0 }
  const canonical = canonicalPairStatus(sides.map((s) => s.status))
  const toUpdate = sides.filter((s) => s.status !== canonical).map((s) => s.id)
  if (toUpdate.length === 0) return { canonical, updated: 0 }
  await db.transaction.updateMany({
    where: { id: { in: toUpdate } },
    data: { status: canonical },
  })
  return { canonical, updated: toUpdate.length }
}
