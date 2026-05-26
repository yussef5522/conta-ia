// Sprint 5.0.2.n — normalizeVendorName.

import { describe, it, expect } from 'vitest'
import { normalizeVendorName } from '@/lib/vendor-discovery/normalize'

describe('normalizeVendorName', () => {
  it('UPPERCASE', () => {
    expect(normalizeVendorName('tecoponto')).toBe('TECOPONTO')
  })

  it('remove acentos', () => {
    expect(normalizeVendorName('Padaria São José')).toBe('PADARIA SAO JOSE')
  })

  it('colapsa whitespace múltiplo', () => {
    expect(normalizeVendorName('AMBEV    S.A.')).toBe('AMBEV S A')
  })

  it('preserva hífen interno', () => {
    expect(normalizeVendorName('Coca-Cola')).toBe('COCA-COLA')
  })

  it('descarta pontuação', () => {
    expect(normalizeVendorName('JBS S/A; CIA.')).toBe('JBS S A CIA')
  })

  it('trim das pontas', () => {
    expect(normalizeVendorName('  STONE  ')).toBe('STONE')
  })
})
