// Sprint PF Fatia 3 — detector assinaturas recorrentes.

import { describe, expect, test } from 'vitest'
import {
  detectRecurringSubscriptions,
  normalizeMerchant,
} from '@/lib/ai-categorizer/detect-recurring'

function makeTx(date: string, description: string, amount: number) {
  return {
    date: new Date(date),
    amount,
    description,
    type: 'DEBIT' as const,
  }
}

describe('normalizeMerchant', () => {
  test('"Airbnb * Hm9z23za5s - Parcela 5/6" → "airbnb"', () => {
    expect(normalizeMerchant('Airbnb * Hm9z23za5s - Parcela 5/6')).toBe('airbnb')
  })

  test('"Mercadolivre*Rgs" → "mercadolivre"', () => {
    expect(normalizeMerchant('Mercadolivre*Rgs')).toBe('mercadolivre')
  })

  test('"Apple.Com/Bill" → preserva nome + remove pontuação', () => {
    const r = normalizeMerchant('Apple.Com/Bill')
    expect(r).toContain('apple')
  })

  test('"Compra (3/12)" remove sufixo de parcela', () => {
    expect(normalizeMerchant('Loja Top (3/12)')).toBe('loja top')
  })
})

describe('detectRecurringSubscriptions', () => {
  test('Netflix 3 meses mesmo valor → recurring', () => {
    const txs = [
      makeTx('2026-06-05', 'Netflix', 55.9),
      makeTx('2026-07-05', 'Netflix', 55.9),
      makeTx('2026-08-05', 'Netflix', 55.9),
    ]
    const r = detectRecurringSubscriptions(txs)
    expect(r.length).toBe(1)
    expect(r[0].monthsActive).toBe(3)
    expect(r[0].avgAmount).toBe(55.9)
    expect(r[0].txCount).toBe(3)
  })

  test('Apple 2 meses → NÃO recurring (< minMonths)', () => {
    const txs = [
      makeTx('2026-07-05', 'Apple.com/Bill', 24.9),
      makeTx('2026-08-05', 'Apple.com/Bill', 24.9),
    ]
    const r = detectRecurringSubscriptions(txs)
    expect(r.length).toBe(0)
  })

  test('valor varia >15% → NÃO recurring', () => {
    const txs = [
      makeTx('2026-06-05', 'Restaurante X', 50),
      makeTx('2026-07-05', 'Restaurante X', 80), // varia muito
      makeTx('2026-08-05', 'Restaurante X', 120),
    ]
    const r = detectRecurringSubscriptions(txs)
    expect(r.length).toBe(0)
  })

  test('mesmo mês não conta duas vezes', () => {
    const txs = [
      makeTx('2026-06-05', 'Netflix', 55.9),
      makeTx('2026-06-25', 'Netflix', 55.9), // mesmo mês
      makeTx('2026-07-05', 'Netflix', 55.9),
      makeTx('2026-08-05', 'Netflix', 55.9),
    ]
    const r = detectRecurringSubscriptions(txs)
    expect(r.length).toBe(1)
    expect(r[0].monthsActive).toBe(3)
  })

  test('CREDIT filtrado (não conta como assinatura)', () => {
    const txs = [
      { ...makeTx('2026-06-05', 'Cashback', 10), type: 'CREDIT' as const },
      { ...makeTx('2026-07-05', 'Cashback', 10), type: 'CREDIT' as const },
      { ...makeTx('2026-08-05', 'Cashback', 10), type: 'CREDIT' as const },
    ]
    const r = detectRecurringSubscriptions(txs)
    expect(r.length).toBe(0)
  })

  test('múltiplas assinaturas ordenadas por impacto', () => {
    const txs = [
      makeTx('2026-06-05', 'Netflix', 55.9),
      makeTx('2026-07-05', 'Netflix', 55.9),
      makeTx('2026-08-05', 'Netflix', 55.9),
      makeTx('2026-06-10', 'Spotify', 21.9),
      makeTx('2026-07-10', 'Spotify', 21.9),
      makeTx('2026-08-10', 'Spotify', 21.9),
    ]
    const r = detectRecurringSubscriptions(txs)
    expect(r.length).toBe(2)
    // Netflix tem impacto maior
    expect(r[0].displayName.toLowerCase()).toContain('netflix')
  })

  test('predictedNextDate é aproximadamente +1 mês do lastSeen', () => {
    const txs = [
      makeTx('2026-06-05', 'Netflix', 55.9),
      makeTx('2026-07-05', 'Netflix', 55.9),
      makeTx('2026-08-05', 'Netflix', 55.9),
    ]
    const r = detectRecurringSubscriptions(txs)
    const days = (r[0].predictedNextDate.getTime() - r[0].lastSeenAt.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThanOrEqual(28)
    expect(days).toBeLessThanOrEqual(32)
  })
})
