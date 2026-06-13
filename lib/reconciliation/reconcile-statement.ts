// Motor PURO de conciliação bidirecional (Espelho do Extrato) — 2 NÍVEIS.
//
// Tier 1 (EXACT) — match por stableKey: data|signedAmount|memoNormalizado.
//   Cobre re-import com FITID reciclado pelo banco (caso real Banrisul).
//   Desempate dentro de bucket multiset com N(DB)>M(stmt): DB cujo FITID
//   aparece em qualquer linha real do extrato atual vai PRA matched; sobras
//   viram orphans (regra empírica: "FITID confirmado pelo banco tem prioridade").
//
// Tier 2 (FUZZY) — sobre orphans e missing do Tier 1:
//   match multiset por weakKey: data|signedAmount (memo IGNORADO).
//   Cobre divergência de descrição entre ERP e extrato (ex: TRANSFER MANUAL
//   com memo "YUSSEF... Transferência | Pix" vs OFX "PIX ENVIADO").
//   ⚠️ TIER 2 NÃO mascara bug de sinal — se signedAmount diverge entre DB e
//   extrato (caso real TRANSFER 7.400 com sinal invertido), continuam separados.
//
// Linhas PREVIEW (DTPOSTED > DTASOF ou FITID==YYMMDD) são SEPARADAS antes
// dos 2 tiers — não competem por casamento com EFFECTED.

import type {
  StatementLine,
  DbBankTransaction,
  MatchedPair,
  ReconcileResult,
} from './types'
import { stableKey } from './stable-key'
import { isPreviewLine } from './is-preview'
import { isOpeningBalanceMemo } from './opening-balance'

function weakKey(t: { date: Date; signedAmount: number }): string {
  return `${t.date.toISOString().slice(0, 10)}|${t.signedAmount.toFixed(2)}`
}

export function reconcileStatement(
  statementLines: StatementLine[],
  dbBankTxInWindow: DbBankTransaction[],
  dtAsOf: Date,
): ReconcileResult {
  // 1. Separa previews — não vão pra nenhum tier
  const previews: StatementLine[] = []
  const realLines: StatementLine[] = []
  for (const line of statementLines) {
    if (isPreviewLine(line, dtAsOf)) previews.push(line)
    else realLines.push(line)
  }

  // Universo de FITIDs do extrato real (qualquer linha) → usado no desempate Tier 1
  const stmtFitidUniverse = new Set<string>()
  for (const line of realLines) {
    if (line.fitid) stmtFitidUniverse.add(line.fitid)
  }

  // Filtra dbTx que estão MARCADAS pra excluir da conciliação (SALDO_ABERTURA, ajustes
  // contábeis que nunca aparecem no extrato). Também detecta heuristicamente via memo
  // pra cobrir caller que não soube setar a flag.
  const eligibleDbTxs = dbBankTxInWindow.filter(
    (tx) => !tx.excludeFromReconciliation && !isOpeningBalanceMemo(tx.memo),
  )

  // ============================================================
  // TIER 1 — match exato por stableKey
  // ============================================================
  const stmtByKey = new Map<string, StatementLine[]>()
  for (const line of realLines) {
    const k = stableKey({ date: line.datePosted, signedAmount: line.signedAmount, memo: line.memo })
    const arr = stmtByKey.get(k) ?? []
    arr.push(line)
    stmtByKey.set(k, arr)
  }

  const dbByKey = new Map<string, DbBankTransaction[]>()
  for (const tx of eligibleDbTxs) {
    const k = stableKey({ date: tx.date, signedAmount: tx.signedAmount, memo: tx.memo })
    const arr = dbByKey.get(k) ?? []
    arr.push(tx)
    dbByKey.set(k, arr)
  }

  const matched: MatchedPair[] = []
  const tier1OrphanCandidates: DbBankTransaction[] = []
  const tier1MissingCandidates: StatementLine[] = []

  const allTier1Keys = new Set<string>([...stmtByKey.keys(), ...dbByKey.keys()])
  for (const key of allTier1Keys) {
    const stmts = stmtByKey.get(key) ?? []
    const dbs = dbByKey.get(key) ?? []

    // Desempate por FITID: dbs cujo FITID está no universo do extrato vão PRIMEIRO
    // → ficam matched; os de FITID ausente/desconhecido sobram como orphans.
    // Estável dentro de cada grupo pra ser determinístico.
    const dbsRanked = [...dbs].sort((a, b) => {
      const aIn = a.fitid && stmtFitidUniverse.has(a.fitid) ? 1 : 0
      const bIn = b.fitid && stmtFitidUniverse.has(b.fitid) ? 1 : 0
      if (aIn !== bIn) return bIn - aIn // 1 antes de 0
      return 0 // mantém ordem original como tiebreak
    })

    const n = Math.min(stmts.length, dbsRanked.length)
    for (let i = 0; i < n; i++) {
      matched.push({
        dbTx: dbsRanked[i],
        statementLine: stmts[i],
        matchKey: key,
        confidence: 'EXACT',
      })
    }
    if (dbsRanked.length > stmts.length) {
      for (let i = n; i < dbsRanked.length; i++) tier1OrphanCandidates.push(dbsRanked[i])
    } else if (stmts.length > dbsRanked.length) {
      for (let i = n; i < stmts.length; i++) tier1MissingCandidates.push(stmts[i])
    }
  }

  // ============================================================
  // TIER 2 — fuzzy por weakKey (data|signed) sobre os leftovers
  // ============================================================
  const orphans: DbBankTransaction[] = []
  const missing: StatementLine[] = []

  const leftStmtByWeak = new Map<string, StatementLine[]>()
  for (const line of tier1MissingCandidates) {
    const k = weakKey({ date: line.datePosted, signedAmount: line.signedAmount })
    const arr = leftStmtByWeak.get(k) ?? []
    arr.push(line)
    leftStmtByWeak.set(k, arr)
  }

  const leftDbByWeak = new Map<string, DbBankTransaction[]>()
  for (const tx of tier1OrphanCandidates) {
    const k = weakKey({ date: tx.date, signedAmount: tx.signedAmount })
    const arr = leftDbByWeak.get(k) ?? []
    arr.push(tx)
    leftDbByWeak.set(k, arr)
  }

  const allTier2Keys = new Set<string>([...leftStmtByWeak.keys(), ...leftDbByWeak.keys()])
  for (const key of allTier2Keys) {
    const stmts = leftStmtByWeak.get(key) ?? []
    const dbs = leftDbByWeak.get(key) ?? []
    const n = Math.min(stmts.length, dbs.length)
    for (let i = 0; i < n; i++) {
      matched.push({ dbTx: dbs[i], statementLine: stmts[i], matchKey: key, confidence: 'FUZZY' })
    }
    if (dbs.length > stmts.length) {
      for (let i = n; i < dbs.length; i++) orphans.push(dbs[i])
    } else if (stmts.length > dbs.length) {
      for (let i = n; i < stmts.length; i++) missing.push(stmts[i])
    }
  }

  return { matched, orphans, missing, previews }
}
