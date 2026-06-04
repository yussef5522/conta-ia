// Sprint A — testes do normalizer dedicado pra MATCH (preserva nome do fornecedor).
//
// Não confundir com __tests__/ai-categorizer-normalize.test.ts (que strippa
// prefixo nome próprio — comportamento OPOSTO).

import { describe, it, expect } from 'vitest'
import { normalizeForMatch } from '@/lib/conciliacao/normalize-for-match'

describe('normalizeForMatch — caso real CACULA MIX (Nestle 03/06)', () => {
  it('OFX "NESTLE BRASIL LTDA - Pagamento" preserva nome do fornecedor', () => {
    expect(normalizeForMatch('NESTLE BRASIL LTDA - Pagamento')).toBe('nestle brasil ltda')
  })

  it('Excel "Nestle Brasil Ltda" → mesma forma canônica que OFX', () => {
    expect(normalizeForMatch('Nestle Brasil Ltda')).toBe('nestle brasil ltda')
  })

  it('par OFX vs Excel resulta na MESMA string normalizada', () => {
    const ofx = normalizeForMatch('NESTLE BRASIL LTDA - Pagamento')
    const excel = normalizeForMatch('Nestle Brasil Ltda')
    expect(ofx).toBe(excel) // Jaro-Winkler resultará em 1.0 → +10pts no match
  })
})

describe('normalizeForMatch — sufixos comerciais comuns', () => {
  it.each([
    ['AMBEV S.A. - Pagamento', 'ambev s.a'],
    ['COCA-COLA - PIX', 'coca-cola'],
    ['Tim Telecom - Boleto', 'tim telecom'],
    ['Energisa SA - Debito', 'energisa sa'],
    ['MERCADO LIVRE - TED', 'mercado livre'],
    ['CLARO PIX recebido', 'claro'],
    ['LATAM PAGTO', 'latam'],
    ['NETFLIX Pagamento', 'netflix'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(normalizeForMatch(input)).toBe(expected)
  })
})

describe('normalizeForMatch — acentos + case + espaços', () => {
  it('lowercase + acentos', () => {
    expect(normalizeForMatch('São Paulo Energia LTDA')).toBe('sao paulo energia ltda')
  })

  it('colapsa espaços múltiplos', () => {
    expect(normalizeForMatch('NESTLE   BRASIL    LTDA')).toBe('nestle brasil ltda')
  })

  it('strip de pontuação no final', () => {
    expect(normalizeForMatch('Energisa SA.')).toBe('energisa sa')
    expect(normalizeForMatch('Coca-Cola,')).toBe('coca-cola')
  })

  it('preserva separadores semânticos internos (- e .)', () => {
    expect(normalizeForMatch('Coca-Cola')).toBe('coca-cola')
    expect(normalizeForMatch('M.D. SUPERMERCADOS')).toBe('m.d. supermercados')
  })
})

describe('normalizeForMatch — sufixos de data', () => {
  it('strip data 12/05', () => {
    expect(normalizeForMatch('Energisa SA 12/05')).toBe('energisa sa')
  })

  it('strip data 12/05/2026', () => {
    expect(normalizeForMatch('Energisa SA 12/05/2026')).toBe('energisa sa')
  })

  it('strip mês textual MAR/2026', () => {
    expect(normalizeForMatch('Aluguel MAR/2026')).toBe('aluguel')
  })

  it('NÃO strippa data NO MEIO da descrição (só sufixo)', () => {
    expect(normalizeForMatch('Aluguel 12/2026 Sala A')).toBe('aluguel 12/2026 sala a')
  })
})

describe('normalizeForMatch — códigos numéricos terminais', () => {
  it('strip código 4+ dígitos no final', () => {
    expect(normalizeForMatch('NESTLE BRASIL 123456')).toBe('nestle brasil')
  })

  it('NÃO strippa código curto (3 dígitos pode ser parte do nome)', () => {
    expect(normalizeForMatch('Loja 123')).toBe('loja 123')
  })
})

describe('normalizeForMatch — robustez', () => {
  it('string vazia → vazio', () => {
    expect(normalizeForMatch('')).toBe('')
  })

  it('só espaços → vazio', () => {
    expect(normalizeForMatch('   ')).toBe('')
  })

  it('só sufixo comercial → vazio', () => {
    expect(normalizeForMatch('- Pagamento')).toBe('')
  })

  it('combinação completa: nome + sufixo + data + código', () => {
    expect(normalizeForMatch('NESTLE BRASIL LTDA - Pagamento 12/05 12345'))
      .toBe('nestle brasil ltda')
  })
})

describe('normalizeForMatch — NÃO mata nome quando descrição é só fornecedor', () => {
  // Diferencial vs normalizeDescription de categorização:
  // categoria strippa "<nome> - " agressivo → mataria nome.
  // match precisa preservar — esse teste protege contra regressão.
  it('"Nestle Brasil Ltda" sem sufixo NÃO vira vazio (preserva nome)', () => {
    expect(normalizeForMatch('Nestle Brasil Ltda')).toBe('nestle brasil ltda')
  })

  it('"Ambev S.A." preserva nome COM hifen final removido só por pontuação', () => {
    expect(normalizeForMatch('Ambev S.A.')).toBe('ambev s.a')
  })
})
