// Sprint Cartao Credito PJ (24/06/2026) — Claude Vision orquestrador.
//
// 🛡️ Privacidade: PDF nunca persistido em disco. Logs gravam só hash + metadata.

import { SYSTEM_PROMPT_INVOICE_PJ, buildUserMessageInvoice } from './prompt'
import {
  CreditCardPjExtractError,
  type InvoiceExtraction,
  type InvoiceLine,
  type InvoiceLineKind,
} from './types'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_TIMEOUT_MS = 60_000
const MAX_OUTPUT_TOKENS = 8_000
const MAX_PDF_BYTES = 10 * 1024 * 1024

export type FetchLike = typeof globalThis.fetch

export interface ExtractInvoiceInput {
  pdfBytes: Uint8Array
  fileName: string
}

export interface ExtractInvoiceDeps {
  fetch?: FetchLike
  apiKey?: string
  modelOverride?: string
  timeoutMs?: number
}

export interface ExtractInvoiceResult {
  extraction: InvoiceExtraction
  metrics: {
    durationMs: number
    inputTokens: number
    outputTokens: number
    model: string
    pdfSize: number
  }
}

interface ClaudeApiResponse {
  content: Array<{ type: 'text'; text: string }>
  usage: { input_tokens: number; output_tokens: number }
  model: string
  stop_reason: string
}

export async function extractInvoice(
  input: ExtractInvoiceInput,
  deps: ExtractInvoiceDeps = {},
): Promise<ExtractInvoiceResult> {
  if (input.pdfBytes.length === 0)
    throw new CreditCardPjExtractError('NO_FILE', 'PDF vazio')
  if (input.pdfBytes.length > MAX_PDF_BYTES)
    throw new CreditCardPjExtractError(
      'FILE_TOO_LARGE',
      `PDF muito grande (${(input.pdfBytes.length / 1024 / 1024).toFixed(1)} MB; máximo 10 MB)`,
    )

  const headerSample = new TextDecoder('utf-8', { fatal: false }).decode(
    input.pdfBytes.slice(0, Math.min(2048, input.pdfBytes.length)),
  )
  if (!headerSample.startsWith('%PDF-'))
    throw new CreditCardPjExtractError(
      'NOT_A_PDF',
      'Arquivo não parece ser PDF (sem header %PDF-)',
    )
  if (/\/Encrypt\b/.test(headerSample))
    throw new CreditCardPjExtractError(
      'ENCRYPTED_PDF',
      'PDF protegido por senha. Remova a proteção e tente novamente.',
    )

  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey)
    throw new CreditCardPjExtractError(
      'ANTHROPIC_API_KEY_MISSING',
      'ANTHROPIC_API_KEY não configurada',
    )

  const model = deps.modelOverride ?? process.env.AI_CLAUDE_VISION_MODEL ?? DEFAULT_MODEL
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pdfBase64 = Buffer.from(input.pdfBytes).toString('base64')

  const body = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT_INVOICE_PJ,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: buildUserMessageInvoice() },
        ],
      },
    ],
  }

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  const startMs = Date.now()
  let response: Response
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
    if (err instanceof Error && err.name === 'AbortError')
      throw new CreditCardPjExtractError('CLAUDE_TIMEOUT', 'Timeout Claude Vision')
    throw new CreditCardPjExtractError('CLAUDE_API_ERROR', 'Falha de rede Claude')
  }
  clearTimeout(timeoutHandle)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[credit-card-pj] api error', {
      status: response.status,
      preview: errorText.slice(0, 200),
    })
    throw new CreditCardPjExtractError('CLAUDE_API_ERROR', `Claude API ${response.status}`)
  }

  const apiData = (await response.json()) as ClaudeApiResponse
  const text = apiData.content?.[0]?.text ?? ''

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(text))
  } catch {
    console.error('[credit-card-pj] invalid json', { preview: text.slice(0, 200) })
    throw new CreditCardPjExtractError('CLAUDE_INVALID_JSON', 'JSON inválido da Claude')
  }

  return {
    extraction: coerceInvoiceExtraction(parsed),
    metrics: {
      durationMs: Date.now() - startMs,
      inputTokens: apiData.usage?.input_tokens ?? 0,
      outputTokens: apiData.usage?.output_tokens ?? 0,
      model: apiData.model ?? model,
      pdfSize: input.pdfBytes.length,
    },
  }
}

function extractJsonBlock(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return text.trim()
  return text.slice(start, end + 1)
}

const VALID_KINDS: ReadonlySet<InvoiceLineKind> = new Set([
  'COMPRA_AVISTA',
  'COMPRA_PARCELADA',
  'ENCARGO_FINANCEIRO',
  'IGNORAR',
])

export function coerceInvoiceExtraction(raw: unknown): InvoiceExtraction {
  const r = (raw ?? {}) as Record<string, unknown>
  const linesRaw = Array.isArray(r.lines) ? r.lines : []
  const lines: InvoiceLine[] = []
  for (const item of linesRaw) {
    const line = coerceLine(item)
    if (line) lines.push(line)
  }

  return {
    dueDate: stringOrNull(r.dueDate),
    closingDate: stringOrNull(r.closingDate),
    totalDeclared: numberOrNull(r.totalDeclared),
    creditLimit: numberOrNull(r.creditLimit),
    availableLimit: numberOrNull(r.availableLimit),
    detectedBank: stringOrNull(r.detectedBank),
    cardLastDigitsFound: Array.isArray(r.cardLastDigitsFound)
      ? r.cardLastDigitsFound
          .filter((v) => v !== null && v !== undefined)
          .map((v) => String(v).trim())
          .filter((s) => /^\d{2,6}$/.test(s))
      : [],
    scanQuality: coerceScanQuality(r.scanQuality),
    lines,
    notes: Array.isArray(r.notes)
      ? r.notes
          .filter((n) => n !== null && n !== undefined)
          .map((n) => String(n).trim())
          .filter((n) => n.length > 0)
      : [],
  }
}

function coerceLine(raw: unknown): InvoiceLine | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const date = stringOrNull(o.date)
  const description = stringOrNull(o.description)
  const amount = numberOrNull(o.amount)
  const kindRaw = String(o.suggestedKind ?? '').toUpperCase().replace(/-/g, '_')
  const kind = VALID_KINDS.has(kindRaw as InvoiceLineKind)
    ? (kindRaw as InvoiceLineKind)
    : null

  if (!date || !description || amount === null || kind === null) return null
  if (amount <= 0) return null

  const installmentNumber = numberOrNull(o.installmentNumber)
  const installmentTotal = numberOrNull(o.installmentTotal)
  const cardLastDigitsRaw = stringOrNull(o.cardLastDigits)
  const cardLastDigits =
    cardLastDigitsRaw && /^\d{2,6}$/.test(cardLastDigitsRaw)
      ? cardLastDigitsRaw
      : undefined

  return {
    date,
    description: description.trim(),
    amount,
    suggestedKind: kind,
    installmentNumber:
      installmentNumber !== null && installmentNumber > 0 ? Math.floor(installmentNumber) : undefined,
    installmentTotal:
      installmentTotal !== null && installmentTotal > 0 ? Math.floor(installmentTotal) : undefined,
    cardLastDigits,
    needsReview: o.needsReview === true,
    note: stringOrNull(o.note) ?? undefined,
  }
}

function coerceScanQuality(v: unknown): 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN' {
  const s = String(v ?? '').toUpperCase()
  if (s === 'GOOD' || s === 'FAIR' || s === 'POOR' || s === 'UNKNOWN') return s
  return 'UNKNOWN'
}

function numberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/\./g, '').replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return null
}

function stringOrNull(v: unknown): string | null {
  if (typeof v === 'string') {
    const s = v.trim()
    return s ? s : null
  }
  return null
}
