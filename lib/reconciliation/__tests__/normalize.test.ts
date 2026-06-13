import { describe, it, expect } from 'vitest'
import { normalizeMemo } from '../normalize'

describe('normalizeMemo', () => {
  it('remove acentos', () => {
    expect(normalizeMemo('Antecipação Stone')).toBe('ANTECIPACAO STONE')
    expect(normalizeMemo('TRANSFERÊNCIA')).toBe('TRANSFERENCIA')
  })

  it('colapsa whitespace e trim', () => {
    expect(normalizeMemo('  OP.   CREDITO   C/GARANTIA  ')).toBe('OP CREDITO C/GARANTIA')
  })

  it('uppercase', () => {
    expect(normalizeMemo('pix enviado')).toBe('PIX ENVIADO')
  })

  it('PRESERVA "/" pra não estragar tipos C/GARANTIA vs S/GARANTIA', () => {
    expect(normalizeMemo('OP.CREDITO C/GARANTIA')).toBe('OP CREDITO C/GARANTIA')
    expect(normalizeMemo('OP.CREDITO S/GARANTIA')).toBe('OP CREDITO S/GARANTIA')
    expect(normalizeMemo('OP.CREDITO C/GARANTIA')).not.toBe(normalizeMemo('OP.CREDITO S/GARANTIA'))
  })

  it('trata variações reais do Banrisul (espaço duplo entre exports)', () => {
    // FITID 014332 veio "OP.CREDITO C/GARANTIA" / FITID 000020 veio "OP. CREDITO C/GARANTIA"
    expect(normalizeMemo('OP.CREDITO C/GARANTIA')).toBe(normalizeMemo('OP. CREDITO C/GARANTIA'))
  })

  it('vazio retorna vazio', () => {
    expect(normalizeMemo('')).toBe('')
  })
})
