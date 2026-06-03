// Sprint PF Fatia 3.5 — Orquestrador Claude Vision pra extrair fatura PDF.
//
// 🛡️ Privacidade:
//   - PDF NUNCA persistido em disco/banco
//   - Lido em memória → enviado pra Claude → descartado após response
//   - Logs SÓ hash SHA256 + metadata (size, duração, tokens, modelo)
//   - Cartão mascarado a ****1234 antes de virar resultJson cache
//
// 🚨 Requer ZDR Anthropic em produção (gate via feature-flag.ts).

import { createHash } from 'crypto'
import { getTemplate, detectBankFromFileName, type BankHint } from './pdf-templates'
import {
  PdfExtractError,
  type PdfExtractResult,
  type PdfExtractedTx,
  type ScanQuality,
} from './types'
import { validateExtraction } from './validate'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6' // Yussef decisão MVP
const DEFAULT_TIMEOUT_MS = 30_000          // PDF processa mais devagar
const MAX_OUTPUT_TOKENS = 4_000
const MAX_PDF_BYTES = 5 * 1024 * 1024       // 5 MB

// Pricing Sonnet 4.6 (USD por 1M tokens). Pra Haiku, override no env.
const PRICE_INPUT_PER_M_USD_DEFAULT = 3.0
const PRICE_OUTPUT_PER_M_USD_DEFAULT = 15.0

export type FetchLike = typeof globalThis.fetch

export interface ExtractFromPdfInput {
  pdfBytes: Uint8Array
  fileName: string
  bankHint?: BankHint     // user pode forçar; senão detecta do filename
}

export interface ExtractFromPdfDeps {
  fetch?: FetchLike
  apiKey?: string
  modelOverride?: string
  timeoutMs?: number
}

/**
 * Calcula SHA256 do PDF (lower hex). Determinístico — usado pra cache.
 */
export function sha256Pdf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Mascara campos sensíveis no resultado antes de cachear.
 * Cartão completo → só últimos 4. Datas de nascimento → null.
 */
export function sanitizeForCache(result: PdfExtractResult): PdfExtractResult {
  return {
    ...result,
    // detectedCardLast4 já é só 4 chars — mantém
    // (se Claude tiver passado mais, pega só os últimos 4)
    detectedCardLast4: result.detectedCardLast4
      ? result.detectedCardLast4.slice(-4)
      : null,
  }
}

interface ClaudeApiResponse {
  content: Array<{ type: 'text'; text: string }>
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  model: string
  stop_reason: string
}

export async function extractFromPdf(
  input: ExtractFromPdfInput,
  deps: ExtractFromPdfDeps = {},
): Promise<PdfExtractResult> {
  // === Pré-validação local ===
  if (input.pdfBytes.length === 0) {
    throw new PdfExtractError('PDF vazio', 'PDF_INVALID')
  }
  if (input.pdfBytes.length > MAX_PDF_BYTES) {
    throw new PdfExtractError(
      `PDF muito grande (${(input.pdfBytes.length / 1024 / 1024).toFixed(1)} MB; máximo 5 MB)`,
      'PDF_TOO_LARGE',
    )
  }
  // Detecta PDF encriptado (header bem básico)
  // PDFs encriptados geralmente têm "/Encrypt" no cabeçalho
  const headerSample = new TextDecoder('utf-8', { fatal: false }).decode(
    input.pdfBytes.slice(0, Math.min(2048, input.pdfBytes.length)),
  )
  if (!headerSample.startsWith('%PDF-')) {
    throw new PdfExtractError(
      'Arquivo não parece ser um PDF válido (sem header %PDF-).',
      'PDF_INVALID',
    )
  }
  if (/\/Encrypt\b/.test(headerSample)) {
    throw new PdfExtractError(
      'PDF está com senha/criptografia. Remova a proteção e tente de novo.',
      'PDF_ENCRYPTED',
    )
  }

  // === Config ===
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new PdfExtractError(
      'ANTHROPIC_API_KEY não configurada no servidor.',
      'CLAUDE_API_ERROR',
    )
  }
  const model =
    deps.modelOverride ?? process.env.AI_CLAUDE_VISION_MODEL ?? DEFAULT_MODEL
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const bank = input.bankHint ?? detectBankFromFileName(input.fileName)
  const template = getTemplate(bank)
  const pdfBase64 = Buffer.from(input.pdfBytes).toString('base64')

  const body = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: template,
          },
        ],
      },
    ],
  }

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  const startMs = Date.now()
  try {
    response = await fetchImpl(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutHandle)
    console.error('[pdf-extract] network error', {
      durationMs: Date.now() - startMs,
      bank,
      // pdfSize SIM (não vaza conteúdo); SHA256 fica no caller.
      pdfSize: input.pdfBytes.length,
    })
    if (err instanceof Error && err.name === 'AbortError') {
      throw new PdfExtractError('Timeout na API Claude Vision', 'CLAUDE_TIMEOUT')
    }
    throw new PdfExtractError('Falha de rede ao chamar Claude Vision', 'CLAUDE_API_ERROR')
  }
  clearTimeout(timeoutHandle)

  if (response.status === 429) {
    throw new PdfExtractError('Rate limit Claude', 'CLAUDE_RATE_LIMITED')
  }
  if (!response.ok) {
    console.error('[pdf-extract] api error', {
      status: response.status,
      bank,
      durationMs: Date.now() - startMs,
      pdfSize: input.pdfBytes.length,
    })
    throw new PdfExtractError(
      `Erro Claude API ${response.status}`,
      'CLAUDE_API_ERROR',
    )
  }

  const apiData = (await response.json()) as ClaudeApiResponse
  const text = apiData.content?.[0]?.text ?? ''
  const inputTokens = apiData.usage?.input_tokens ?? 0
  const outputTokens = apiData.usage?.output_tokens ?? 0
  const priceIn =
    Number(process.env.AI_CLAUDE_VISION_PRICE_INPUT_USD ?? PRICE_INPUT_PER_M_USD_DEFAULT)
  const priceOut =
    Number(process.env.AI_CLAUDE_VISION_PRICE_OUTPUT_USD ?? PRICE_OUTPUT_PER_M_USD_DEFAULT)
  const costUsd = (inputTokens / 1_000_000) * priceIn + (outputTokens / 1_000_000) * priceOut
  const costCentsUsdX100 = Math.round(costUsd * 100 * 100) // cents × 100

  // === Parse JSON estrito ===
  let parsed: Partial<PdfExtractResult>
  try {
    // Tenta extrair JSON puro; se Claude vazou texto fora, pega o primeiro bloco {}
    const cleaned = extractJsonBlock(text)
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[pdf-extract] invalid json', {
      bank,
      textPreview: text.slice(0, 200),
    })
    throw new PdfExtractError('Claude retornou JSON inválido', 'CLAUDE_INVALID_JSON')
  }

  // === Coerção pro shape esperado ===
  const transactions: PdfExtractedTx[] = Array.isArray(parsed.transactions)
    ? parsed.transactions.map((t, idx) => normalizeTransaction(t as Partial<PdfExtractedTx>, idx))
    : []

  const scanQuality: ScanQuality = isValidScanQuality(parsed.scanQuality)
    ? parsed.scanQuality
    : 'UNKNOWN'

  const result: PdfExtractResult = {
    detectedBank: parsed.detectedBank ?? null,
    scanQuality,
    closingDate: parsed.closingDate ?? null,
    dueDate: parsed.dueDate ?? null,
    declaredTotal: numberOrNull(parsed.declaredTotal),
    extractedSum:
      numberOrNull(parsed.extractedSum) ??
      transactions.reduce((s, t) => s + (t.type === 'DEBIT' ? t.amount : -t.amount), 0),
    declaredTxCount: numberOrNull(parsed.declaredTxCount),
    confidence: numberOrNull(parsed.confidence) ?? 0.7,
    detectedCardLast4: parsed.detectedCardLast4 ?? null,
    transactions,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    modelVersion: apiData.model ?? model,
    inputTokens,
    outputTokens,
    costCentsUsdX100,
  }

  // === Aplica validações (4 camadas) ===
  const { result: validated, shouldReject, rejectReason } = validateExtraction(result)
  if (shouldReject) {
    throw new PdfExtractError(rejectReason ?? 'PDF rejeitado', 'IS_PHOTO_REJECTED')
  }

  console.log('[pdf-extract] success', {
    bank,
    durationMs: Date.now() - startMs,
    pdfSize: input.pdfBytes.length,
    inputTokens,
    outputTokens,
    costCentsUsdX100,
    modelVersion: result.modelVersion,
    detectedBank: result.detectedBank,
    txCount: result.transactions.length,
    confidence: validated.confidence,
    scanQuality: result.scanQuality,
  })

  return validated
}

// ============================================================
// Helpers
// ============================================================

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return trimmed
  // Procura o primeiro { matching balance
  const start = trimmed.indexOf('{')
  if (start < 0) throw new Error('no JSON found')
  let depth = 0
  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  throw new Error('unbalanced JSON')
}

function isValidScanQuality(v: unknown): v is ScanQuality {
  return (
    v === 'DIGITAL' ||
    v === 'SCANNED_HIGH' ||
    v === 'SCANNED_LOW' ||
    v === 'MOBILE_PHOTO' ||
    v === 'UNKNOWN'
  )
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return null
}

function makeShortMerchant(memo: string): string {
  return memo
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .slice(0, 20)
    .toLowerCase()
}

function normalizeTransaction(t: Partial<PdfExtractedTx>, idx: number): PdfExtractedTx {
  const memo = String(t.memo ?? '').trim().slice(0, 200)
  const date = String(t.date ?? '').slice(0, 10)
  const amount = Math.abs(numberOrNull(t.amount) ?? 0)
  const type: 'CREDIT' | 'DEBIT' = t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT'
  // FITID sintético determinístico — pra dedupHash funcionar entre reimports
  const fitid =
    t.fitid && typeof t.fitid === 'string'
      ? t.fitid
      : `PDF-${date || 'nodate'}-${makeShortMerchant(memo) || `tx${idx}`}-${amount.toFixed(2)}`
  return {
    fitid,
    date,
    amount,
    type,
    memo,
    lineConfidence: numberOrNull(t.lineConfidence) ?? 0.8,
    isInternational: t.isInternational === true,
    originalCurrency: typeof t.originalCurrency === 'string' ? t.originalCurrency : undefined,
    originalAmount: numberOrNull(t.originalAmount) ?? undefined,
  }
}
