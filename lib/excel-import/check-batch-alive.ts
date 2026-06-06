// Sprint Reimport-DedupByData: helpers pra contar quantas tx de um batch
// antigo ainda existem (vs foram deletadas pelo user no /contas-a-pagar).
//
// Padrão de dedup REAL: por `dedupHash` (sha256 de favorecido + descricao +
// vencimento + valor) — não por hash do arquivo. Se TODAS as transactions
// criadas pelo batch foram deletadas, a planilha pode ser re-importada do
// zero. Se ALGUMAS ainda existem, o confirm dedupa por dedupHash.
//
// Função pura sobre interfaces (não importa Prisma direto) pra ser testável
// sem DB. Caller injeta funções de query.

export type ReimportScenario =
  | 'NEVER_IMPORTED' // batch existe mas nenhuma row foi materializada
  | 'ALL_DELETED' // todas as N transactions criadas foram deletadas
  | 'PARTIAL' // algumas existem, algumas foram deletadas
  | 'ALL_ALIVE' // todas as N continuam no sistema

export interface BatchAliveStats {
  totalImported: number // staged_rows com userDecision='IMPORTED'
  aliveCount: number // dessas, quantas tx ainda existem na empresa
  scenario: ReimportScenario
}

export function computeReimportScenario(
  totalImported: number,
  aliveCount: number,
): ReimportScenario {
  if (totalImported === 0) return 'NEVER_IMPORTED'
  if (aliveCount === 0) return 'ALL_DELETED'
  if (aliveCount >= totalImported) return 'ALL_ALIVE'
  return 'PARTIAL'
}

/**
 * Conta dedup REAL: quantas das tx originalmente criadas pelo batch ainda
 * existem na empresa. Caller injeta as 2 queries pra ficar testável.
 */
export async function checkBatchAlive(deps: {
  /** staged_rows do batch que viraram tx (userDecision='IMPORTED'). */
  loadImportedDedupHashes: () => Promise<string[]>
  /** Conta quantas transactions com esses dedupHashes existem na empresa. */
  countAliveTxByDedupHash: (dedupHashes: string[]) => Promise<number>
}): Promise<BatchAliveStats> {
  const dedupHashes = await deps.loadImportedDedupHashes()
  if (dedupHashes.length === 0) {
    return {
      totalImported: 0,
      aliveCount: 0,
      scenario: 'NEVER_IMPORTED',
    }
  }
  const aliveCount = await deps.countAliveTxByDedupHash(dedupHashes)
  return {
    totalImported: dedupHashes.length,
    aliveCount,
    scenario: computeReimportScenario(dedupHashes.length, aliveCount),
  }
}
