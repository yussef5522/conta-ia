// Sprint 2.1 — helpers puros de UI de regras.

import { describe, it, expect } from 'vitest'
import {
  matchTypeLabel,
  matchTypeColor,
  confidenceTier,
  confidenceLabel,
  confidencePercent,
  confidenceColors,
  fonteLabel,
} from '@/lib/regras/format'

describe('matchTypeLabel', () => {
  it('rotula 4 tipos', () => {
    expect(matchTypeLabel('EXACT')).toBe('Exato')
    expect(matchTypeLabel('CONTAINS')).toBe('Contém')
    expect(matchTypeLabel('CNPJ')).toBe('CNPJ')
    expect(matchTypeLabel('NORMALIZED')).toBe('Normalizado')
  })

  it('fallback retorna a string crua', () => {
    expect(matchTypeLabel('FOO')).toBe('FOO')
  })
})

describe('matchTypeColor', () => {
  it('cada tipo retorna bg+text', () => {
    for (const t of ['EXACT', 'CONTAINS', 'CNPJ', 'NORMALIZED']) {
      const c = matchTypeColor(t)
      expect(c.bg).toBeTruthy()
      expect(c.text).toBeTruthy()
    }
  })

  it('fallback retorna cor cinza', () => {
    expect(matchTypeColor('UNKNOWN').text).toContain('a3a3a3')
  })
})

describe('confidenceTier', () => {
  it('≥0.9 = high', () => {
    expect(confidenceTier(0.9)).toBe('high')
    expect(confidenceTier(1.0)).toBe('high')
  })

  it('0.7-0.89 = medium', () => {
    expect(confidenceTier(0.7)).toBe('medium')
    expect(confidenceTier(0.89)).toBe('medium')
  })

  it('<0.7 = low', () => {
    expect(confidenceTier(0.5)).toBe('low')
    expect(confidenceTier(0.0)).toBe('low')
  })
})

describe('confidenceLabel / confidencePercent', () => {
  it('label em português', () => {
    expect(confidenceLabel(0.95)).toBe('Alta')
    expect(confidenceLabel(0.75)).toBe('Média')
    expect(confidenceLabel(0.50)).toBe('Baixa')
  })

  it('percent arredonda pra inteiro', () => {
    expect(confidencePercent(0.95)).toBe('95%')
    expect(confidencePercent(0.756)).toBe('76%')
    expect(confidencePercent(1.0)).toBe('100%')
  })
})

describe('confidenceColors', () => {
  it('high é verde', () => {
    expect(confidenceColors(0.95).text).toContain('emerald')
  })

  it('medium é amber', () => {
    expect(confidenceColors(0.75).text).toContain('amber')
  })

  it('low é zinc/cinza', () => {
    expect(confidenceColors(0.5).text).toContain('zinc')
  })
})

describe('fonteLabel', () => {
  it('CLAUDE → IA', () => {
    expect(fonteLabel('CLAUDE')).toBe('IA')
  })

  it('default → Manual', () => {
    expect(fonteLabel('MANUAL')).toBe('Manual')
    expect(fonteLabel('FOO')).toBe('Manual')
  })
})
