// Fase 2 — função PURA de agrupamento da listagem /transferencias.
// Extraída de app/api/transferencias/route.ts pra ficar testável.
//
// Regra:
//   1. Prioriza `transferDirection` EXPLÍCITA ('OUT'/'IN') — Fase 2.
//   2. Quando NULL (tx pré-Fase-2), fallback createdAt-ASC: 1ª ocorrência = OUT,
//      2ª = IN. Caller é responsável por passar `txs` já ordenado por
//      [date desc, createdAt asc, id asc].
//   3. Grupos com 1 perna ficam com toAccount=null (ou fromAccount=null se a
//      perna ausente fosse a saída) — UI deve renderizar "X → (perna ausente)"
//      em vez do bug histórico "X → X".

export interface AccountRef {
  id: string
  name: string
  bankName: string | null
}

export interface TxForList {
  id: string
  date: Date
  amount: number
  description: string
  notes: string | null
  transferGroupId: string | null
  transferDirection?: 'OUT' | 'IN' | string | null
  bankAccount: AccountRef | null
}

export interface GroupedTransfer {
  groupId: string
  date: Date
  amount: number
  fromAccount: AccountRef | null
  toAccount: AccountRef | null
  description: string
  notes: string | null
}

export function groupTransfersForList(txs: TxForList[]): GroupedTransfer[] {
  const grupos = new Map<string, GroupedTransfer>()
  for (const tx of txs) {
    if (!tx.transferGroupId || !tx.bankAccount) continue
    const gid = tx.transferGroupId
    let g = grupos.get(gid)
    if (!g) {
      g = {
        groupId: gid,
        date: tx.date,
        amount: tx.amount,
        fromAccount: null,
        toAccount: null,
        description: tx.description,
        notes: tx.notes,
      }
      grupos.set(gid, g)
    }
    if (tx.transferDirection === 'OUT') g.fromAccount = tx.bankAccount
    else if (tx.transferDirection === 'IN') g.toAccount = tx.bankAccount
    else {
      // Fallback createdAt-ASC (caller deve passar txs ordenadas ASC dentro do grupo)
      if (!g.fromAccount) g.fromAccount = tx.bankAccount
      else if (!g.toAccount) g.toAccount = tx.bankAccount
    }
  }
  return Array.from(grupos.values())
}
