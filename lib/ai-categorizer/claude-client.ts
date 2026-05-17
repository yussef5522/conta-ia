// Cliente Claude API — Fase 3 Etapa 3.
// Camada 3 do Pipeline IA Contadora.
//
// Endpoint: POST https://api.anthropic.com/v1/messages
// Modelo padrão: claude-haiku-4-5-20251001 (sobrescrito via AI_CLAUDE_MODEL env).
//
// Estratégia:
//   - Timeout 10s (não pode travar UI)
//   - fetch INJETÁVEL (testes mockam sem API real)
//   - Sanitize errors (NUNCA expõe API key em logs)
//   - Parse JSON estrito (regex extrai bloco { } se Claude vazar texto extra)
//
// Custo (Haiku 4.5):
//   - Input: $1 / 1M tokens
//   - Output: $5 / 1M tokens

import {
  buildUserMessage,
  CLAUDE_SYSTEM_PROMPT,
  type BuildUserMessageInput,
} from './claude-prompt'
import type { ClaudeSuggestion } from './claude-cache'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_OUTPUT_TOKENS = 400

// Pricing Haiku 4.5 (USD por 1M tokens) — cents = $/100
const PRICE_INPUT_PER_M_USD = 1.0
const PRICE_OUTPUT_PER_M_USD = 5.0

export type FetchLike = typeof globalThis.fetch

export type ClaudeApiResult =
  | {
      kind: 'success'
      suggestion: ClaudeSuggestion
      inputTokens: number
      outputTokens: number
      costCents: number
      modelVersion: string
    }
  | { kind: 'disabled'; reason: string }
  | { kind: 'rate-limited' } // 429 da Anthropic (não rate limit local)
  | { kind: 'timeout' }
  | { kind: 'invalid-json'; rawText: string }
  | { kind: 'error'; status?: number; message: string }

export interface CallClaudeOptions {
  // Permite mock em testes (default global.fetch)
  fetcher?: FetchLike
  // Override de timeout (default 10s)
  timeoutMs?: number
  // Override de API key (default process.env.ANTHROPIC_API_KEY)
  apiKey?: string
  // Override de modelo (default process.env.AI_CLAUDE_MODEL ?? haiku-4-5)
  model?: string
  // Pra testes: força o flag enabled (default lê AI_CLAUDE_ENABLED)
  enabled?: boolean
}

export function isClaudeEnabled(): boolean {
  if (process.env.AI_CLAUDE_ENABLED === 'false') return false
  if (!process.env.ANTHROPIC_API_KEY) return false
  return true
}

export async function callClaude(
  input: BuildUserMessageInput,
  options: CallClaudeOptions = {},
): Promise<ClaudeApiResult> {
  const enabled = options.enabled ?? isClaudeEnabled()
  if (!enabled) {
    return {
      kind: 'disabled',
      reason: !process.env.ANTHROPIC_API_KEY
        ? 'ANTHROPIC_API_KEY não configurada'
        : 'AI_CLAUDE_ENABLED=false',
    }
  }

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { kind: 'disabled', reason: 'ANTHROPIC_API_KEY ausente' }
  }

  const model =
    options.model ?? process.env.AI_CLAUDE_MODEL ?? DEFAULT_MODEL
  const fetcher = options.fetcher ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const userMessage = buildUserMessage(input)

  const body = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: CLAUDE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetcher(CLAUDE_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    })
    clearTimeout(timer)

    if (res.status === 429) {
      return { kind: 'rate-limited' }
    }
    if (!res.ok) {
      // NÃO faça throw da response body inteira — pode vazar info sensitiva
      return {
        kind: 'error',
        status: res.status,
        message: `Claude API retornou ${res.status}`,
      }
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens: number; output_tokens: number }
      model?: string
    }

    const rawText = data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''
    if (!rawText) {
      return { kind: 'invalid-json', rawText: '' }
    }

    const parsed = parseSuggestionJSON(rawText)
    if (!parsed) {
      return { kind: 'invalid-json', rawText }
    }

    const inputTokens = data.usage?.input_tokens ?? 0
    const outputTokens = data.usage?.output_tokens ?? 0
    const costCents = computeCostCents(inputTokens, outputTokens)

    return {
      kind: 'success',
      suggestion: parsed,
      inputTokens,
      outputTokens,
      costCents,
      modelVersion: data.model ?? model,
    }
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') {
      return { kind: 'timeout' }
    }
    // Sanitize: nunca incluir headers/body na mensagem (pode ter API key)
    return {
      kind: 'error',
      message: err instanceof Error ? err.name + ' durante request' : 'Erro desconhecido',
    }
  }
}

// Calcula custo em centavos USD (1 cent = 1% USD).
// Mantém INTEGER no banco (sem floats) → divisão por 100 só na exibição.
export function computeCostCents(
  inputTokens: number,
  outputTokens: number,
): number {
  const inputUsd = (inputTokens / 1_000_000) * PRICE_INPUT_PER_M_USD
  const outputUsd = (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M_USD
  const totalUsd = inputUsd + outputUsd
  // Round até centavos (1 USD = 100 cents). Mínimo 0 — Math.round arredonda.
  return Math.round(totalUsd * 100)
}

// Parse robusto: aceita JSON puro OU JSON dentro de bloco markdown.
// Garante shape esperado (categoryId, confidence, reasoning, alternativeCategoryIds).
export function parseSuggestionJSON(text: string): ClaudeSuggestion | null {
  if (!text) return null
  // Tenta extrair bloco JSON. Claude pode vazar ```json...``` ou texto antes.
  let candidate = text.trim()

  // Remove fences markdown
  const codeBlockMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    candidate = codeBlockMatch[1].trim()
  }

  // Encontra primeiro { até último } válido
  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) return null
  candidate = candidate.slice(firstBrace, lastBrace + 1)

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>

  const categoryId =
    obj.categoryId === null || typeof obj.categoryId === 'string'
      ? (obj.categoryId as string | null)
      : null
  const confidence =
    typeof obj.confidence === 'number' && obj.confidence >= 0 && obj.confidence <= 1
      ? obj.confidence
      : 0
  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : ''
  const alternativeCategoryIds = Array.isArray(obj.alternativeCategoryIds)
    ? (obj.alternativeCategoryIds.filter(
        (x) => typeof x === 'string',
      ) as string[])
    : []

  return {
    categoryId,
    confidence,
    reasoning: reasoning.slice(0, 500),
    alternativeCategoryIds: alternativeCategoryIds.slice(0, 5),
  }
}
