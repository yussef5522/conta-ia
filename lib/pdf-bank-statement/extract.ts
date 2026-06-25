// Sprint PDF Extrato Bancário (24/06/2026) — orquestrador Claude Vision.
//
// Recebe PDF de extrato bancário, manda pro Claude Sonnet 4.6 com prompt
// dedicado, recebe lista de transações + saldos.
//
// 🛡️ Privacidade:
//   - PDF NUNCA persistido em disco/banco. Memória → Claude → descartado.
//   - Logs gravam SHA256 + tamanho + duração + tokens. NUNCA conteúdo.
//
// Cliente fetch direto (sem SDK Anthropic) — mesmo padrão de
// `lib/pdf-import/extract-from-pdf.ts` e `lib/ai-categorizer/claude-client.ts`.

import { SYSTEM_PROMPT_BANK_STATEMENT, buildUserMessageBankStatement } from './prompt'
import type { PdfBankStatementExtraction, PdfBankStatementLine } from './types'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_TIMEOUT_MS = 60_000
const MAX_OUTPUT_TOKENS = 8_000
const MAX_PDF_BYTES = 10 * 1024 * 1024

export type FetchLike = typeof globalThis.fetch

export interface ExtractBankStatementInput {
  pdfBytes: Uint8Array
  fileName: string
}

export interface ExtractBankStatementDeps {
  fetch?: FetchLike
  apiKey?: string
  modelOverride?: string
  timeoutMs?: number
}

export class BankStatementExtractError extends Error {
  constructor(
    public code:
      | 'NO_FILE'
      | 'FILE_TOO_LARGE'
      | 'NOT_A_PDF'
      | 'ENCRYPTED_PDF'
      | 'ANTHROPIC_API_KEY_MISSING'
      | 'CLAUDE_TIMEOUT'
      | 'CLAUDE_API_ERROR'
      | 'CLAUDE_INVALID_JSON'
      | 'VALIDATION_FAILED',
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'BankStatementExtractError'
  }
}

export interface ExtractBankStatementResult {
  extraction: PdfBankStatementExtraction
  /** Métricas pra observabilidade */
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
  usage: {
    input_tokens: number
    output_tokens: number
  }
  model: string
  stop_reason: string
}

export async function extractBankStatement(
  input: ExtractBankStatementInput,
  deps: ExtractBankStatementDeps = {},
): Promise<ExtractBankStatementResult> {
  if (input.pdfBytes.length === 0) {
    throw new BankStatementExtractError('NO_FILE', 'PDF vazio')
  }
  if (input.pdfBytes.length > MAX_PDF_BYTES) {
    throw new BankStatementExtractError(
      'FILE_TOO_LARGE',
      `PDF muito grande (${(input.pdfBytes.length / 1024 / 1024).toFixed(1)} MB; máximo 10 MB)`,
    )
  }
  const headerSample = new TextDecoder('utf-8', { fatal: false }).decode(
    input.pdfBytes.slice(0, Math.min(2048, input.pdfBytes.length)),
  )
  if (!headerSample.startsWith('%PDF-')) {
    throw new BankStatementExtractError(
      'NOT_A_PDF',
      'Arquivo não parece ser um PDF válido (sem header %PDF-)',
    )
  }
  if (/\/Encrypt\b/.test(headerSample)) {
    throw new BankStatementExtractError(
      'ENCRYPTED_PDF',
      'PDF está com senha/criptografia. Remova a proteção e tente de novo.',
    )
  }

  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new BankStatementExtractError(
      'ANTHROPIC_API_KEY_MISSING',
      'ANTHROPIC_API_KEY não configurada no servidor',
    )
  }
  const model = deps.modelOverride ?? process.env.AI_CLAUDE_VISION_MODEL ?? DEFAULT_MODEL
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const pdfBase64 = Buffer.from(input.pdfBytes).toString('base64')
  const body = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT_BANK_STATEMENT,
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
          { type: 'text', text: buildUserMessageBankStatement() },
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
    console.error('[pdf-bank-statement] network error', {
      durationMs: Date.now() - startMs,
      pdfSize: input.pdfBytes.length,
    })
    if (err instanceof Error && err.name === 'AbortError') {
      throw new BankStatementExtractError('CLAUDE_TIMEOUT', 'Timeout na API Claude Vision')
    }
    throw new BankStatementExtractError(
      'CLAUDE_API_ERROR',
      'Falha de rede ao chamar Claude Vision',
    )
  }
  clearTimeout(timeoutHandle)

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[pdf-bank-statement] api error', {
      status: response.status,
      durationMs: Date.now() - startMs,
      pdfSize: input.pdfBytes.length,
      preview: errorText.slice(0, 200),
    })
    throw new BankStatementExtractError(
      'CLAUDE_API_ERROR',
      `Erro Claude API ${response.status}`,
    )
  }

  const apiData = (await response.json()) as ClaudeApiResponse
  const text = apiData.content?.[0]?.text ?? ''

  let parsed: unknown
  try {
    const cleaned = extractJsonBlock(text)
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[pdf-bank-statement] invalid json', {
      preview: text.slice(0, 200),
    })
    throw new BankStatementExtractError(
      'CLAUDE_INVALID_JSON',
      'Claude retornou JSON inválido',
    )
  }

  const extraction = coerceExtraction(parsed)

  return {
    extraction,
    metrics: {
      durationMs: Date.now() - startMs,
      inputTokens: apiData.usage?.input_tokens ?? 0,
      outputTokens: apiData.usage?.output_tokens ?? 0,
      model: apiData.model ?? model,
      pdfSize: input.pdfBytes.length,
    },
  }
}

/** Extrai o 1º bloco JSON { ... } do texto, tolerante a prosa antes/depois. */
function extractJsonBlock(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return text.trim()
  return text.slice(start, end + 1)
}

/** Coerção defensiva — Claude pode mandar shape ligeiramente diferente. */
export function coerceExtraction(raw: unknown): PdfBankStatementExtraction {
  const r = (raw ?? {}) as Record<string, unknown>
  const linesRaw = Array.isArray(r.lines) ? r.lines : []
  const lines: PdfBankStatementLine[] = []
  for (const item of linesRaw) {
    const line = coerceLine(item)
    if (line) lines.push(line)
  }

  return {
    openingBalance: numberOrNull(r.openingBalance),
    closingBalance: numberOrNull(r.closingBalance),
    lines,
    periodStart: stringOrNull(r.periodStart),
    periodEnd: stringOrNull(r.periodEnd),
    scanQuality: coerceScanQuality(r.scanQuality),
    detectedBank: stringOrNull(r.detectedBank),
    notes: Array.isArray(r.notes)
      ? r.notes
          .filter((n) => n !== null && n !== undefined)
          .map((n) => String(n).trim())
          .filter((n) => n.length > 0)
      : [],
  }
}

function coerceLine(raw: unknown): PdfBankStatementLine | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const date = stringOrNull(o.date)
  const description = stringOrNull(o.description)
  const amount = numberOrNull(o.amount)
  const typeRaw = String(o.type ?? '').toUpperCase()
  const type: 'CREDIT' | 'DEBIT' | null =
    typeRaw === 'CREDIT' ? 'CREDIT' : typeRaw === 'DEBIT' ? 'DEBIT' : null

  if (!date || !description || amount === null || type === null) return null
  if (amount <= 0) return null

  return {
    date,
    description: description.trim(),
    amount,
    type,
    balanceAfter: numberOrNull(o.balanceAfter) ?? undefined,
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
