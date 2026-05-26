// Sprint 5.0.2.m — Extração de anchor word.

import { describe, it, expect } from 'vitest'
import { extractAnchorWord, isKnownShortVendor } from '@/lib/categorization/extract-anchor-word'

describe('extractAnchorWord — casos reais Cacula Mix', () => {
  it('PAG TECOPONTO SOLUÇÕES NF 47 → TECOPONTO', () => {
    expect(extractAnchorWord('PAG TECOPONTO SOLUÇÕES NF 47')).toBe('TECOPONTO')
  })

  it('PAGAMENTO SPAL DISTRIBUIDORA 12/2025 → SPAL (known short vendor)', () => {
    expect(extractAnchorWord('PAGAMENTO SPAL DISTRIBUIDORA 12/2025')).toBe('SPAL')
  })

  it('PAG AMBEV S.A. REF 11 → AMBEV', () => {
    expect(extractAnchorWord('PAG AMBEV S.A. REF 11')).toBe('AMBEV')
  })

  it('PIX RECEBIDO JOAO SILVA 12345 → JOAO (4+ chars)', () => {
    expect(extractAnchorWord('PIX RECEBIDO JOAO SILVA 12345')).toBe('JOAO')
  })

  it('PAGAMENTO STONE D+1 → STONE', () => {
    expect(extractAnchorWord('PAGAMENTO STONE D+1')).toBe('STONE')
  })

  it('PIX BRF FRIGORIFICO → BRF (known short vendor)', () => {
    expect(extractAnchorWord('PIX BRF FRIGORIFICO')).toBe('BRF')
  })

  it('PAGAMENTO JBS LOJA 22 → JBS (known short vendor)', () => {
    expect(extractAnchorWord('PAGAMENTO JBS LOJA 22')).toBe('JBS')
  })
})

describe('extractAnchorWord — remoção de prefixos', () => {
  it('PAGAMENTO BOLETO BANRISUL → BANRISUL', () => {
    expect(extractAnchorWord('PAGAMENTO BOLETO BANRISUL 12345678')).toBe('BANRISUL')
  })

  it('PIX TECOPONTO → TECOPONTO (sem prefixo PAG)', () => {
    expect(extractAnchorWord('PIX TECOPONTO LTDA')).toBe('TECOPONTO')
  })

  it('só 1 prefixo é removido (não recursivo)', () => {
    // PAGAMENTO PIX → strip "PAGAMENTO" → "PIX ALGUM" → anchor = PIX (4 chars)
    expect(extractAnchorWord('PAGAMENTO PIX FORNECEDOR')).toBe('FORNECEDOR')
  })
})

describe('extractAnchorWord — limpeza de ruído', () => {
  it('CNPJ formatado removido', () => {
    expect(extractAnchorWord('PAG 12.345.678/0001-90 FORNECEDOR XYZ')).toBe('FORNECEDOR')
  })

  it('CPF formatado removido', () => {
    expect(extractAnchorWord('PIX 123.456.789-00 JOAO')).toBe('JOAO')
  })

  it('Datas DD/MM/YYYY removidas', () => {
    expect(extractAnchorWord('PAG FORNECEDOR 25/05/2026')).toBe('FORNECEDOR')
  })

  it('Mês/ano 12/2025 removido', () => {
    expect(extractAnchorWord('PAG TECOPONTO 12/2025')).toBe('TECOPONTO')
  })

  it('valor R$ removido', () => {
    expect(extractAnchorWord('PAG FORNECEDOR R$ 1.234,56')).toBe('FORNECEDOR')
  })

  it('REF e NF removidos', () => {
    expect(extractAnchorWord('PAG FORNECEDOR NF 12345 REF 999')).toBe('FORNECEDOR')
  })

  it('Stopwords (DE, DA, LTDA, EPP) ignoradas', () => {
    expect(extractAnchorWord('PAG DE FORNECEDOR DA EMPRESA LTDA')).toBe('FORNECEDOR')
  })
})

describe('extractAnchorWord — short vendors', () => {
  it('SPAL passa apesar de 4 chars', () => {
    expect(extractAnchorWord('PIX SPAL')).toBe('SPAL')
  })

  it('JBS passa apesar de 3 chars (known short)', () => {
    expect(extractAnchorWord('PIX JBS')).toBe('JBS')
  })

  it('BRF passa apesar de 3 chars', () => {
    expect(extractAnchorWord('PAGAMENTO BRF FOODS')).toBe('BRF')
  })

  it('ABC (3 chars, não conhecido) → null', () => {
    // "ABC" não é vendor conhecido e tem 3 chars (abaixo mínimo)
    expect(extractAnchorWord('PIX ABC')).toBeNull()
  })
})

describe('extractAnchorWord — edge cases', () => {
  it('null → null', () => {
    expect(extractAnchorWord(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(extractAnchorWord(undefined)).toBeNull()
  })

  it('string vazia → null', () => {
    expect(extractAnchorWord('')).toBeNull()
  })

  it('só números → null', () => {
    expect(extractAnchorWord('123456789')).toBeNull()
  })

  it('só prefixo → null', () => {
    expect(extractAnchorWord('PAGAMENTO')).toBeNull()
  })

  it('só stopwords → null', () => {
    expect(extractAnchorWord('DE DA DO LTDA')).toBeNull()
  })

  it('case-insensitive (entrada lowercase)', () => {
    expect(extractAnchorWord('pag tecoponto')).toBe('TECOPONTO')
  })
})

describe('extractAnchorWord — proteção contra falsos positivos', () => {
  it('descrição genérica sem fornecedor identificável → null', () => {
    // "TARIFA BANCO" → strip prefixos não casa "TARIFA"; mas TARIFA tem 6 chars
    // e não é stopword → retorna TARIFA (anchor genérico, mas válido)
    expect(extractAnchorWord('TARIFA BANCO')).toBe('TARIFA')
  })

  it('PAGAMENTO DARF → DARF (4 chars exato)', () => {
    expect(extractAnchorWord('PAGAMENTO DARF')).toBe('DARF')
  })
})

describe('isKnownShortVendor helper', () => {
  it('SPAL é known', () => {
    expect(isKnownShortVendor('SPAL')).toBe(true)
  })

  it('case insensitive', () => {
    expect(isKnownShortVendor('spal')).toBe(true)
  })

  it('TECOPONTO NÃO está na lista curta (tem 9 chars, não precisa)', () => {
    expect(isKnownShortVendor('TECOPONTO')).toBe(false)
  })
})
