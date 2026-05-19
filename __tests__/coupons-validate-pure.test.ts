// Lógica PURA de decisão de validade — Sprint 1.7.

import { describe, it, expect } from 'vitest'
import {
  decideCouponValidity,
  reasonToUserMessage,
} from '@/lib/coupons/validate'

const NOW = new Date('2026-05-19T12:00:00Z')

function base() {
  return {
    status: 'ACTIVE',
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: null as Date | null,
    maxUses: null as number | null,
    currentUses: 0,
  }
}

describe('decideCouponValidity — caminhos válidos', () => {
  it('ACTIVE + sem prazo + sem limite → null (válido)', () => {
    expect(decideCouponValidity(base(), NOW)).toBe(null)
  })

  it('exatamente no validFrom → válido', () => {
    const c = { ...base(), validFrom: NOW }
    expect(decideCouponValidity(c, NOW)).toBe(null)
  })

  it('validUntil no FUTURO próximo → válido', () => {
    const c = {
      ...base(),
      validUntil: new Date('2026-12-31T23:59:59Z'),
    }
    expect(decideCouponValidity(c, NOW)).toBe(null)
  })
})

describe('decideCouponValidity — status', () => {
  it('PAUSED → reason=PAUSED', () => {
    expect(decideCouponValidity({ ...base(), status: 'PAUSED' }, NOW)).toBe(
      'PAUSED',
    )
  })

  it('EXHAUSTED → reason=EXHAUSTED', () => {
    expect(
      decideCouponValidity({ ...base(), status: 'EXHAUSTED' }, NOW),
    ).toBe('EXHAUSTED')
  })

  it('DEACTIVATED → reason=DEACTIVATED', () => {
    expect(
      decideCouponValidity({ ...base(), status: 'DEACTIVATED' }, NOW),
    ).toBe('DEACTIVATED')
  })
})

describe('decideCouponValidity — datas', () => {
  it('validFrom no FUTURO → NOT_YET_VALID', () => {
    const c = { ...base(), validFrom: new Date('2026-06-01T00:00:00Z') }
    expect(decideCouponValidity(c, NOW)).toBe('NOT_YET_VALID')
  })

  it('validUntil no PASSADO → EXPIRED', () => {
    const c = {
      ...base(),
      validUntil: new Date('2026-04-30T23:59:59Z'),
    }
    expect(decideCouponValidity(c, NOW)).toBe('EXPIRED')
  })
})

describe('decideCouponValidity — limites', () => {
  it('currentUses >= maxUses → EXHAUSTED', () => {
    expect(
      decideCouponValidity(
        { ...base(), maxUses: 100, currentUses: 100 },
        NOW,
      ),
    ).toBe('EXHAUSTED')
  })

  it('currentUses < maxUses → válido', () => {
    expect(
      decideCouponValidity({ ...base(), maxUses: 100, currentUses: 99 }, NOW),
    ).toBe(null)
  })

  it('maxUses=null (ilimitado) → válido mesmo com muitos usos', () => {
    expect(
      decideCouponValidity({ ...base(), maxUses: null, currentUses: 9999 }, NOW),
    ).toBe(null)
  })
})

describe('decideCouponValidity — precedência', () => {
  it('DEACTIVATED ganha de validade/limites', () => {
    const c = {
      status: 'DEACTIVATED',
      validFrom: new Date('2000-01-01'),
      validUntil: new Date('2099-01-01'),
      maxUses: 100,
      currentUses: 0,
    }
    expect(decideCouponValidity(c, NOW)).toBe('DEACTIVATED')
  })

  it('PAUSED ganha de prazo expirado', () => {
    const c = {
      status: 'PAUSED',
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-04-01'),
      maxUses: null,
      currentUses: 0,
    }
    expect(decideCouponValidity(c, NOW)).toBe('PAUSED')
  })
})

describe('reasonToUserMessage — anti-enumeration', () => {
  it('5 razões "técnicas" mostram MESMA mensagem genérica', () => {
    const genericReasons = [
      'NOT_FOUND',
      'EXPIRED',
      'EXHAUSTED',
      'PAUSED',
      'DEACTIVATED',
      'NOT_YET_VALID',
    ] as const
    const messages = genericReasons.map((r) => reasonToUserMessage(r))
    const unique = new Set(messages)
    expect(unique.size).toBe(1)
    expect(messages[0]).toBe('Cupom inválido ou expirado.')
  })

  it('ALREADY_USED tem mensagem própria (UX clara)', () => {
    expect(reasonToUserMessage('ALREADY_USED')).toBe(
      'Você já usou esse cupom.',
    )
  })
})
