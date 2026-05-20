// Sprint 2.3 — helpers puros de formatação de imports OFX.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  importStatusLabel,
  importStatusColor,
  formatFileSize,
  formatPeriod,
  daysSince,
  freshnessTier,
  freshnessLabel,
  freshnessColor,
} from '@/lib/ofx/format-imports'

describe('importStatusLabel', () => {
  it('4 status traduzidos', () => {
    expect(importStatusLabel('PROCESSING')).toBe('Processando')
    expect(importStatusLabel('SUCCESS')).toBe('Concluído')
    expect(importStatusLabel('FAILED')).toBe('Falhou')
    expect(importStatusLabel('REVERTED')).toBe('Revertido')
  })

  it('fallback retorna a string', () => {
    expect(importStatusLabel('FOO')).toBe('FOO')
  })
})

describe('importStatusColor', () => {
  it('SUCCESS=emerald, FAILED=rose, REVERTED=amber, PROCESSING=blue', () => {
    expect(importStatusColor('SUCCESS').text).toContain('emerald')
    expect(importStatusColor('FAILED').text).toContain('rose')
    expect(importStatusColor('REVERTED').text).toContain('amber')
    expect(importStatusColor('PROCESSING').text).toContain('blue')
  })
})

describe('formatFileSize', () => {
  it('bytes < 1KB', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('KB com 1 casa', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('MB com 2 casas', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.50 MB')
  })
})

describe('formatPeriod', () => {
  it('mesmo dia retorna só uma data (sem arrow)', () => {
    const d = new Date('2026-05-15T15:00:00Z')
    const out = formatPeriod(d, d)
    expect(out).not.toContain('→')
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('range mostra → arrow', () => {
    expect(
      formatPeriod(new Date('2026-04-01'), new Date('2026-04-30')),
    ).toContain('→')
  })

  it('null retorna —', () => {
    expect(formatPeriod(null, null)).toBe('—')
    expect(formatPeriod(new Date(), null)).toBe('—')
  })
})

describe('daysSince', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>
  const NOW = new Date('2026-05-20T12:00:00Z').getTime()

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    nowSpy.mockRestore()
  })

  it('null = nunca', () => {
    expect(daysSince(null)).toBe(null)
  })

  it('mesmo dia = 0', () => {
    expect(daysSince(new Date(NOW))).toBe(0)
  })

  it('7 dias atrás = 7', () => {
    expect(daysSince(new Date(NOW - 7 * 86400_000))).toBe(7)
  })
})

describe('freshnessTier', () => {
  it('null = never', () => {
    expect(freshnessTier(null)).toBe('never')
  })

  it('≤7 = fresh', () => {
    expect(freshnessTier(0)).toBe('fresh')
    expect(freshnessTier(7)).toBe('fresh')
  })

  it('8-30 = stale', () => {
    expect(freshnessTier(8)).toBe('stale')
    expect(freshnessTier(30)).toBe('stale')
  })

  it('>30 = old', () => {
    expect(freshnessTier(31)).toBe('old')
    expect(freshnessTier(365)).toBe('old')
  })
})

describe('freshnessLabel', () => {
  it('never → "Sem extratos"', () => {
    expect(freshnessLabel('never', null)).toBe('Sem extratos')
  })

  it('hoje', () => {
    expect(freshnessLabel('fresh', 0)).toBe('Atualizado hoje')
  })

  it('ontem', () => {
    expect(freshnessLabel('fresh', 1)).toBe('Atualizado ontem')
  })

  it('old vira "Atualize"', () => {
    expect(freshnessLabel('old', 45)).toBe('Atualize · 45 dias')
  })
})

describe('freshnessColor', () => {
  it('4 tiers retornam cores', () => {
    for (const t of ['fresh', 'stale', 'old', 'never'] as const) {
      const c = freshnessColor(t)
      expect(c.bg).toBeTruthy()
      expect(c.text).toBeTruthy()
      expect(c.dot).toBeTruthy()
    }
  })

  it('fresh é emerald, old é rose', () => {
    expect(freshnessColor('fresh').dot).toBe('bg-emerald-500')
    expect(freshnessColor('old').dot).toBe('bg-rose-500')
  })
})
