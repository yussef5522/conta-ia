// Monta o universo de tx do DB que o reconcile compara contra as linhas do
// extrato. REGRA (fix duplicata 07/08): o universo é EFFECTED + PAYABLE/RECEIVABLE.
//
// Por quê incluir os pending: uma linha REAL do extrato pode casar com uma
// PREVIEW (PAYABLE/RECEIVABLE) criada por um import anterior. Se os pending
// ficassem de fora, essa linha real viraria `missing` e seria RECRIADA — a
// duplicata preview↔real que este fix elimina. Com os pending no universo, a
// linha real casa com a preview e o orchestrator PROMOVE (lifecycle→EFFECTED).
//
// Esta função é pura de propósito: reconcile-universe.test.ts garante que os
// pending NUNCA saiam do universo (guarda contra reintroduzir o bug filtrando
// só por EFFECTED).

import type { DbBankTransaction } from './types'

interface EffectedRow {
  id: string
  date: Date
  type: string
  amount: number
  externalId?: string | null
  description?: string | null
}

interface PendingRow {
  id: string
  date: Date
  type: string
  amount: number
  lifecycle: string
  externalId?: string | null
  description?: string | null
}

export function buildReconcileUniverse(
  effected: EffectedRow[],
  pending: PendingRow[],
  signedById?: Map<string, number>,
): DbBankTransaction[] {
  const fromEffected: DbBankTransaction[] = effected.map((t) => ({
    id: t.id,
    date: t.date,
    signedAmount: signedById?.get(t.id) ?? (t.type === 'CREDIT' ? t.amount : -t.amount),
    memo: t.description ?? '',
    fitid: t.externalId ?? undefined,
    lifecycle: 'EFFECTED',
    type: t.type,
  }))

  // Pending não é transferência interna materializada → sinal por tipo basta
  // (CREDIT=+, DEBIT=−). O lifecycle real (PAYABLE/RECEIVABLE) é preservado pra
  // o reconcile classificar o match como `promoted`.
  const fromPending: DbBankTransaction[] = pending.map((t) => ({
    id: t.id,
    date: t.date,
    signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
    memo: t.description ?? '',
    fitid: t.externalId ?? undefined,
    lifecycle: t.lifecycle,
    type: t.type,
  }))

  return [...fromEffected, ...fromPending]
}
