// Sprint 5.0.2.k — extractDescriptionStem (puro).

import { describe, it, expect } from 'vitest'
import {
  extractDescriptionStem,
  longestCommonStem,
} from '@/lib/rules/extract-stem'

describe('extractDescriptionStem — caso real Yussef (Sprint 5.0.2.l)', () => {
  it('PIX-PIX_CRED com CPF + nome → corta no CPF', () => {
    expect(extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 86284304072 MURILLO CARDOSO')).toBe(
      'RECEBIMENTO PIX-PIX_CRED',
    )
  })

  it('PIX-PIX_CRE (bug banco truncar D) preserva forma original', () => {
    expect(extractDescriptionStem('RECEBIMENTO PIX-PIX_CRE 83915761087 CRISTIAN PEREIRA')).toBe(
      'RECEBIMENTO PIX-PIX_CRE',
    )
  })

  it('PIX-PIX_CRED com CNPJ 14 dígitos + nome empresa', () => {
    expect(
      extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 44072835000122 ALISSON ALVES'),
    ).toBe('RECEBIMENTO PIX-PIX_CRED')
  })

  it('CPFs/nomes DIFERENTES produzem MESMO stem', () => {
    const a = extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 11111111111 João')
    const b = extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 22222222222 Maria')
    const c = extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 03898134008 Gabriel Berno')
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(a).toBe('RECEBIMENTO PIX-PIX_CRED')
  })

  it('"RECEBIMENTO PIX-PIX_CRED 03955593088 João Vitor Soares" → stem core', () => {
    const s = extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 03955593088 João Vitor Soares')
    expect(s).toContain('RECEBIMENTO')
    expect(s).toContain('PIX-PIX_CRED')
    expect(s).not.toContain('03955593088')
    expect(s).not.toContain('João')
  })

  it('"RECEBIMENTO PIX-PIX_CRED 12345678 Maria" mesma stem', () => {
    const s1 = extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 03955593088 João Vitor')
    const s2 = extractDescriptionStem('RECEBIMENTO PIX-PIX_CRED 12345678 Maria Silva')
    expect(s1).toBe(s2)
  })

  it('"PAGAMENTO BOLETO BANRISUL 9847234" — corte no número, 3 palavras', () => {
    // Sprint 5.0.2.l: corte no primeiro 6+ dígitos. STEM_WORD_LIMIT=3 → todas
    expect(extractDescriptionStem('PAGAMENTO BOLETO BANRISUL 9847234')).toBe(
      'PAGAMENTO BOLETO BANRISUL',
    )
  })

  it('"TARIFA MENSALIDADE 12/2025" remove data', () => {
    const s = extractDescriptionStem('TARIFA MENSALIDADE 12/2025')
    expect(s).toContain('TARIFA')
    expect(s).toContain('MENSALIDADE')
    expect(s).not.toContain('12/2025')
  })
})

describe('extractDescriptionStem — limpeza', () => {
  it('CNPJ formatado removido', () => {
    const s = extractDescriptionStem('PAGAMENTO 12.345.678/0001-90 FORNECEDOR')
    expect(s).not.toContain('12.345.678')
    expect(s).toContain('PAGAMENTO')
    expect(s).toContain('FORNECEDOR')
  })

  it('CPF formatado removido', () => {
    const s = extractDescriptionStem('PIX 123.456.789-00 YUSSEF')
    expect(s).not.toContain('123.456.789')
  })

  it('Data DD/MM/YYYY removida', () => {
    const s = extractDescriptionStem('PAGTO BOLETO 25/05/2026')
    expect(s).not.toContain('25/05/2026')
  })

  it('Valor R$ removido', () => {
    const s = extractDescriptionStem('DEPÓSITO R$ 1.234,56 LOJA')
    expect(s).not.toContain('R$')
    expect(s).not.toContain('1.234')
    expect(s).not.toContain(',56')
    // Pega 2 primeiras palavras significativas (uppercase preserva acentos)
    expect(s).toMatch(/DEP[ÓO]SITO/i)
  })

  it('Stopwords PT-BR ignoradas', () => {
    const s = extractDescriptionStem('PAGAMENTO DE FORNECEDOR DA EMPRESA')
    expect(s).not.toContain('DE')
    expect(s).not.toContain('DA')
    expect(s).toContain('PAGAMENTO')
    expect(s).toContain('FORNECEDOR')
  })
})

describe('extractDescriptionStem — edge cases', () => {
  it('null/empty → empty', () => {
    expect(extractDescriptionStem(null)).toBe('')
    expect(extractDescriptionStem('')).toBe('')
  })

  it('só números → empty (todos filtrados)', () => {
    expect(extractDescriptionStem('123456 9876543210')).toBe('')
  })

  it('palavras muito curtas filtradas', () => {
    const s = extractDescriptionStem('A B C DEPÓSITO PIX')
    // A/B/C filtradas (len<3). Sobra DEPÓSITO + PIX
    expect(s).toMatch(/DEP[ÓO]SITO/i)
    expect(s).toContain('PIX')
  })

  it('máximo 3 palavras (Sprint 5.0.2.l: corte no número compensa STEM_WORD_LIMIT=3)', () => {
    const s = extractDescriptionStem('UMA DUAS TRES QUATRO CINCO SEIS SETE')
    const palavras = s.split(' ').filter(Boolean)
    expect(palavras.length).toBeLessThanOrEqual(3)
  })
})

describe('longestCommonStem', () => {
  it('várias descrições com mesma raiz', () => {
    const stem = longestCommonStem([
      'RECEBIMENTO PIX-PIX_CRED 03955593088 João',
      'RECEBIMENTO PIX-PIX_CRED 11111111111 Maria',
      'RECEBIMENTO PIX-PIX_CRED 22222222222 Pedro',
    ])
    expect(stem).toContain('RECEBIMENTO')
    expect(stem).toContain('PIX-PIX_CRED')
  })

  it('mix de padrões: stem mais frequente vence', () => {
    const stem = longestCommonStem([
      'PIX YUSSEF 12345678900',
      'PIX YUSSEF 12345678900',
      'TARIFA MENSALIDADE',
    ])
    expect(stem).toContain('PIX')
    expect(stem).toContain('YUSSEF')
  })

  it('array vazio → empty', () => {
    expect(longestCommonStem([])).toBe('')
  })
})
