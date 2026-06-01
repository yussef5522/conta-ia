// Sprint Engine de Assinatura FATIA 1 — funções puras de acesso.

import { describe, expect, test } from 'vitest'
import {
  canAccessFeature,
  computeEffectiveStatus,
  diasRestantesTrial,
  getEffectiveSubscriptionStatus,
  getEmpresaLimit,
  isTrialExpired,
} from '@/lib/subscription/access'

const NOW = new Date('2026-05-31T12:00:00Z')
const FUTURE = new Date('2026-06-14T12:00:00Z') // +14 dias
const PAST = new Date('2026-05-30T12:00:00Z') // -1 dia

describe('getEmpresaLimit', () => {
  test('inicio = 1 empresa', () => expect(getEmpresaLimit('inicio')).toBe(1))
  test('controle = 3 empresas', () => expect(getEmpresaLimit('controle')).toBe(3))
  test('inteligencia = 10 empresas', () => expect(getEmpresaLimit('inteligencia')).toBe(10))
  test('performance = Infinity', () =>
    expect(getEmpresaLimit('performance')).toBe(Number.POSITIVE_INFINITY))
  test('plano desconhecido fallback = 1 (conservador)', () =>
    expect(getEmpresaLimit('nao-existe' as 'inicio')).toBe(1))
})

describe('canAccessFeature("ia")', () => {
  test('inicio = false', () => expect(canAccessFeature('inicio', 'ia')).toBe(false))
  test('controle = false', () => expect(canAccessFeature('controle', 'ia')).toBe(false))
  test('inteligencia = true', () => expect(canAccessFeature('inteligencia', 'ia')).toBe(true))
  test('performance = true', () => expect(canAccessFeature('performance', 'ia')).toBe(true))
})

describe('canAccessFeature multi-empresa', () => {
  test('multi-empresa true desde controle', () => {
    expect(canAccessFeature('inicio', 'multi-empresa')).toBe(false)
    expect(canAccessFeature('controle', 'multi-empresa')).toBe(true)
    expect(canAccessFeature('inteligencia', 'multi-empresa')).toBe(true)
  })
  test('multi-empresa-3 só inteligencia+', () => {
    expect(canAccessFeature('controle', 'multi-empresa-3')).toBe(false)
    expect(canAccessFeature('inteligencia', 'multi-empresa-3')).toBe(true)
  })
  test('multi-empresa-10 só performance', () => {
    expect(canAccessFeature('inteligencia', 'multi-empresa-10')).toBe(false)
    expect(canAccessFeature('performance', 'multi-empresa-10')).toBe(true)
  })
})

describe('isTrialExpired', () => {
  test('TRIAL + trialEndsAt no futuro → false', () => {
    expect(isTrialExpired({ status: 'TRIAL', trialEndsAt: FUTURE }, NOW)).toBe(false)
  })
  test('TRIAL + trialEndsAt no passado → true', () => {
    expect(isTrialExpired({ status: 'TRIAL', trialEndsAt: PAST }, NOW)).toBe(true)
  })
  test('ACTIVE → false (não importa data)', () => {
    expect(isTrialExpired({ status: 'ACTIVE', trialEndsAt: PAST }, NOW)).toBe(false)
  })
  test('GRANTED → false (sempre)', () => {
    expect(isTrialExpired({ status: 'GRANTED', trialEndsAt: null }, NOW)).toBe(false)
  })
  test('respeita o now injetado', () => {
    const futureNow = new Date('2026-12-31T00:00:00Z')
    expect(isTrialExpired({ status: 'TRIAL', trialEndsAt: FUTURE }, futureNow)).toBe(true)
  })
  test('TRIAL sem trialEndsAt → false (edge defensivo)', () => {
    expect(isTrialExpired({ status: 'TRIAL', trialEndsAt: null }, NOW)).toBe(false)
  })
})

describe('computeEffectiveStatus (derivação lazy)', () => {
  test('TRIAL ativo permanece TRIAL', () => {
    expect(
      computeEffectiveStatus(
        { status: 'TRIAL', planId: 'inteligencia', trialEndsAt: FUTURE },
        NOW,
      ),
    ).toBe('TRIAL')
  })
  test('TRIAL passou vira EXPIRED', () => {
    expect(
      computeEffectiveStatus(
        { status: 'TRIAL', planId: 'inteligencia', trialEndsAt: PAST },
        NOW,
      ),
    ).toBe('EXPIRED')
  })
  test('GRANTED nunca expira (não importa data)', () => {
    expect(
      computeEffectiveStatus(
        { status: 'GRANTED', planId: 'inteligencia', trialEndsAt: PAST },
        NOW,
      ),
    ).toBe('GRANTED')
  })
  test('ACTIVE não é modificado', () => {
    expect(
      computeEffectiveStatus(
        { status: 'ACTIVE', planId: 'inteligencia', trialEndsAt: null },
        NOW,
      ),
    ).toBe('ACTIVE')
  })
  test('CANCELED não é modificado', () => {
    expect(
      computeEffectiveStatus(
        { status: 'CANCELED', planId: 'inteligencia', trialEndsAt: null },
        NOW,
      ),
    ).toBe('CANCELED')
  })
})

describe('diasRestantesTrial', () => {
  test('TRIAL +14d → 14 dias', () => {
    expect(diasRestantesTrial({ status: 'TRIAL', trialEndsAt: FUTURE }, NOW)).toBe(14)
  })
  test('TRIAL +0.5d → 1 dia (ceil)', () => {
    const meioDia = new Date(NOW.getTime() + 12 * 60 * 60 * 1000)
    expect(diasRestantesTrial({ status: 'TRIAL', trialEndsAt: meioDia }, NOW)).toBe(1)
  })
  test('TRIAL passado → 0 (clamp, não negativo)', () => {
    expect(diasRestantesTrial({ status: 'TRIAL', trialEndsAt: PAST }, NOW)).toBe(0)
  })
  test('ACTIVE → null', () => {
    expect(diasRestantesTrial({ status: 'ACTIVE', trialEndsAt: FUTURE }, NOW)).toBe(null)
  })
  test('GRANTED → null', () => {
    expect(diasRestantesTrial({ status: 'GRANTED', trialEndsAt: null }, NOW)).toBe(null)
  })
})

describe('getEffectiveSubscriptionStatus (compostor)', () => {
  test('TRIAL ativo retorna shape completo', () => {
    const r = getEffectiveSubscriptionStatus(
      { status: 'TRIAL', planId: 'inteligencia', trialEndsAt: FUTURE },
      NOW,
    )
    expect(r.rawStatus).toBe('TRIAL')
    expect(r.effectiveStatus).toBe('TRIAL')
    expect(r.isExpired).toBe(false)
    expect(r.diasRestantesTrial).toBe(14)
    expect(r.planId).toBe('inteligencia')
  })
  test('TRIAL passou tem rawStatus=TRIAL mas effective=EXPIRED', () => {
    const r = getEffectiveSubscriptionStatus(
      { status: 'TRIAL', planId: 'inteligencia', trialEndsAt: PAST },
      NOW,
    )
    expect(r.rawStatus).toBe('TRIAL')
    expect(r.effectiveStatus).toBe('EXPIRED')
    expect(r.isExpired).toBe(true)
  })
})
