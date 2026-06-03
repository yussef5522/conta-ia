// Sprint PF Fatia 3 — keyword-pf detector PF.

import { describe, expect, test } from 'vitest'
import {
  detectKeywordPf,
  KEYWORDS_PF,
  KEYWORD_PF_CONFIDENCE,
} from '@/lib/ai-categorizer/keyword-pf'

describe('detectKeywordPf — categorias do OFX Nubank real', () => {
  test('"Apple.Com/Bill" → Lazer (Apple)', () => {
    const r = detectKeywordPf('Apple.Com/Bill')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Lazer')
    expect(r.confidence).toBe(KEYWORD_PF_CONFIDENCE)
  })

  test('"Claude.Ai Subscription" → Educação', () => {
    const r = detectKeywordPf('Claude.Ai Subscription')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Educação')
  })

  test('"Airbnb * Hm9z23za5s" → Lazer', () => {
    const r = detectKeywordPf('Airbnb * Hm9z23za5s')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Lazer')
  })

  test('"Laghetto Golden" → Lazer', () => {
    const r = detectKeywordPf('Laghetto Golden')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Lazer')
  })

  test('"Mercadolivre*Rgs" → Outros', () => {
    const r = detectKeywordPf('Mercadolivre*Rgs')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Outros')
  })

  test('"Netflix" → Lazer', () => {
    const r = detectKeywordPf('Netflix')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Lazer')
  })

  test('"Spotify" → Lazer', () => {
    const r = detectKeywordPf('Spotify')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Lazer')
  })

  test('"Posto Pitangueira" → Transporte', () => {
    const r = detectKeywordPf('Posto Pitangueira')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Transporte')
  })

  test('"iFood Restaurante" → Alimentação', () => {
    const r = detectKeywordPf('iFood Restaurante')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Alimentação')
  })
})

describe('detectKeywordPf — não-match', () => {
  test('description vazia → não-match', () => {
    expect(detectKeywordPf('').matched).toBe(false)
  })

  test('"Lojinha desconhecida" → não-match', () => {
    expect(detectKeywordPf('Lojinha desconhecida da esquina').matched).toBe(false)
  })

  test('"Super Duda" SEM match palavra "supermercado" → match palavra "super"', () => {
    // Boundary: "super" como palavra (Super Duda — Super é início de palavra)
    const r = detectKeywordPf('Super Duda')
    expect(r.matched).toBe(true)
    expect(r.entry?.personalCategoryHint).toBe('Alimentação')
  })
})

describe('catalog integridade', () => {
  test('todas as keywords têm displayName + personalCategoryHint', () => {
    for (const k of KEYWORDS_PF) {
      expect(k.keyword.length).toBeGreaterThan(0)
      expect(k.displayName.length).toBeGreaterThan(0)
      expect(k.personalCategoryHint.length).toBeGreaterThan(0)
    }
  })

  test('categoria hints cobrem o plano padrão (mínimo 8 distintas)', () => {
    const hints = new Set(KEYWORDS_PF.map((k) => k.personalCategoryHint))
    expect(hints.size).toBeGreaterThanOrEqual(8)
  })

  test('≥ 40 keywords cadastradas', () => {
    expect(KEYWORDS_PF.length).toBeGreaterThanOrEqual(40)
  })
})
