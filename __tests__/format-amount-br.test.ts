// Sprint 5.0.3.0c (c3) — Tests pra parseBRAmount + formatBRAmount.

import { describe, it, expect } from 'vitest'
import {
  parseBRAmount,
  formatBRAmount,
  isValidBRAmount,
} from '@/lib/contas-pagar/format-amount-br'

describe('parseBRAmount', () => {
  it('1234,56 → 1234.56 (vírgula BR)', () => {
    expect(parseBRAmount('1234,56')).toBe(1234.56)
  })

  it('1.234,56 → 1234.56 (ponto milhar + vírgula decimal BR)', () => {
    expect(parseBRAmount('1.234,56')).toBe(1234.56)
  })

  it('1234.56 → 1234.56 (US format aceito)', () => {
    expect(parseBRAmount('1234.56')).toBe(1234.56)
  })

  it('R$ 1.234,56 → 1234.56 (com prefixo)', () => {
    expect(parseBRAmount('R$ 1.234,56')).toBe(1234.56)
  })

  it('0,00 → 0', () => {
    expect(parseBRAmount('0,00')).toBe(0)
  })

  it('vazia → NaN', () => {
    expect(Number.isNaN(parseBRAmount(''))).toBe(true)
  })

  it('só texto → NaN', () => {
    expect(Number.isNaN(parseBRAmount('abc'))).toBe(true)
  })

  it('milhão: 1.234.567,89 → 1234567.89', () => {
    expect(parseBRAmount('1.234.567,89')).toBe(1234567.89)
  })

  it('negativo: -100,50 → -100.50', () => {
    expect(parseBRAmount('-100,50')).toBe(-100.5)
  })
})

describe('formatBRAmount', () => {
  it('1234.56 → 1.234,56', () => {
    expect(formatBRAmount(1234.56)).toBe('1.234,56')
  })

  it('0 → 0,00', () => {
    expect(formatBRAmount(0)).toBe('0,00')
  })

  it('NaN → vazio', () => {
    expect(formatBRAmount(NaN)).toBe('')
  })

  it('Infinity → vazio', () => {
    expect(formatBRAmount(Infinity)).toBe('')
  })
})

describe('isValidBRAmount', () => {
  it('valor válido positivo', () => {
    expect(isValidBRAmount('100,50')).toBe(true)
    expect(isValidBRAmount('1.234,56')).toBe(true)
  })

  it('zero → inválido', () => {
    expect(isValidBRAmount('0,00')).toBe(false)
  })

  it('negativo → inválido', () => {
    expect(isValidBRAmount('-50')).toBe(false)
  })

  it('vazio → inválido', () => {
    expect(isValidBRAmount('')).toBe(false)
    expect(isValidBRAmount('abc')).toBe(false)
  })
})

describe('round-trip parseBR → formatBR', () => {
  it.each([
    ['1234,56', 1234.56, '1.234,56'],
    ['100,00', 100, '100,00'],
    ['0,99', 0.99, '0,99'],
    ['99999,99', 99999.99, '99.999,99'],
  ])('"%s" → %f → "%s"', (input, n, output) => {
    expect(parseBRAmount(input)).toBe(n)
    expect(formatBRAmount(n)).toBe(output)
  })
})
