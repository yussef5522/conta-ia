// Sprint 5.0.2.q — ConfidenceSignal helper tiers.

import { describe, it, expect } from 'vitest'
import { confidenceTier } from '@/components/pendentes/ConfidenceSignal'

describe('confidenceTier', () => {
  it('≥ 0.85 → high', () => {
    expect(confidenceTier(0.85)).toBe('high')
    expect(confidenceTier(0.95)).toBe('high')
    expect(confidenceTier(1.0)).toBe('high')
  })

  it('0.70 a 0.84 → mid', () => {
    expect(confidenceTier(0.7)).toBe('mid')
    expect(confidenceTier(0.84)).toBe('mid')
  })

  it('< 0.70 → low', () => {
    expect(confidenceTier(0.69)).toBe('low')
    expect(confidenceTier(0.5)).toBe('low')
    expect(confidenceTier(0)).toBe('low')
  })

  it('thresholds são exclusivos no topo, inclusivos no bottom', () => {
    expect(confidenceTier(0.8499999)).toBe('mid')
    expect(confidenceTier(0.6999999)).toBe('low')
  })
})
