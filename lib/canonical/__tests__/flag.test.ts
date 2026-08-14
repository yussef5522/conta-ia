// Wiring-do-Juiz — o gate PER BANK: a flag mestra liga, mas o juiz só engata nos
// bancos provados (default Banrisul 041). Sicredi/Stone seguem no legado até prova.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isCanonicalClassifyEnabled, isCanonicalClassifyEnabledForBank } from '../flag'

const OLD = { ...process.env }
beforeEach(() => {
  delete process.env.CANONICAL_CLASSIFY_ENABLED
  delete process.env.CANONICAL_CLASSIFY_BANKS
})
afterEach(() => {
  process.env = { ...OLD }
})

describe('gate per bank', () => {
  it('flag OFF → false pra qualquer banco', () => {
    expect(isCanonicalClassifyEnabledForBank('041')).toBe(false)
    expect(isCanonicalClassifyEnabled()).toBe(false)
  })

  it('flag ON + default → só Banrisul (041) engata; Sicredi/Stone no legado', () => {
    process.env.CANONICAL_CLASSIFY_ENABLED = 'true'
    expect(isCanonicalClassifyEnabledForBank('041')).toBe(true) // Banrisul provado
    expect(isCanonicalClassifyEnabledForBank('748')).toBe(false) // Sicredi (-0.57 a investigar)
    expect(isCanonicalClassifyEnabledForBank('197')).toBe(false) // Stone (downloads conflitantes)
  })

  it('bankId ausente/desconhecido → false (nunca liga no escuro)', () => {
    process.env.CANONICAL_CLASSIFY_ENABLED = 'true'
    expect(isCanonicalClassifyEnabledForBank(null)).toBe(false)
    expect(isCanonicalClassifyEnabledForBank(undefined)).toBe(false)
    expect(isCanonicalClassifyEnabledForBank('999')).toBe(false)
  })

  it('allowlist via env sobrescreve (adicionar banco sem deploy)', () => {
    process.env.CANONICAL_CLASSIFY_ENABLED = '1'
    process.env.CANONICAL_CLASSIFY_BANKS = '041,748'
    expect(isCanonicalClassifyEnabledForBank('041')).toBe(true)
    expect(isCanonicalClassifyEnabledForBank('748')).toBe(true)
    expect(isCanonicalClassifyEnabledForBank('197')).toBe(false)
  })
})
