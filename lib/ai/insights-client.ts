// Sprint 5.0.4.0c1 — Cliente Claude pra insights narrativos.
//
// Espelha o padrão de lib/ai-categorizer/claude-client.ts:
// - fetch direto (sem SDK)
// - fetcher INJETÁVEL pra testes
// - timeout configurável (default 30s — Sonnet é mais lento)
// - sanitize errors (API key NUNCA logada)
// - parser JSON robusto
//
// Modelo: claude-sonnet-4-6
// Pricing (Anthropic docs Abr/2026):
//   - Input:  $3.00 / 1M tokens
//   - Output: $15.00 / 1M tokens

import { SYSTEM_PROMPT, buildUserPrompt } from './prompts/monthly-insights'
import type {
  InsightApiResult,
  InsightInputData,
  InsightOutput,
} from './insights-types'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
export const INSIGHTS_MODEL = 'claude-sonnet-4-6'
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_OUTPUT_TOKENS = 2048

// Pricing Sonnet 4.6 (USD por 1M tokens)
const PRICE_INPUT_PER_M_USD = 3.0
const PRICE_OUTPUT_PER_M_USD = 15.0

export type FetchLike = typeof globalThis.fetch

export interface CallInsightsOptions {
  fetcher?: FetchLike
  timeoutMs?: number
  apiKey?: string
  /** Override do modelo pra testes ou rollback de versão */
  model?: string
}

/**
 * Calcula custo em centavos USD × 100 (mesma convenção do AiUsageLog).
 * Ex: $0.015 = 1.5 cents × 100 = 150 (integer)
 */
export function calculateInsightCostCents(input: {
  inputTokens: number
  outputTokens: number
}): number {
  const inputUsd = (input.inputTokens / 1_000_000) * PRICE_INPUT_PER_M_USD
  const outputUsd = (input.outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M_USD
  const totalUsd = inputUsd + outputUsd
  // Centavos × 100 (precisão extra) — Math.round pra evitar float weirdness
  return Math.round(totalUsd * 100 * 100)
}

/**
 * Extrai bloco JSON de uma resposta texto. Regex tolerante: pega o primeiro
 * `{ ... }` que dê parse válido. Robusto contra Claude vazar texto extra
 * (apesar das instruções no prompt).
 */
function extractJsonBlock(text: string): unknown | null {
  const trimmed = text.trim()
  // Tentativa 1: texto é puro JSON
  try {
    return JSON.parse(trimmed)
  } catch {
    /* fallthrough */
  }
  // Tentativa 2: pega bloco `{...}` mais externo
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

/**
 * Validação básica do shape do output. Não usa Zod aqui pra manter lib
 * lean — endpoint valida com Zod antes de persistir.
 */
function isValidInsightOutput(obj: unknown): obj is InsightOutput {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  if (typeof o.resumoExecutivo !== 'string') return false
  if (!Array.isArray(o.destaques)) return false
  if (!Array.isArray(o.recomendacoes)) return false
  for (const d of o.destaques) {
    if (!d || typeof d !== 'object') return false
    const dd = d as Record<string, unknown>
    if (typeof dd.titulo !== 'string') return false
    if (typeof dd.descricao !== 'string') return false
    if (!['alerta', 'positivo', 'atencao'].includes(dd.tipo as string)) return false
  }
  for (const r of o.recomendacoes) {
    if (typeof r !== 'string') return false
  }
  return true
}

export async function callInsightsAPI(
  data: InsightInputData,
  options: CallInsightsOptions = {},
): Promise<InsightApiResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      kind: 'disabled',
      reason: 'ANTHROPIC_API_KEY não configurada no .env',
    }
  }

  const model = options.model ?? INSIGHTS_MODEL
  const fetcher = options.fetcher ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetcher(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(data) }],
      }),
      signal: controller.signal,
    })

    if (resp.status === 429) {
      return { kind: 'rate-limited' }
    }
    if (!resp.ok) {
      // SANITIZE: nunca expor body completo (pode ter trace de API key)
      return {
        kind: 'error',
        status: resp.status,
        message: `Claude API retornou ${resp.status}`,
      }
    }

    const body = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens: number; output_tokens: number }
    }

    const textBlock = body.content?.find((b) => b.type === 'text')
    if (!textBlock || !textBlock.text) {
      return { kind: 'error', message: 'Resposta da IA sem bloco de texto' }
    }

    const parsed = extractJsonBlock(textBlock.text)
    if (!parsed || !isValidInsightOutput(parsed)) {
      return { kind: 'invalid-json', rawText: textBlock.text }
    }

    const usage = body.usage ?? { input_tokens: 0, output_tokens: 0 }
    const costCents = calculateInsightCostCents({
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    })

    return {
      kind: 'success',
      insights: parsed,
      cacheHit: false,
      tokensUsed: {
        input: usage.input_tokens,
        output: usage.output_tokens,
      },
      costCents,
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { kind: 'error', message: 'Timeout ao chamar Claude API' }
    }
    return {
      kind: 'error',
      message: (err as Error).message || 'Erro desconhecido',
    }
  } finally {
    clearTimeout(timer)
  }
}
