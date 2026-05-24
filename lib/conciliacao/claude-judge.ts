// Sprint 4.0.3 — match híbrido com Claude Haiku pra faixa 50-69.
//
// Quando scoreMatch determinístico retorna entre 50-69 ("cinzento"), chamamos
// Claude pra dar boost semântico (0-30 pontos). Cache via AiClaudeCache 24h.
//
// Custo controlado:
//   - Só roda na faixa 50-69 (≥70 já é CONFIRM, <50 já é NO_MATCH)
//   - Cache compartilhado por (companyId, hash(ofx+candidate))
//   - Timeout 8s, falha silenciosa retorna score original

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { isClaudeEnabled } from '@/lib/ai-categorizer/claude-client'
import type { MatchScore, MatchCandidate, OFXTransaction } from './match'

const TIMEOUT_MS = 8_000
const MODEL = 'claude-haiku-4-5-20251001'
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const HYBRID_MIN_SCORE = 50
const HYBRID_MAX_SCORE = 69
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const SYSTEM_PROMPT = `Você é especialista em conciliação bancária brasileira. Recebe 2 transações e decide se representam o MESMO evento financeiro.

Responda APENAS JSON: {"boost": number, "reasoning": "..."}.
  - boost 25-30: certeza alta (mesmo evento, descrições compatíveis, valores idênticos)
  - boost 10-20: provável (uma das partes pode ter normalização diferente)
  - boost 0-5: incerto ou descartar

Considere:
  - Descrições bancárias normalmente são abreviadas/cripticas (ex: "PIX REC X**Y CD" vs "Mensalidade aluno Carlos")
  - Fornecedores brasileiros têm variações (ENERGISA SA vs ENERGISA SP)
  - Datas próximas (±5 dias) são normais por causa de feriados/processamento`

interface ClaudeJudgeOutput {
  boost: number
  reasoning: string
}

export interface ScoreMatchHybridResult extends MatchScore {
  aiBoost?: number
  aiReasoning?: string
  aiCacheHit?: boolean
}

function cacheKey(ofx: OFXTransaction, candidate: MatchCandidate): string {
  const parts = [
    ofx.id,
    candidate.id,
    ofx.amount.toFixed(2),
    candidate.amount.toFixed(2),
    ofx.description.slice(0, 100),
    candidate.description.slice(0, 100),
  ].join('|')
  return createHash('sha256').update(parts).digest('hex').slice(0, 32)
}

async function callClaudeJudge(
  ofx: OFXTransaction,
  candidate: MatchCandidate,
  fetcher: typeof fetch = fetch,
): Promise<ClaudeJudgeOutput | null> {
  if (!isClaudeEnabled()) return null
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const userMessage = `OFX (extrato): "${ofx.description}" — ${ofx.type} R$ ${ofx.amount.toFixed(2)} em ${ofx.date.toISOString().slice(0, 10)}
Candidato (${candidate.lifecycle}): "${candidate.description}" — R$ ${candidate.amount.toFixed(2)} vence ${candidate.dueDate.toISOString().slice(0, 10)}

Mesmo evento financeiro?`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetcher(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })

    if (!res.ok) return null
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    const text = data.content?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as { boost?: unknown; reasoning?: unknown }
    const boost = typeof parsed.boost === 'number' ? Math.max(0, Math.min(30, parsed.boost)) : 0
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 200) : ''
    return { boost, reasoning }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Aplica boost IA SE o score determinístico estiver entre 50-69.
 * Fora dessa faixa, retorna o score original sem mexer.
 *
 * Cache em AiClaudeCache 24h por (companyId, hashOfxCandidate).
 */
export async function applyHybridBoost(
  base: MatchScore,
  ofx: OFXTransaction,
  candidate: MatchCandidate,
  companyId: string,
  options: { fetcher?: typeof fetch } = {},
): Promise<ScoreMatchHybridResult> {
  if (base.score < HYBRID_MIN_SCORE || base.score > HYBRID_MAX_SCORE) {
    return base
  }

  const key = cacheKey(ofx, candidate)

  // Lê cache
  const cached = await prisma.aiClaudeCache.findUnique({
    where: { companyId_cacheKey: { companyId, cacheKey: key } },
  })

  if (cached) {
    const ageMs = Date.now() - cached.updatedAt.getTime()
    if (ageMs <= CACHE_TTL_MS) {
      let parsed: ClaudeJudgeOutput | null = null
      try {
        parsed = JSON.parse(cached.suggestion) as ClaudeJudgeOutput
      } catch {
        parsed = null
      }
      if (parsed) {
        // Incrementa usageCount em background (não bloqueia retorno)
        prisma.aiClaudeCache
          .update({ where: { id: cached.id }, data: { usageCount: { increment: 1 } } })
          .catch(() => {})
        return buildResult(base, parsed, true)
      }
    }
  }

  const judge = await callClaudeJudge(ofx, candidate, options.fetcher)
  if (!judge) return base

  // Grava cache (upsert)
  const suggestion = JSON.stringify(judge)
  await prisma.aiClaudeCache
    .upsert({
      where: { companyId_cacheKey: { companyId, cacheKey: key } },
      update: { suggestion, usageCount: { increment: 1 } },
      create: {
        companyId,
        cacheKey: key,
        description: `Conciliacao judge: ${ofx.description} ↔ ${candidate.description}`.slice(0, 200),
        normalizedKey: key,
        suggestion,
        usageCount: 1,
      },
    })
    .catch(() => {})

  return buildResult(base, judge, false)
}

function buildResult(
  base: MatchScore,
  judge: ClaudeJudgeOutput,
  cacheHit: boolean,
): ScoreMatchHybridResult {
  const boostedScore = Math.min(100, base.score + judge.boost)
  return {
    ...base,
    score: boostedScore,
    reasoning: [...base.reasoning, `IA: ${judge.reasoning} (+${judge.boost}pts)`],
    aiBoost: judge.boost,
    aiReasoning: judge.reasoning,
    aiCacheHit: cacheHit,
  }
}
