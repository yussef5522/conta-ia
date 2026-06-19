// Sprint Import Idempotente (18/06/2026) — queries do seen-ledger.
//
// Funções utilitárias que o caller (rota de import) usa pra montar
// `GateExistingState` antes de chamar `applyIdentityGate`.

import { prisma } from '@/lib/db'
import type { GateExistingState } from './apply-gate'

/**
 * Busca o estado do ledger pra uma conta + lista de identities incoming.
 *
 * - existingFitidKeys: TODOS fitidKeys do ledger pra essa conta (vivos + tombstones)
 * - existingContentCounts: contagem de tx VIVAS por contentHash
 *
 * Filtra por `bankAccountId` apenas (companyId vem implícito via FK).
 * Performance: pré-filtra pelos hashes incoming pra evitar SELECT massivo.
 */
export async function loadLedgerState(
  bankAccountId: string,
  incomingFitidKeys: string[],
  incomingContentHashes: string[],
): Promise<GateExistingState> {
  if (!bankAccountId) {
    throw new Error('bankAccountId obrigatório')
  }

  // 1) fitidKeys vivos+tombstones na conta que batam com incoming
  let existingFitidKeysSet = new Set<string>()
  if (incomingFitidKeys.length > 0) {
    const rows = await prisma.importedIdentity.findMany({
      where: {
        bankAccountId,
        fitidKey: { in: incomingFitidKeys },
      },
      select: { fitidKey: true },
    })
    existingFitidKeysSet = new Set(
      rows.map((r) => r.fitidKey).filter((k): k is string => !!k),
    )
  }

  // 2) contagem de contentHash VIVOS (tombstone=false) na conta
  let existingContentCountsMap = new Map<string, number>()
  if (incomingContentHashes.length > 0) {
    const grouped = await prisma.importedIdentity.groupBy({
      by: ['contentHash'],
      where: {
        bankAccountId,
        tombstone: false,
        contentHash: { in: incomingContentHashes },
      },
      _count: { contentHash: true },
    })
    existingContentCountsMap = new Map(
      grouped.map((g) => [g.contentHash, g._count.contentHash]),
    )
  }

  return {
    existingFitidKeys: existingFitidKeysSet,
    existingContentCounts: existingContentCountsMap,
  }
}

/**
 * Marca a entrada do ledger como tombstone quando a Transaction é deletada
 * AVULSAMENTE (sem reverter o batch). Mantém bloqueio contra reimport.
 *
 * Caller chama isso no hook de delete da Transaction.
 */
export async function tombstoneIdentityByTransactionId(
  transactionId: string,
): Promise<number> {
  const res = await prisma.importedIdentity.updateMany({
    where: { transactionId },
    data: { tombstone: true, transactionId: null },
  })
  return res.count
}

/**
 * Revert de BATCH inteiro: REMOVE as entries do ledger desse batch (não
 * vira tombstone). Isso libera o slot pra reimport corrigido.
 *
 * Caller chama isso ANTES de deletar as Transactions do batch.
 */
export async function purgeIdentitiesByBatchId(
  importBatchId: string,
): Promise<number> {
  const res = await prisma.importedIdentity.deleteMany({
    where: { importBatchId },
  })
  return res.count
}
