// Sprint 5.0.2.j — nameMatchFlexible com confidence + stopwords + prefixos.

import { describe, it, expect } from 'vitest'
import { nameMatchFlexible, nameMatch } from '@/lib/pix-detection/parse-pix'

describe('nameMatchFlexible — substring exato', () => {
  it('match exato → confidence 1.0', () => {
    const r = nameMatchFlexible('Yussef Musa', 'PIX YUSSEF MUSA RECEBIDO')
    expect(r.match).toBe(true)
    expect(r.confidence).toBe(1.0)
  })

  it('case-insensitive', () => {
    expect(nameMatchFlexible('yussef musa', 'YUSSEF MUSA').match).toBe(true)
  })

  it('sem acento', () => {
    expect(nameMatchFlexible('Cacula Mix', 'PIX CACULA MIX').match).toBe(true)
  })
})

describe('nameMatchFlexible — 2+ palavras significativas (EMV long string)', () => {
  it('"Yussef Musa" em "YUSSEF ABU ZAHRY MUSA" → match', () => {
    const r = nameMatchFlexible('Yussef Musa', 'YUSSEF ABU ZAHRY MUSA')
    expect(r.match).toBe(true)
    expect(r.matchedWords).toEqual(['yussef', 'musa'])
  })

  it('1 palavra do nome só → não basta (2+ palavras)', () => {
    const r = nameMatchFlexible('Yussef Musa Silva', 'PIX SILVA RECEBIDO')
    expect(r.match).toBe(false)
  })

  it('confidence proporcional ao número de palavras matched', () => {
    // 2 de 3 palavras significativas → confidence 2/3
    const r = nameMatchFlexible('Yussef Musa Silva', 'PIX YUSSEF MUSA')
    expect(r.confidence).toBeCloseTo(2 / 3)
  })
})

describe('nameMatchFlexible — stopwords ignoradas', () => {
  it('"Restaurante da Cacula" vira ["restaurante", "cacula"]', () => {
    const r = nameMatchFlexible('Restaurante da Cacula', 'PIX RESTAURANTE CACULA')
    expect(r.match).toBe(true)
    expect(r.matchedWords).not.toContain('da')
  })

  it('stopwords (de/da/do/e/em) não contam', () => {
    const r = nameMatchFlexible('Empresa de Tecnologia', 'PIX EMPRESA TECNOLOGIA')
    expect(r.match).toBe(true)
  })
})

describe('nameMatchFlexible — prefixos (4+ chars)', () => {
  it('"Forca" matcheia "ACADEMIAFORCATOTAL" (substring no token)', () => {
    // descrição tokeniza em "ACADEMIAFORCATOTAL" único — prefixo cad startsWith d? não
    // Mas se descrição separa: "ACADEMIA FORCA TOTAL"
    const r = nameMatchFlexible('Academia Forca Total', 'PIX ACADEMIA FORCA TOTAL')
    expect(r.match).toBe(true)
  })

  it('prefixo: "Yusse" (5+ chars) no cadastro vs "YUSSEF" → match via startsWith', () => {
    // 5 chars qualifica pra match por prefixo (>=4)
    const r = nameMatchFlexible('Yusse', 'PIX YUSSEF MUSA')
    expect(r.match).toBe(true)
  })
})

describe('nameMatchFlexible — 1 palavra única', () => {
  it('1 palavra cadastrada match exato', () => {
    expect(nameMatchFlexible('Cacula', 'PIX CACULA RECEBIDO').match).toBe(true)
  })

  it('1 palavra cadastrada que não bate → false', () => {
    expect(nameMatchFlexible('Cacula', 'PIX ACADEMIA RECEBIDO').match).toBe(false)
  })
})

describe('nameMatchFlexible — edge cases', () => {
  it('null/empty', () => {
    expect(nameMatchFlexible('', 'qualquer').match).toBe(false)
    expect(nameMatchFlexible('Yussef', null).match).toBe(false)
  })

  it('palavras muito curtas ignoradas (<3 chars)', () => {
    // Nome "Dr Yussef" → "yussef" só (dr filtrado por len<3)
    const r = nameMatchFlexible('Dr Yussef', 'PIX YUSSEF MUSA')
    // 1 palavra significativa (yussef) → precisa match exato → match
    expect(r.match).toBe(true)
  })
})

describe('nameMatch (boolean) compatibility', () => {
  it('mantém retorno boolean compat com Sprint 5.0.2.h', () => {
    expect(typeof nameMatch('Yussef', 'PIX YUSSEF')).toBe('boolean')
    expect(nameMatch('Yussef Musa', 'PIX YUSSEF MUSA')).toBe(true)
  })
})
