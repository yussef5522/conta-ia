// Tipos do motor de conciliação bidirecional.

export interface StatementLine {
  datePosted: Date
  signedAmount: number // CREDIT positivo, DEBIT negativo (sinal canônico do extrato)
  memo: string
  fitid?: string // dica de desempate apenas, NUNCA chave
  // FASE 2.1 Contraparte: NAME do OFX quando difere do MEMO. NÃO entra no stableKey.
  counterpartyName?: string
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

// ⭐ FRONTEIRA_DIA (05/09/2026): identidade IGUAL (valor + histórico canônico) com a data
// deslocada em 1 dia, e a linha SUMIU do dia original no arquivo novo — o banco re-datou uma
// linha já publicada. Não é fuzzy: é a mesma linha, com a régua estreita de
// `fronteira-de-dia.ts`.
export type MatchConfidence = 'EXACT' | 'FUZZY' | 'FRONTEIRA_DIA'

export interface MatchedPair {
  dbTx: DbBankTransaction
  statementLine: StatementLine
  // No Tier 1 'EXACT': stableKey completo (data|signed|memo).
  // No Tier 2 'FUZZY': weakKey (data|signed) — memo divergia entre ERP e banco.
  matchKey: string
  confidence: MatchConfidence
  /** só em FRONTEIRA_DIA: de que dia pra que dia o banco moveu (pra tela SUGERIR com nome) */
  deslocamento?: { de: string; para: string }
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
  // Subconjunto de `matched` onde a tx do DB é PREVIEW (PAYABLE/RECEIVABLE) e a
  // linha real do extrato casou → a preview REALIZOU. Deve ser PROMOVIDA a
  // EFFECTED (não recriada). Fecha o bug de duplicata preview↔real entre imports.
  promoted: MatchedPair[]
  /** ⭐ deslocamentos de dia detectados — a tela nomeia cada um (nunca casa em silêncio) */
  deslocamentosDeDia?: MatchedPair[]
}
