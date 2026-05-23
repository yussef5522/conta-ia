// Sprint 3.0.2 A4 — helpers do badge IA.

import { describe, it, expect } from 'vitest'
import {
  formatConfidence,
  confidenceTier,
} from '@/components/transacoes/ai-source-badge'

describe('formatConfidence', () => {
  it('null/undefined → null', () => {
    expect(formatConfidence(null)).toBeNull()
    expect(formatConfidence(undefined)).toBeNull()
  })

  it('arredonda pra inteiro percentual', () => {
    expect(formatConfidence(0.95)).toBe('95%')
    expect(formatConfidence(0.756)).toBe('76%')
    expect(formatConfidence(1.0)).toBe('100%')
    expect(formatConfidence(0.0)).toBe('0%')
  })
})

describe('confidenceTier', () => {
  it('null/undefined → null', () => {
    expect(confidenceTier(null)).toBeNull()
    expect(confidenceTier(undefined)).toBeNull()
  })

  it('≥0.9 = high', () => {
    expect(confidenceTier(0.9)).toBe('high')
    expect(confidenceTier(0.95)).toBe('high')
    expect(confidenceTier(1.0)).toBe('high')
  })

  it('0.7-0.89 = medium', () => {
    expect(confidenceTier(0.7)).toBe('medium')
    expect(confidenceTier(0.8)).toBe('medium')
    expect(confidenceTier(0.89)).toBe('medium')
  })

  it('<0.7 = low', () => {
    expect(confidenceTier(0.69)).toBe('low')
    expect(confidenceTier(0.5)).toBe('low')
    expect(confidenceTier(0.0)).toBe('low')
  })
})
