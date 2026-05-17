// Claude cache helpers (PUROS) — Fase 3 Etapa 3.
// Cobre o que NÃO depende do Prisma (key + staleness). Integração com DB
// é coberta indiretamente pelos testes do pipeline + smoke prod.

import { describe, it, expect } from 'vitest'
import {
  computeCacheKey,
  isCacheStale,
  CACHE_TTL_DAYS,
} from '@/lib/ai-categorizer/claude-cache'

describe('computeCacheKey — determinístico via sha256(normalize)', () => {
  it('mesma descrição → mesma key', () => {
    const k1 = computeCacheKey('VIVO FATURA 05/2026')
    const k2 = computeCacheKey('VIVO FATURA 05/2026')
    expect(k1).toBe(k2)
  })

  it('normalize de strip prefix gera mesma key (nome próprio variável)', () => {
    const k1 = computeCacheKey('FABIO UECKER - Pix | Maquininha')
    const k2 = computeCacheKey('Marcyelle - Pix | Maquininha')
    // ambas normalizam para "pix | maquininha"
    expect(k1).toBe(k2)
  })

  it('normalize remove data → mesma key', () => {
    const k1 = computeCacheKey('PAGAMENTO BOLETO 12/05')
    const k2 = computeCacheKey('PAGAMENTO BOLETO 13/06')
    expect(k1).toBe(k2)
  })

  it('keys diferentes pra descrições genuinamente diferentes', () => {
    const k1 = computeCacheKey('PAGAMENTO TITULO')
    const k2 = computeCacheKey('PIX ENVIADO')
    expect(k1).not.toBe(k2)
  })

  it('output é hex de 64 chars (sha256)', () => {
    const k = computeCacheKey('teste')
    expect(k).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('isCacheStale — TTL 90 dias', () => {
  it('cache fresco (< TTL) → não stale', () => {
    const cachedAt = new Date('2026-05-01T00:00:00Z')
    const now = new Date('2026-05-30T00:00:00Z') // 29 dias
    expect(isCacheStale(cachedAt, now)).toBe(false)
  })

  it('cache no exato TTL → não stale (limite estrito)', () => {
    const cachedAt = new Date('2026-01-01T00:00:00Z')
    const now = new Date(
      cachedAt.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
    )
    expect(isCacheStale(cachedAt, now)).toBe(false)
  })

  it('cache 1 ms após TTL → stale', () => {
    const cachedAt = new Date('2026-01-01T00:00:00Z')
    const now = new Date(
      cachedAt.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000 + 1,
    )
    expect(isCacheStale(cachedAt, now)).toBe(true)
  })

  it('TTL constante exposto = 90 dias', () => {
    expect(CACHE_TTL_DAYS).toBe(90)
  })
})
