// Sprint Asaas 3C — Funções puras do webhook.

import { describe, expect, test } from 'vitest'
import {
  validateAsaasToken,
  parseExternalReference,
  calculateNextPeriodEnd,
  routeEvent,
} from '@/lib/asaas/webhook'

// ============================================================
// validateAsaasToken — timingSafeEqual + edges
// ============================================================
describe('validateAsaasToken', () => {
  test('aceita tokens idênticos', () => {
    const t = 'a'.repeat(64)
    expect(validateAsaasToken(t, t)).toBe(true)
  })

  test('rejeita tokens diferentes do mesmo tamanho', () => {
    expect(validateAsaasToken('a'.repeat(64), 'b'.repeat(64))).toBe(false)
  })

  test('rejeita tokens de tamanhos diferentes (não chama timingSafeEqual)', () => {
    expect(validateAsaasToken('abc', 'abcd')).toBe(false)
  })

  test('rejeita received vazio', () => {
    expect(validateAsaasToken('', 'expected')).toBe(false)
  })

  test('rejeita expected vazio', () => {
    expect(validateAsaasToken('received', '')).toBe(false)
  })

  test('rejeita ambos null/undefined', () => {
    expect(validateAsaasToken(null, null)).toBe(false)
    expect(validateAsaasToken(undefined, undefined)).toBe(false)
    expect(validateAsaasToken(null, 'x')).toBe(false)
    expect(validateAsaasToken('x', null)).toBe(false)
  })

  test('case-sensitive', () => {
    expect(validateAsaasToken('ABC123', 'abc123')).toBe(false)
  })

  test('tokens com chars não-ASCII funcionam (UTF-8 buffer)', () => {
    expect(validateAsaasToken('tókén-çú', 'tókén-çú')).toBe(true)
    expect(validateAsaasToken('tókén-çú', 'token-cu')).toBe(false)
  })
})

// ============================================================
// parseExternalReference
// ============================================================
describe('parseExternalReference', () => {
  test('parse cartão MONTHLY', () => {
    const r = parseExternalReference('user:cmp123|plan:inteligencia|ciclo:MONTHLY')
    expect(r).toEqual({
      userId: 'cmp123',
      planId: 'inteligencia',
      ciclo: 'MONTHLY',
    })
  })

  test('parse cartão YEARLY', () => {
    const r = parseExternalReference('user:abc|plan:performance|ciclo:YEARLY')
    expect(r).toEqual({
      userId: 'abc',
      planId: 'performance',
      ciclo: 'YEARLY',
    })
  })

  test('parse Pix com dias', () => {
    const r = parseExternalReference(
      'user:cmp123|plan:inteligencia|ciclo:MONTHLY|dias:30',
    )
    expect(r).toEqual({
      userId: 'cmp123',
      planId: 'inteligencia',
      ciclo: 'MONTHLY',
      dias: 30,
    })
  })

  test('parse Pix YEARLY com 365 dias', () => {
    const r = parseExternalReference(
      'user:u|plan:p|ciclo:YEARLY|dias:365',
    )
    expect(r?.dias).toBe(365)
  })

  test('retorna null pra null/undefined/empty', () => {
    expect(parseExternalReference(null)).toBe(null)
    expect(parseExternalReference(undefined)).toBe(null)
    expect(parseExternalReference('')).toBe(null)
  })

  test('retorna null se faltar user', () => {
    expect(
      parseExternalReference('plan:inteligencia|ciclo:MONTHLY'),
    ).toBe(null)
  })

  test('retorna null se faltar plan', () => {
    expect(parseExternalReference('user:abc|ciclo:MONTHLY')).toBe(null)
  })

  test('retorna null se faltar ciclo', () => {
    expect(parseExternalReference('user:abc|plan:p')).toBe(null)
  })

  test('retorna null pra ciclo inválido', () => {
    expect(
      parseExternalReference('user:abc|plan:p|ciclo:WEEKLY'),
    ).toBe(null)
  })

  test('retorna null pra dias não-positivo', () => {
    expect(
      parseExternalReference('user:abc|plan:p|ciclo:MONTHLY|dias:0'),
    ).toBe(null)
    expect(
      parseExternalReference('user:abc|plan:p|ciclo:MONTHLY|dias:-1'),
    ).toBe(null)
    expect(
      parseExternalReference('user:abc|plan:p|ciclo:MONTHLY|dias:abc'),
    ).toBe(null)
  })

  test('retorna null pra segmento sem ":"', () => {
    expect(
      parseExternalReference('user:abc|plan:p|ciclo:MONTHLY|brokenSegment'),
    ).toBe(null)
  })

  test('retorna null pra segmento com key vazia', () => {
    expect(parseExternalReference(':abc|plan:p|ciclo:MONTHLY')).toBe(null)
  })

  test('aceita user id com caracteres especiais (cuid)', () => {
    const r = parseExternalReference(
      'user:cmpvhxcb700042i0zsiu64f95|plan:inteligencia|ciclo:MONTHLY',
    )
    expect(r?.userId).toBe('cmpvhxcb700042i0zsiu64f95')
  })
})

// ============================================================
// calculateNextPeriodEnd
// ============================================================
describe('calculateNextPeriodEnd', () => {
  const ref = new Date(Date.UTC(2026, 5, 1, 12, 0, 0)) // 02/06/2026 12:00 UTC

  test('MONTHLY: current null → now + 1 mês', () => {
    const r = calculateNextPeriodEnd(null, 'MONTHLY', ref)
    expect(r.getUTCMonth()).toBe(6) // julho
    expect(r.getUTCDate()).toBe(1)
  })

  test('YEARLY: current null → now + 12 meses', () => {
    const r = calculateNextPeriodEnd(null, 'YEARLY', ref)
    expect(r.getUTCFullYear()).toBe(2027)
    expect(r.getUTCMonth()).toBe(5)
    expect(r.getUTCDate()).toBe(1)
  })

  test('MONTHLY: current passado → now + 1 mês (não retrocede)', () => {
    const past = new Date(Date.UTC(2025, 0, 1))
    const r = calculateNextPeriodEnd(past, 'MONTHLY', ref)
    expect(r.getUTCFullYear()).toBe(2026)
    expect(r.getUTCMonth()).toBe(6) // julho
    expect(r.getTime()).toBeGreaterThan(ref.getTime())
  })

  test('MONTHLY: current futuro → current + 1 mês (renovação acumulativa)', () => {
    const future = new Date(Date.UTC(2026, 6, 15)) // 15/jul
    const r = calculateNextPeriodEnd(future, 'MONTHLY', ref)
    expect(r.getUTCMonth()).toBe(7) // agosto
    expect(r.getUTCDate()).toBe(15)
  })

  test('YEARLY: current futuro → current + 12 meses', () => {
    const future = new Date(Date.UTC(2027, 0, 1))
    const r = calculateNextPeriodEnd(future, 'YEARLY', ref)
    expect(r.getUTCFullYear()).toBe(2028)
    expect(r.getUTCMonth()).toBe(0)
  })

  test('MONTHLY: 31/jan → 28/fev (clamp último dia)', () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31))
    const r = calculateNextPeriodEnd(
      jan31,
      'MONTHLY',
      new Date(Date.UTC(2025, 11, 1)), // muito antes
    )
    expect(r.getUTCMonth()).toBe(1) // fev
    expect(r.getUTCDate()).toBe(28) // não 31, não pula pra março
  })

  test('YEARLY: 29/fev bissexto → 28/fev ano não-bissexto', () => {
    const feb29Leap = new Date(Date.UTC(2024, 1, 29))
    const r = calculateNextPeriodEnd(
      feb29Leap,
      'YEARLY',
      new Date(Date.UTC(2023, 0, 1)),
    )
    expect(r.getUTCFullYear()).toBe(2025)
    expect(r.getUTCMonth()).toBe(1) // fev
    expect(r.getUTCDate()).toBe(28) // clampou
  })

  test('MONTHLY: preserva hora/minuto', () => {
    const d = new Date(Date.UTC(2026, 5, 15, 14, 30, 45, 123))
    const r = calculateNextPeriodEnd(d, 'MONTHLY', new Date(Date.UTC(2025, 0, 1)))
    expect(r.getUTCHours()).toBe(14)
    expect(r.getUTCMinutes()).toBe(30)
    expect(r.getUTCSeconds()).toBe(45)
  })
})

// ============================================================
// routeEvent
// ============================================================
describe('routeEvent', () => {
  test('PAYMENT_CONFIRMED → ACTIVATE', () => {
    expect(routeEvent('PAYMENT_CONFIRMED')).toBe('ACTIVATE')
  })

  test('PAYMENT_RECEIVED → ACTIVATE', () => {
    expect(routeEvent('PAYMENT_RECEIVED')).toBe('ACTIVATE')
  })

  test('PAYMENT_OVERDUE → PAST_DUE', () => {
    expect(routeEvent('PAYMENT_OVERDUE')).toBe('PAST_DUE')
  })

  test('PAYMENT_CHARGEBACK_REQUESTED → PAST_DUE (não cancela imediato)', () => {
    expect(routeEvent('PAYMENT_CHARGEBACK_REQUESTED')).toBe('PAST_DUE')
  })

  test('PAYMENT_REFUNDED → CANCEL', () => {
    expect(routeEvent('PAYMENT_REFUNDED')).toBe('CANCEL')
  })

  test('PAYMENT_DELETED → CANCEL', () => {
    expect(routeEvent('PAYMENT_DELETED')).toBe('CANCEL')
  })

  test('PAYMENT_CREATED → IGNORE', () => {
    expect(routeEvent('PAYMENT_CREATED')).toBe('IGNORE')
  })

  test('PAYMENT_UPDATED → IGNORE', () => {
    expect(routeEvent('PAYMENT_UPDATED')).toBe('IGNORE')
  })

  test('SUBSCRIPTION_CREATED → IGNORE', () => {
    expect(routeEvent('SUBSCRIPTION_CREATED')).toBe('IGNORE')
  })

  test('SUBSCRIPTION_DELETED → IGNORE', () => {
    expect(routeEvent('SUBSCRIPTION_DELETED')).toBe('IGNORE')
  })

  test('SUBSCRIPTION_INACTIVATED → IGNORE', () => {
    expect(routeEvent('SUBSCRIPTION_INACTIVATED')).toBe('IGNORE')
  })

  test('evento desconhecido (forward-compat) → IGNORE', () => {
    expect(routeEvent('SOMETHING_FUTURE_ASAAS_ADDED')).toBe('IGNORE')
  })

  test('string vazia → IGNORE (defensivo)', () => {
    expect(routeEvent('')).toBe('IGNORE')
  })
})
