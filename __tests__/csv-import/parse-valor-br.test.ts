// Sprint CSV Import (30/05/2026)

import { describe, it, expect } from 'vitest'
import { parseValorBR } from '@/lib/csv-import/parse-valor-br'

describe('parseValorBR', () => {
  it('"-5.312,80" → -5312.80', () => {
    expect(parseValorBR('-5.312,80')).toBe(-5312.80)
  })

  it('"-153,00" → -153', () => {
    expect(parseValorBR('-153,00')).toBe(-153)
  })

  it('"0,00" → 0', () => {
    expect(parseValorBR('0,00')).toBe(0)
  })

  it('positivo sem sinal "1.234,56" → 1234.56', () => {
    expect(parseValorBR('1.234,56')).toBe(1234.56)
  })

  it('positivo com "+" → 100', () => {
    expect(parseValorBR('+100,00')).toBe(100)
  })

  it('inteiro sem decimal "500" → 500', () => {
    expect(parseValorBR('500')).toBe(500)
  })

  it('arredonda pra 2 casas', () => {
    // 99.995 round-half-even ou similar. Math.round → 100.00
    expect(parseValorBR('99,995')).toBeCloseTo(100, 2)
  })

  it('"-" → null', () => {
    expect(parseValorBR('-')).toBeNull()
  })

  it('"" → null', () => {
    expect(parseValorBR('')).toBeNull()
  })

  it('whitespace puro "   " → null', () => {
    expect(parseValorBR('   ')).toBeNull()
  })

  it('null → null', () => {
    expect(parseValorBR(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(parseValorBR(undefined)).toBeNull()
  })

  it('formato inválido "abc" → null', () => {
    expect(parseValorBR('abc')).toBeNull()
  })

  it('formato US "5,312.80" → null (recusa)', () => {
    expect(parseValorBR('5,312.80')).toBeNull()
  })

  it('aceita prefixo "R$ 100,00"', () => {
    expect(parseValorBR('R$ 100,00')).toBe(100)
  })

  it('preserva precisão de centavos negativos', () => {
    expect(parseValorBR('-1.692,00')).toBe(-1692)
    expect(parseValorBR('-48,99')).toBe(-48.99)
  })

  it('valor grande "12.345.678,90" → 12345678.90', () => {
    expect(parseValorBR('12.345.678,90')).toBe(12345678.9)
  })
})
