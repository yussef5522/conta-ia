// Deduplicação de PREVIEWS contra tx do DB com lifecycle pendente
// (PAYABLE / RECEIVABLE). Garante idempotência: se a preview já foi criada
// como PAYABLE num import anterior (ou pelo workflow manual), não recriamos.
//
// 2 tiers (espelho da semântica de reconcileStatement):
//   Tier 1 EXACT: stableKey (data|signed|memo)
//   Tier 2 FUZZY: weakKey (data|signed) — cobre o caso em que o banco TROCA o
//     memo entre exports da mesma linha. Caso real Banrisul 12/06:
//     agendado FITID 100048 era "DEBITO CARTAO DE CREDITO" no export anterior
//     e virou "PAGAMENTO CARTAO DE CREDITO" no export novo — mesma linha.

import type { StatementLine } from './types'
import { stableKey } from './stable-key'

export interface DbPendingTxRef {
  id: string
  date: Date
  signedAmount: number
  memo: string
}

export interface PreviewDedupMatch {
  statementLine: StatementLine
  dbTxId: string
  matchKey: string
  confidence: 'EXACT' | 'FUZZY'
}

export interface PreviewDedupResult {
  toCreate: StatementLine[]
  alreadyExisting: PreviewDedupMatch[]
}

function weakKey(t: { date: Date; signedAmount: number }): string {
  return `${t.date.toISOString().slice(0, 10)}|${t.signedAmount.toFixed(2)}`
}

export function dedupPreviewsAgainstDbPending(
  previews: StatementLine[],
  dbPending: DbPendingTxRef[],
): PreviewDedupResult {
  // Index multiset por stableKey e weakKey
  const pendingByExact = new Map<string, string[]>()
  const pendingByWeak = new Map<string, string[]>()
  for (const t of dbPending) {
    const sk = stableKey({ date: t.date, signedAmount: t.signedAmount, memo: t.memo })
    const wk = weakKey({ date: t.date, signedAmount: t.signedAmount })
    pendingByExact.set(sk, [...(pendingByExact.get(sk) ?? []), t.id])
    pendingByWeak.set(wk, [...(pendingByWeak.get(wk) ?? []), t.id])
  }

  // Rastreia IDs já consumidos pra não casar duas vezes com a mesma tx do DB
  const consumed = new Set<string>()
  const alreadyExisting: PreviewDedupMatch[] = []
  const tier2Queue: StatementLine[] = []

  // ─── Tier 1: EXACT ───
  for (const p of previews) {
    const sk = stableKey({ date: p.datePosted, signedAmount: p.signedAmount, memo: p.memo })
    const bucket = pendingByExact.get(sk) ?? []
    const available = bucket.find((id) => !consumed.has(id))
    if (available) {
      consumed.add(available)
      alreadyExisting.push({ statementLine: p, dbTxId: available, matchKey: sk, confidence: 'EXACT' })
    } else {
      tier2Queue.push(p)
    }
  }

  // ─── Tier 2: FUZZY (sobre o que sobrou do Tier 1) ───
  const toCreate: StatementLine[] = []
  for (const p of tier2Queue) {
    const wk = weakKey({ date: p.datePosted, signedAmount: p.signedAmount })
    const bucket = pendingByWeak.get(wk) ?? []
    const available = bucket.find((id) => !consumed.has(id))
    if (available) {
      consumed.add(available)
      alreadyExisting.push({ statementLine: p, dbTxId: available, matchKey: wk, confidence: 'FUZZY' })
    } else {
      toCreate.push(p)
    }
  }

  return { toCreate, alreadyExisting }
}
