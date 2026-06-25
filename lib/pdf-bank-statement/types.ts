// Sprint PDF Extrato Bancário (24/06/2026) — tipos compartilhados.

export interface PdfBankStatementLine {
  /** ISO date (YYYY-MM-DD) — extraído pelo Claude do PDF (formato banco DD/MM/YYYY normalizado) */
  date: string
  /** Descrição/histórico da linha */
  description: string
  /** Valor absoluto positivo */
  amount: number
  /** CREDIT = entrada (+); DEBIT = saída (-) */
  type: 'CREDIT' | 'DEBIT'
  /** Saldo APÓS essa linha (opcional — quando o PDF mostra) */
  balanceAfter?: number
  /** Marcado pela IA como "linha ambígua / revisar" */
  needsReview?: boolean
  /** Nota livre da IA pra essa linha (pode aparecer no tooltip) */
  note?: string
}

export interface PdfBankStatementExtraction {
  /** Saldo inicial declarado no extrato (R$) — null se ausente */
  openingBalance: number | null
  /** Saldo final declarado no extrato (R$) — null se ausente */
  closingBalance: number | null
  /** Linhas de transação extraídas */
  lines: PdfBankStatementLine[]
  /** Período coberto (informativo) — null se ausente */
  periodStart: string | null
  periodEnd: string | null
  /** Qualidade do scan reportada pela IA */
  scanQuality: 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN'
  /** Banco detectado no extrato (Caixa | Banrisul | etc) — informativo */
  detectedBank: string | null
  /** Mensagens da IA pra warnings (qualidade, ambiguidade, etc) */
  notes: string[]
}

export interface PdfBankStatementError {
  code:
    | 'NO_FILE'
    | 'FILE_TOO_LARGE'
    | 'NOT_A_PDF'
    | 'ENCRYPTED_PDF'
    | 'ANTHROPIC_API_KEY_MISSING'
    | 'CLAUDE_TIMEOUT'
    | 'CLAUDE_API_ERROR'
    | 'CLAUDE_INVALID_JSON'
    | 'VALIDATION_FAILED'
    | 'GATE_DISABLED'
  message: string
  details?: unknown
}
