// Sprint Import Idempotente (18/06/2026) — gate em 2 etapas, função PURA.
//
// O caller carrega:
//   - `incoming`: array das transações com identidade já calculada
//   - `existingFitidKeys`: Set<string> dos fitidKeys vivos+tombstone na conta
//   - `existingContentCounts`: Map<contentHash, count> — quantas tx VIVAS
//      (NÃO tombstones) já existem na conta com cada contentHash
//
// Etapas:
//
// ETAPA 1 (fitidKey gate) — só pra FITIDs CONFIÁVEIS:
//   Dropa incoming cujo fitidKey já existe no ledger (vivo OU tombstone).
//   Tombstones MATAM reimport — o user já viu e excluiu manualmente.
//   Caso queira re-importar, ele tem que reverter o batch (que limpa tombstones).
//   Sem fitidKey (banco não confiável) -> pula esta etapa, vai pra ETAPA 2.
//
// ETAPA 2 (contentHash gate por GRUPO):
//   Agrupa o que sobrou por contentHash. Pra cada grupo:
//     qtdNova = max(0, qtdIncoming - qtdExistente)
//   Pega as PRIMEIRAS qtdNova do grupo (na ordem que vieram), resto = SKIP.
//
// Tombstones NÃO contam como "existente" no contentHash — caso o user
// tenha deletado avulsamente uma tx, ele pode re-importar e ela volta
// (pelo contentHash a Tx morta libera o slot).

import type { IdentityOutput } from './compute-identity'

export interface GateInput<T> {
  payload: T
  identity: IdentityOutput
}

export interface GateExistingState {
  /** Set de fitidKeys CONFIÁVEIS já no ledger (vivas + tombstones). */
  existingFitidKeys: ReadonlySet<string>
  /**
   * Map de contentHash -> COUNT de tx VIVAS (não tombstones) com esse hash
   * já presente na conta. Caller calcula via SELECT GROUP BY.
   */
  existingContentCounts: ReadonlyMap<string, number>
}

export type SkipReason = 'DUPLICATE_FITID' | 'DUPLICATE_CONTENT'

export interface GateSkipped<T> {
  payload: T
  identity: IdentityOutput
  reason: SkipReason
}

export interface GateResult<T> {
  toInsert: Array<GateInput<T>>
  skipped: Array<GateSkipped<T>>
  stats: {
    incoming: number
    inserted: number
    skippedFitid: number
    skippedContent: number
  }
}

/**
 * Função PURA. Recebe estado atual + incoming, devolve decisão.
 * Não acessa DB. Caller persiste depois.
 */
export function applyIdentityGate<T>(
  incoming: ReadonlyArray<GateInput<T>>,
  state: GateExistingState,
): GateResult<T> {
  const skipped: Array<GateSkipped<T>> = []
  let skippedFitid = 0
  let skippedContent = 0

  // ETAPA 1: dropa por fitidKey já visto (DB ou intra-batch)
  const seenFitids = new Set<string>(state.existingFitidKeys)
  const afterEtapa1: Array<GateInput<T>> = []
  for (const item of incoming) {
    const { fitidKey } = item.identity
    if (fitidKey !== null) {
      if (seenFitids.has(fitidKey)) {
        skipped.push({ ...item, reason: 'DUPLICATE_FITID' })
        skippedFitid++
        continue
      }
      seenFitids.add(fitidKey)
    }
    afterEtapa1.push(item)
  }

  // ETAPA 2: agrupa por contentHash, decide qtdNova = max(0, incoming - existente)
  // Map<contentHash, GateInput[]> preservando ordem de entrada
  const byContent = new Map<string, Array<GateInput<T>>>()
  for (const item of afterEtapa1) {
    const h = item.identity.contentHash
    let list = byContent.get(h)
    if (!list) {
      list = []
      byContent.set(h, list)
    }
    list.push(item)
  }

  const toInsert: Array<GateInput<T>> = []
  for (const [contentHash, group] of byContent) {
    const existente = state.existingContentCounts.get(contentHash) ?? 0
    const qtdNova = Math.max(0, group.length - existente)
    for (let i = 0; i < group.length; i++) {
      if (i < qtdNova) {
        toInsert.push(group[i])
      } else {
        skipped.push({ ...group[i], reason: 'DUPLICATE_CONTENT' })
        skippedContent++
      }
    }
  }

  return {
    toInsert,
    skipped,
    stats: {
      incoming: incoming.length,
      inserted: toInsert.length,
      skippedFitid,
      skippedContent,
    },
  }
}
