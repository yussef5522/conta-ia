// Tipos do motor de conciliação bidirecional.

export interface StatementLine {
  datePosted: Date
  signedAmount: number // CREDIT positivo, DEBIT negativo (sinal canônico do extrato)
  memo: string
  fitid?: string // dica de desempate apenas, NUNCA chave
}

export interface DbBankTransaction {
  id: string
  date: Date
  signedAmount: number // já com sinal: CREDIT +, DEBIT -, TRANSFER conforme regra do código
  memo: string
  fitid?: string
  lifecycle: 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE' | string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
  // Quando true, NÃO entra na conciliação (nem matched nem orphan).
  // Uso: SALDO_ABERTURA / ajustes contábeis que nunca aparecem no extrato bancário.
  excludeFromReconciliation?: boolean
}

export type MatchConfidence = 'EXACT' | 'FUZZY'

export interface MatchedPair {
  dbTx: DbBankTransaction
  statementLine: StatementLine
  // No Tier 1 'EXACT': stableKey completo (data|signed|memo).
  // No Tier 2 'FUZZY': weakKey (data|signed) — memo divergia entre ERP e banco.
  matchKey: string
  confidence: MatchConfidence
}

export interface ReconcileResult {
  matched: MatchedPair[]
  // Sobra no DB que NÃO aparece no extrato → fantasma (precisa revisão humana)
  orphans: DbBankTransaction[]
  // Sobra no extrato que NÃO está no DB → precisa importar
  missing: StatementLine[]
  // Linhas do extrato que são PREVIEW/AGENDADO (DTPOSTED>DTASOF ou FITID==YYMMDD)
  // → entram como PENDING/PAYABLE, NÃO EFFECTED
  previews: StatementLine[]
}
