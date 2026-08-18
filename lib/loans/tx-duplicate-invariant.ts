// I10 (17/08/2026) — INVARIANTE DE DUPLICATA DE TX. Função pura, testável.
//
// Duplicata = 2+ tx EFFECTED com o MESMO stableKey vindas de imports DIFERENTES (a
// linha do extrato foi CRIADA 2× em vez de deduplicada). Fecha a lacuna do saldo/I9,
// que são cegos pra duplicata datada ANTES da âncora (bug PIX 7.000: dup em 13/08,
// âncora em 17/08 → o saldo batia com o dado errado e o I9 não olhava o pré-anchor).
//
// COMO distinguir duplicata de repeat legítimo (2 linhas idênticas na MESMA fatura,
// ex 2 tarifas iguais no mesmo dia): o dedupHash é `stableKey#batchId:occ`. O repeat
// legítimo compartilha o batchId (occ :0/:1); a duplicata cross-import tem batchIds
// DIFERENTES pro mesmo stableKey. Então: mesmo stableKey + 2+ batchIds = duplicata.
// Legado sem esse formato (sha256/null) → sem batchId, não dá pra julgar → pula.

export interface DupTxRow {
  id: string
  bankAccountId: string | null
  dedupHash: string | null
  date: Date
  amount: number
  description: string | null
}

export interface DupStableKey {
  accountId: string
  accountName: string
  stableKey: string
  txIds: string[]
  date: string
  amount: number
  memo: string
}

export function findDuplicateStableKeys(
  txs: DupTxRow[],
  accNames: Map<string, string>,
): DupStableKey[] {
  const byKey = new Map<string, { id: string; batch: string; date: Date; amount: number; desc: string }[]>()
  for (const t of txs) {
    if (!t.bankAccountId || !t.dedupHash) continue
    const dh = t.dedupHash
    const hashIdx = dh.lastIndexOf('#')
    if (hashIdx < 0) continue // formato legado — sem batchId, não julga
    const prefix = dh.slice(0, hashIdx)
    const batch = dh.slice(hashIdx + 1).split(':')[0]
    const key = `${t.bankAccountId} ${prefix}`
    const arr = byKey.get(key) ?? []
    arr.push({ id: t.id, batch, date: t.date, amount: t.amount, desc: t.description ?? '' })
    byKey.set(key, arr)
  }

  const out: DupStableKey[] = []
  for (const [key, arr] of byKey) {
    const batches = new Set(arr.map((a) => a.batch))
    if (arr.length >= 2 && batches.size >= 2) {
      const sep = key.indexOf(' ')
      const accountId = key.slice(0, sep)
      const prefix = key.slice(sep + 1)
      out.push({
        accountId,
        accountName: accNames.get(accountId) ?? accountId,
        stableKey: prefix,
        txIds: arr.map((a) => a.id),
        date: arr[0].date.toISOString().slice(0, 10),
        amount: arr[0].amount,
        memo: arr[0].desc,
      })
    }
  }
  return out
}
