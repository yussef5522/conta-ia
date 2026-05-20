// Sprint 2.4 — lógica do badge "Atualizado há X dias" (puro).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  daysSince,
  freshnessTier,
  freshnessLabel,
} from '@/lib/ofx/format-imports'

const NOW = new Date('2026-05-20T15:00:00Z').getTime()

describe('Badge freshness — integração tier+label', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  function badge(lastImportAt: Date | null) {
    const days = daysSince(lastImportAt)
    const tier = freshnessTier(days)
    return { days, tier, label: freshnessLabel(tier, days) }
  }

  it('nunca importou', () => {
    const b = badge(null)
    expect(b.tier).toBe('never')
    expect(b.label).toBe('Sem extratos')
  })

  it('importou hoje', () => {
    const b = badge(new Date(NOW))
    expect(b.tier).toBe('fresh')
    expect(b.label).toBe('Atualizado hoje')
  })

  it('importou ontem (=1d)', () => {
    const b = badge(new Date(NOW - 86400_000))
    expect(b.tier).toBe('fresh')
    expect(b.label).toBe('Atualizado ontem')
  })

  it('importou há 5 dias', () => {
    const b = badge(new Date(NOW - 5 * 86400_000))
    expect(b.tier).toBe('fresh')
    expect(b.label).toBe('Atualizado há 5 dias')
  })

  it('importou há 15 dias (stale amarelo)', () => {
    const b = badge(new Date(NOW - 15 * 86400_000))
    expect(b.tier).toBe('stale')
    expect(b.label).toBe('Atualizado há 15 dias')
  })

  it('importou há 45 dias (old vermelho)', () => {
    const b = badge(new Date(NOW - 45 * 86400_000))
    expect(b.tier).toBe('old')
    expect(b.label).toBe('Atualize · 45 dias')
  })

  it('fronteira 7→8 dias muda tier fresh→stale', () => {
    expect(badge(new Date(NOW - 7 * 86400_000)).tier).toBe('fresh')
    expect(badge(new Date(NOW - 8 * 86400_000)).tier).toBe('stale')
  })

  it('fronteira 30→31 dias muda tier stale→old', () => {
    expect(badge(new Date(NOW - 30 * 86400_000)).tier).toBe('stale')
    expect(badge(new Date(NOW - 31 * 86400_000)).tier).toBe('old')
  })
})
