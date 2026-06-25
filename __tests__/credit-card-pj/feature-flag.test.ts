import { describe, it, expect } from 'vitest'
import { checkCreditCardPjFlag } from '@/lib/credit-card-pj/feature-flag'

describe('checkCreditCardPjFlag', () => {
  it('libera com flag=true', () => {
    expect(checkCreditCardPjFlag({ CREDIT_CARD_PJ_ENABLED: 'true' }).allowed).toBe(true)
  })
  it('bloqueia sem flag', () => {
    const r = checkCreditCardPjFlag({})
    expect(r.allowed).toBe(false)
    expect(r.message).toContain('CREDIT_CARD_PJ_ENABLED')
  })
  it('bloqueia com flag=false', () => {
    expect(checkCreditCardPjFlag({ CREDIT_CARD_PJ_ENABLED: 'false' }).allowed).toBe(false)
  })
  it('aceita case e espaços', () => {
    expect(checkCreditCardPjFlag({ CREDIT_CARD_PJ_ENABLED: '  TRUE  ' }).allowed).toBe(true)
  })
})
