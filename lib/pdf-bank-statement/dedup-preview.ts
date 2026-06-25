// Sprint PDF Extrato Bancário (24/06/2026) — orquestrador dedup pra preview.
//
// Recebe as linhas extraídas pelo Claude + bankAccountId. Pra cada linha:
//   1. Calcula identidade canônica (contentHash) via lib/import-identity
//      — fitidKey é SEMPRE null pra PDF (não existe FITID em extrato PDF)
//   2. Carrega estado do ledger (ImportedIdentity rows) e roda gate
//   3. Marca quais linhas seriam DUPLICATE_CONTENT — pra UI exibir em âmbar
//      desmarcadas por padrão
//
// IMPORTANTE: dedup aqui é RECOMENDAÇÃO PRA UI. O usuário pode forçar a
// importação de uma "duplicata" (vai colidir no constraint UNIQUE do banco
// se o contentHash já está em transactions.dedupHash). A rede final é o
// próprio constraint.

import { computeIdentity, type IdentityOutput } from '@/lib/import-identity/compute-identity'
import { applyIdentityGate, type GateInput } from '@/lib/import-identity/apply-gate'
import { loadLedgerState } from '@/lib/import-identity/ledger-queries'
import type { PdfBankStatementLine } from './types'

export interface PdfDedupLineResult {
  index: number
  line: PdfBankStatementLine
  identity: IdentityOutput
  /** true se essa linha já existe no ledger (sugestão pra desmarcar na UI) */
  isDuplicate: boolean
  /** Motivo da duplicata (sempre DUPLICATE_CONTENT pra PDF) */
  duplicateReason?: 'DUPLICATE_CONTENT'
}

export interface PdfDedupResult {
  lines: PdfDedupLineResult[]
  /** Quantas seriam "novas" (não-duplicatas) caso o user marque todas */
  newCount: number
  /** Quantas batem com tx existentes (duplicatas detectadas) */
  duplicateCount: number
}

export async function computeDedupForPreview(
  bankAccountId: string,
  lines: PdfBankStatementLine[],
): Promise<PdfDedupResult> {
  if (lines.length === 0) {
    return { lines: [], newCount: 0, duplicateCount: 0 }
  }

  // 1) Calcula identity pra cada linha
  const inputsWithIdentity = lines.map((line, index) => {
    const identity = computeIdentity({
      accountId: bankAccountId,
      fitid: null,
      date: line.date,
      amount: line.amount,
      type: line.type,
      name: null,
      memo: line.description,
    })
    return { index, line, identity }
  })

  // 2) Carrega estado do ledger
  const contentHashes = inputsWithIdentity.map((i) => i.identity.contentHash)
  const ledgerState = await loadLedgerState(bankAccountId, [], contentHashes)

  // 3) Aplica o gate (mesma lógica do OFX) pra saber quais seriam toInsert
  const gateInputs: Array<GateInput<{ index: number }>> = inputsWithIdentity.map(
    (i) => ({
      payload: { index: i.index },
      identity: i.identity,
    }),
  )
  const gateResult = applyIdentityGate(gateInputs, ledgerState)
  const skippedIndices = new Set<number>(
    gateResult.skipped.map((s) => s.payload.index),
  )

  // 4) Monta resultado por linha
  const lineResults: PdfDedupLineResult[] = inputsWithIdentity.map((i) => ({
    index: i.index,
    line: i.line,
    identity: i.identity,
    isDuplicate: skippedIndices.has(i.index),
    duplicateReason: skippedIndices.has(i.index) ? 'DUPLICATE_CONTENT' : undefined,
  }))

  return {
    lines: lineResults,
    newCount: gateResult.toInsert.length,
    duplicateCount: gateResult.skipped.length,
  }
}
