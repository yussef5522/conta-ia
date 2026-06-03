// Sprint PF Fatia 3.5 — Tipos compartilhados.

export type ScanQuality =
  | 'DIGITAL'        // gerado por software (texto vetorial, alta precisão)
  | 'SCANNED_HIGH'   // escaneado bem (precisão razoável)
  | 'SCANNED_LOW'    // escaneado ruim/torto (alerta forte)
  | 'MOBILE_PHOTO'   // foto de celular — REJEITAR (Yussef decisão 8)
  | 'UNKNOWN'

export interface PdfExtractedTx {
  fitid: string         // sintético: PDF-<date>-<short-merchant>-<amount>
  date: string          // ISO YYYY-MM-DD
  amount: number        // sempre positivo
  type: 'CREDIT' | 'DEBIT'
  memo: string
  /** Confidence específica desta linha (0-1) */
  lineConfidence: number
  /** Marca compra internacional (IOF, conversão visível, "Compra Internacional") */
  isInternational?: boolean
  /** Valor em moeda original (se internacional) */
  originalCurrency?: string
  originalAmount?: number
}

export interface PdfExtractResult {
  detectedBank: string | null    // "Nubank" | "Itaú" | "Bradesco" | ...
  scanQuality: ScanQuality
  closingDate: string | null     // ISO
  dueDate: string | null
  /** Total visível no PDF (footer "Total da fatura") */
  declaredTotal: number | null
  /** Soma das transações extraídas — calculado pela IA */
  extractedSum: number | null
  /** Contador declarado pelo banco ("15 lançamentos") */
  declaredTxCount: number | null
  /** Confidence GLOBAL — agrega validações soma=total, count, scan */
  confidence: number
  /** Últimos 4 dígitos do cartão (NUNCA o número completo) */
  detectedCardLast4: string | null
  transactions: PdfExtractedTx[]
  warnings: string[]
  /** Modelo Claude usado — auditoria */
  modelVersion: string
  /** Token telemetria — alimenta AiUsageLog */
  inputTokens: number
  outputTokens: number
  costCentsUsdX100: number
}

export type ExtractErrorCode =
  | 'PDF_TOO_LARGE'
  | 'PDF_TOO_MANY_PAGES'
  | 'PDF_ENCRYPTED'
  | 'PDF_INVALID'
  | 'IS_PHOTO_REJECTED'   // MOBILE_PHOTO ou SCANNED_LOW + sem confidence
  | 'CLAUDE_API_ERROR'
  | 'CLAUDE_INVALID_JSON'
  | 'CLAUDE_TIMEOUT'
  | 'CLAUDE_RATE_LIMITED'
  | 'VALIDATION_FAILED'

export class PdfExtractError extends Error {
  constructor(message: string, readonly code: ExtractErrorCode) {
    super(message)
    this.name = 'PdfExtractError'
  }
}
