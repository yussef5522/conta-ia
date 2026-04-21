import { describe, it, expect } from 'vitest'
import { formatBRL, formatBRLCompact, parseBRL } from '@/lib/format/money'

describe('formatBRL', () => {
  it('formata valor positivo', () => {
    expect(formatBRL(1500)).toBe('R$\u00a01.500,00')
  })

  it('formata zero', () => {
    expect(formatBRL(0)).toBe('R$\u00a00,00')
  })

  it('formata valor negativo', () => {
    expect(formatBRL(-250.5)).toContain('-')
    expect(formatBRL(-250.5)).toContain('250,50')
  })

  it('formata centavos corretamente', () => {
    expect(formatBRL(0.99)).toBe('R$\u00a00,99')
  })
})

describe('formatBRLCompact', () => {
  it('usa sufixo K para milhares', () => {
    expect(formatBRLCompact(5000)).toBe('R$ 5,0K')
  })

  it('usa sufixo M para milhões', () => {
    expect(formatBRLCompact(2_500_000)).toBe('R$ 2,5M')
  })

  it('usa formato completo para valores pequenos', () => {
    expect(formatBRLCompact(999)).toContain('999')
  })
})

describe('parseBRL', () => {
  it('converte string formatada para número', () => {
    expect(parseBRL('R$ 1.500,00')).toBe(1500)
  })

  it('retorna 0 para string inválida', () => {
    expect(parseBRL('abc')).toBe(0)
  })

  it('converte valor com centavos', () => {
    expect(parseBRL('R$ 99,90')).toBeCloseTo(99.9)
  })
})
