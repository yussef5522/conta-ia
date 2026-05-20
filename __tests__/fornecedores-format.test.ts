// Sprint 2.2 — helpers puros + validador CNPJ.

import { describe, it, expect } from 'vitest'
import {
  isValidCNPJ,
  formatCNPJ,
  unformatCNPJ,
  fonteLabel,
  fonteColor,
} from '@/lib/fornecedores/format'

describe('isValidCNPJ', () => {
  it('aceita CNPJ Petrobras (33.000.167/0001-01)', () => {
    expect(isValidCNPJ('33000167000101')).toBe(true)
    expect(isValidCNPJ('33.000.167/0001-01')).toBe(true)
  })

  it('aceita CNPJ Banco do Brasil (00.000.000/0001-91)', () => {
    expect(isValidCNPJ('00000000000191')).toBe(true)
  })

  it('REJEITA 14 dígitos repetidos', () => {
    expect(isValidCNPJ('00000000000000')).toBe(false)
    expect(isValidCNPJ('11111111111111')).toBe(false)
  })

  it('REJEITA tamanho errado', () => {
    expect(isValidCNPJ('1234')).toBe(false)
    expect(isValidCNPJ('123456789012345')).toBe(false)
  })

  it('REJEITA dígitos verificadores errados', () => {
    expect(isValidCNPJ('33000167000102')).toBe(false)
    expect(isValidCNPJ('00000000000192')).toBe(false)
  })

  it('REJEITA null/undefined/vazio', () => {
    expect(isValidCNPJ(null)).toBe(false)
    expect(isValidCNPJ(undefined)).toBe(false)
    expect(isValidCNPJ('')).toBe(false)
  })
})

describe('formatCNPJ / unformatCNPJ', () => {
  it('formata 14 dígitos', () => {
    expect(formatCNPJ('33000167000101')).toBe('33.000.167/0001-01')
  })

  it('idempotente em CNPJ já formatado', () => {
    expect(unformatCNPJ('33.000.167/0001-01')).toBe('33000167000101')
  })

  it('null retorna string vazia', () => {
    expect(formatCNPJ(null)).toBe('')
  })

  it('tamanho errado retorna raw', () => {
    expect(formatCNPJ('123')).toBe('123')
  })
})

describe('fonteLabel / fonteColor', () => {
  it('4 fontes (incluindo KEYWORD)', () => {
    expect(fonteLabel('MANUAL')).toBe('Manual')
    expect(fonteLabel('BRASILAPI')).toBe('BrasilAPI')
    expect(fonteLabel('CLAUDE')).toBe('IA')
    expect(fonteLabel('KEYWORD')).toBe('Keyword')
  })

  it('cores distintas por fonte', () => {
    expect(fonteColor('BRASILAPI').text).toContain('blue')
    expect(fonteColor('CLAUDE').text).toContain('purple')
    expect(fonteColor('MANUAL').text).toContain('zinc')
    expect(fonteColor('KEYWORD').text).toContain('amber')
  })
})
