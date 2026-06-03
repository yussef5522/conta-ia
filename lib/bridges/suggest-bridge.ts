// Sprint PF Fatia 4 — Lista sugestões de ponte pra uma empresa.
//
// Roda sob demanda quando user abre /pendentes ou dashboard PJ.
// Filtrada pelo userId logado (privacidade multi-sócio decisão D).
//
// Cache na camada de queries (60s tag bridges:suggestions:companyId).

import { prisma } from '@/lib/db'
import { findCandidateProfile } from './find-candidate-profile'
import type { BridgeCandidate } from './types'

export interface SuggestBridgesInput {
  companyId: string
  userId: string
  /** Quantos dias pra trás considerar. Default 90. */
  windowDays?: number
  /** Limite de candidates a retornar. Default 20. */
  limit?: number
}

export async function suggestBridges(
  input: SuggestBridgesInput,
): Promise<BridgeCandidate[]> {
  const window = input.windowDays ?? 90
  const limit = input.limit ?? 20
  const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000)

  // Tx PJ DEBIT relacionada a SocioPF, sem bridge ainda, nos últimos N dias.
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: input.companyId },
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
      isInternalTransfer: false,
      transferGroupId: null,
      relatedPartyType: 'SOCIO_PF',
      relatedPartyId: { not: null },
      date: { gte: since },
      bridge: null,
    },
    orderBy: { date: 'desc' },
    take: limit * 3, // buffer pra filtrar candidates abaixo
  })

  const candidates: BridgeCandidate[] = []
  for (const tx of txs) {
    if (candidates.length >= limit) break
    const cand = await findCandidateProfile({
      pjTransactionId: tx.id,
      userId: input.userId,
    })
    if (cand) candidates.push(cand)
  }

  return candidates
}

/** Conta sugestões pendentes (pra badge no sidebar). */
export async function countSuggestions(
  input: SuggestBridgesInput,
): Promise<number> {
  const candidates = await suggestBridges(input)
  return candidates.length
}
