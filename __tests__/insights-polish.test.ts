// Testes do polish do Dia 5: tooltip-copy + carousel-threshold + dev demo schema.

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  getDetectorTooltip,
  TOOLTIP_COPY_KEYS,
} from '@/lib/insights/tooltip-copy'
import {
  shouldUseCarousel,
  CAROUSEL_MIN_INSIGHTS,
} from '@/lib/insights/carousel-threshold'
import { REGISTERED_DETECTORS } from '@/lib/insights/compute-insights'

// ============================================================
// tooltip-copy
// ============================================================

describe('getDetectorTooltip — Sprint 2 Dia 5', () => {
  it('retorna copy específica pra cada detector conhecido', () => {
    expect(getDetectorTooltip('pending-classifications')).toContain(
      'Identifiquei',
    )
    expect(getDetectorTooltip('large-uncategorized')).toContain('R$ 5.000')
    expect(getDetectorTooltip('high-overdraft-usage')).toMatch(/70%/)
    expect(getDetectorTooltip('burn-rate-spike')).toMatch(/30%/)
    expect(getDetectorTooltip('duplicate-subscriptions')).toMatch(
      /Levenshtein/i,
    )
    expect(getDetectorTooltip('concentration-risk')).toMatch(
      /atrasar pagamento/i,
    )
    expect(getDetectorTooltip('revenue-growth')).toMatch(/20%/)
  })

  it('fallback amigável pra detector ainda sem copy mapeada', () => {
    const fb = getDetectorTooltip('detector-futuro-inexistente')
    expect(fb).toBeTruthy()
    expect(fb.length).toBeGreaterThan(10)
    expect(fb).toMatch(/IA Insights|motor/i)
  })

  it('cobre TODOS os 7 detectors registrados em compute-insights', () => {
    // Garantia de que cada detector NOVO precise adicionar copy aqui.
    // IDs vêm da convenção: detector emite Insight.id = nome do detector.
    const REGISTERED_IDS = [
      'pending-classifications',
      'high-overdraft-usage',
      'burn-rate-spike',
      'large-uncategorized',
      'concentration-risk',
      'revenue-growth',
      'duplicate-subscriptions',
    ]
    expect(REGISTERED_DETECTORS).toHaveLength(7)
    for (const id of REGISTERED_IDS) {
      expect(TOOLTIP_COPY_KEYS).toContain(id)
    }
  })

  it('REFINO 1 — pending-classifications usa voz da IA "Identifiquei"', () => {
    const copy = getDetectorTooltip('pending-classifications')
    expect(copy).toContain('Identifiquei')
    expect(copy).toContain('refletem a realidade do seu negócio')
  })

  it('REFINO 2 — concentration-risk menciona dor real do empresário BR', () => {
    const copy = getDetectorTooltip('concentration-risk')
    expect(copy).toContain('atrasar pagamento')
    expect(copy).toContain('Diversificar reduz')
  })
})

// ============================================================
// carousel-threshold
// ============================================================

describe('shouldUseCarousel — Sprint 2 Dia 5', () => {
  it('NÃO ativa em desktop, qualquer count', () => {
    expect(shouldUseCarousel(10, 'desktop')).toBe(false)
    expect(shouldUseCarousel(1, 'desktop')).toBe(false)
  })

  it('ativa em mobile com count ≥ 4', () => {
    expect(shouldUseCarousel(4, 'mobile')).toBe(true)
    expect(shouldUseCarousel(7, 'mobile')).toBe(true)
  })

  it('NÃO ativa em mobile com count ≤ 3 (empilhado é mais legível)', () => {
    expect(shouldUseCarousel(3, 'mobile')).toBe(false)
    expect(shouldUseCarousel(2, 'mobile')).toBe(false)
    expect(shouldUseCarousel(0, 'mobile')).toBe(false)
  })

  it('threshold constante exposto = 4', () => {
    expect(CAROUSEL_MIN_INSIGHTS).toBe(4)
  })
})

// ============================================================
// demoInsights schema — replicação do schema do page.tsx
// (testa o contrato de validação isolado, sem precisar montar Next request)
// ============================================================

describe('demoInsights schema — dev only', () => {
  // Replica do server schema; manter em sincronia se page.tsx mudar.
  const demoInsightsSchema = z.coerce.number().int().min(0).max(7).catch(0)

  it('aceita 0-7', () => {
    expect(demoInsightsSchema.parse('0')).toBe(0)
    expect(demoInsightsSchema.parse('4')).toBe(4)
    expect(demoInsightsSchema.parse('7')).toBe(7)
  })

  it('clamp acima do max (8 → 0 via catch)', () => {
    expect(demoInsightsSchema.parse('8')).toBe(0)
    expect(demoInsightsSchema.parse('999')).toBe(0)
  })

  it('rejeita injection — qualquer string não-numérica vira 0', () => {
    expect(demoInsightsSchema.parse('abc')).toBe(0)
    expect(demoInsightsSchema.parse('<script>')).toBe(0)
    expect(demoInsightsSchema.parse(undefined)).toBe(0)
    expect(demoInsightsSchema.parse('')).toBe(0)
  })

  it('rejeita negativos e decimais', () => {
    expect(demoInsightsSchema.parse('-1')).toBe(0)
    expect(demoInsightsSchema.parse('3.5')).toBe(0)
  })
})
