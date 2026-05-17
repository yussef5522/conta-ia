// Cache de sugestões Claude — Fase 3 Etapa 3.
// Camada 3 do Pipeline IA Contadora.
//
// Estratégia: sha256(normalizeDescription) → AiClaudeCache. TTL 90 dias.
// Multi-tenant via @@unique [companyId, cacheKey].

import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { normalizeDescription } from './normalize'

export const CACHE_TTL_DAYS = 90
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000

export interface ClaudeSuggestion {
  categoryId: string | null
  confidence: number
  reasoning: string
  alternativeCategoryIds: string[]
}

export interface CachedClaudeSuggestion {
  suggestion: ClaudeSuggestion
  cacheKey: string
  cachedAt: Date
  usageCount: number
  fromCache: true
}

// Função PURA: derive cache key sem precisar de Prisma.
export function computeCacheKey(description: string): string {
  const normalized = normalizeDescription(description)
  return createHash('sha256').update(normalized).digest('hex')
}

// Helper PURO: verifica se um timestamp já expirou contra o TTL.
export function isCacheStale(cachedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - cachedAt.getTime() > CACHE_TTL_MS
}

// Busca cache vigente. Retorna null se não existe OU está expirado.
// Incrementa usageCount em cache hit.
export async function getCachedSuggestion(
  companyId: string,
  description: string,
): Promise<CachedClaudeSuggestion | null> {
  if (!companyId) {
    throw new Error('companyId obrigatório (isolamento multi-tenant)')
  }
  const cacheKey = computeCacheKey(description)

  const row = await prisma.aiClaudeCache.findUnique({
    where: { companyId_cacheKey: { companyId, cacheKey } },
  })
  if (!row) return null
  if (isCacheStale(row.createdAt)) {
    // Stale — deleta e retorna null (caller chama Claude novamente)
    await prisma.aiClaudeCache.delete({ where: { id: row.id } }).catch(() => null)
    return null
  }

  // Incrementa contador (best-effort — não falha o get se update der erro)
  prisma.aiClaudeCache
    .update({ where: { id: row.id }, data: { usageCount: { increment: 1 } } })
    .catch(() => null)

  let parsed: ClaudeSuggestion
  try {
    parsed = JSON.parse(row.suggestion) as ClaudeSuggestion
  } catch {
    // JSON corrompido (improvável) — deleta entrada inválida e retorna miss
    await prisma.aiClaudeCache.delete({ where: { id: row.id } }).catch(() => null)
    return null
  }

  return {
    suggestion: parsed,
    cacheKey,
    cachedAt: row.createdAt,
    usageCount: row.usageCount + 1,
    fromCache: true,
  }
}

// Persiste/atualiza entrada de cache.
// Upsert por (companyId, cacheKey) — sobrescreve quando vence ou Claude muda
// resposta pra mesma descrição (re-treino, prompt diferente, etc).
export async function putCachedSuggestion(
  companyId: string,
  description: string,
  suggestion: ClaudeSuggestion,
): Promise<{ cacheKey: string }> {
  if (!companyId) {
    throw new Error('companyId obrigatório (isolamento multi-tenant)')
  }
  const cacheKey = computeCacheKey(description)
  const normalizedKey = normalizeDescription(description)

  await prisma.aiClaudeCache.upsert({
    where: { companyId_cacheKey: { companyId, cacheKey } },
    create: {
      companyId,
      cacheKey,
      description: description.slice(0, 500),
      normalizedKey: normalizedKey.slice(0, 500),
      suggestion: JSON.stringify(suggestion),
      usageCount: 0,
    },
    update: {
      suggestion: JSON.stringify(suggestion),
      // Reseta createdAt como "fresh" — útil se forçar refresh de cache stale
      createdAt: new Date(),
    },
  })

  return { cacheKey }
}

// Invalida entrada de cache (chamado quando user OVERRIDE sugestão Claude —
// próximo classifyAsync vai re-perguntar ao Claude com novo few-shot).
//
// Multi-tenant: só invalida da empresa do caller.
export async function invalidateCachedSuggestion(
  companyId: string,
  cacheKey: string,
): Promise<boolean> {
  if (!companyId || !cacheKey) return false
  const result = await prisma.aiClaudeCache
    .deleteMany({ where: { companyId, cacheKey } })
    .catch(() => ({ count: 0 }))
  return result.count > 0
}
