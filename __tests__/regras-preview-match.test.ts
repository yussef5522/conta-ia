// Sprint 3.0.4 C3 — testes do match preview de regras.

import { describe, it, expect } from 'vitest'
import {
  txMatchesRegra,
  filterTransacoesByRegra,
} from '@/lib/regras/preview-match'

describe('txMatchesRegra — EXACT', () => {
  it('match literal idêntico', () => {
    expect(txMatchesRegra({ description: 'NETFLIX' }, { padrao: 'NETFLIX', tipoMatch: 'EXACT' }))
      .toBe(true)
  })

  it('case-insensitive (lower)', () => {
    expect(txMatchesRegra({ description: 'netflix' }, { padrao: 'NETFLIX', tipoMatch: 'EXACT' }))
      .toBe(true)
  })

  it('remove acentos', () => {
    expect(
      txMatchesRegra(
        { description: 'CIA DA FRUTA' },
        { padrao: 'Cia dá Fruta', tipoMatch: 'EXACT' },
      ),
    ).toBe(true)
  })

  it('NÃO bate quando descrição tem extras', () => {
    expect(
      txMatchesRegra(
        { description: 'NETFLIX BRASIL' },
        { padrao: 'NETFLIX', tipoMatch: 'EXACT' },
      ),
    ).toBe(false)
  })
})

describe('txMatchesRegra — CONTAINS', () => {
  it('substring bate', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX NETFLIX BR' },
        { padrao: 'NETFLIX', tipoMatch: 'CONTAINS' },
      ),
    ).toBe(true)
  })

  it('case-insensitive', () => {
    expect(
      txMatchesRegra(
        { description: 'pix netflix br' },
        { padrao: 'NETFLIX', tipoMatch: 'CONTAINS' },
      ),
    ).toBe(true)
  })

  it('não bate quando substring ausente', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX SPOTIFY' },
        { padrao: 'NETFLIX', tipoMatch: 'CONTAINS' },
      ),
    ).toBe(false)
  })

  it('com acentos no padrão e descrição', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX CACAU SHOW' },
        { padrao: 'cacaú', tipoMatch: 'CONTAINS' },
      ),
    ).toBe(true)
  })
})

describe('txMatchesRegra — NORMALIZED', () => {
  it('strip prefixo nome + data bate', () => {
    expect(
      txMatchesRegra(
        { description: 'JOAO SILVA - PIX RECEBIDO 12/05' },
        { padrao: 'PIX RECEBIDO', tipoMatch: 'NORMALIZED' },
      ),
    ).toBe(true)
  })

  it('mesma descrição com prefixo diferente bate', () => {
    expect(
      txMatchesRegra(
        { description: 'MARIA SOUZA - PAGAMENTO BOLETO' },
        { padrao: 'XICO - PAGAMENTO BOLETO', tipoMatch: 'NORMALIZED' },
      ),
    ).toBe(true)
  })

  it('substring NÃO conta (é match literal pós-normalize)', () => {
    expect(
      txMatchesRegra(
        { description: 'JOAO - PIX A NETFLIX' },
        { padrao: 'NETFLIX', tipoMatch: 'NORMALIZED' },
      ),
    ).toBe(false)
  })
})

describe('txMatchesRegra — CNPJ', () => {
  it('match com CNPJ formatado', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX A 12.345.678/0001-99 LTDA' },
        { padrao: '12.345.678/0001-99', tipoMatch: 'CNPJ' },
      ),
    ).toBe(true)
  })

  it('match com CNPJ sem formatação', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX A 12345678000199 LTDA' },
        { padrao: '12.345.678/0001-99', tipoMatch: 'CNPJ' },
      ),
    ).toBe(true)
  })

  it('CPF (11 dígitos) também aceito', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX 12345678901' },
        { padrao: '123.456.789-01', tipoMatch: 'CNPJ' },
      ),
    ).toBe(true)
  })

  it('rejeita padrão curto (<11 dígitos)', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX 12345' },
        { padrao: '12345', tipoMatch: 'CNPJ' },
      ),
    ).toBe(false)
  })

  it('não bate quando CNPJ ausente da descrição', () => {
    expect(
      txMatchesRegra(
        { description: 'PIX A NETFLIX' },
        { padrao: '12.345.678/0001-99', tipoMatch: 'CNPJ' },
      ),
    ).toBe(false)
  })
})

describe('edge cases', () => {
  it('padrão vazio → false sempre', () => {
    expect(txMatchesRegra({ description: 'foo' }, { padrao: '', tipoMatch: 'EXACT' })).toBe(false)
    expect(txMatchesRegra({ description: 'foo' }, { padrao: '   ', tipoMatch: 'CONTAINS' }))
      .toBe(false)
  })

  it('tipoMatch inválido → false', () => {
    expect(
      txMatchesRegra(
        { description: 'foo' },
        { padrao: 'foo', tipoMatch: 'INVALID' as 'EXACT' },
      ),
    ).toBe(false)
  })
})

describe('filterTransacoesByRegra', () => {
  it('retorna só as que batem', () => {
    const txs = [
      { id: '1', description: 'NETFLIX' },
      { id: '2', description: 'SPOTIFY' },
      { id: '3', description: 'NETFLIX BR' },
    ]
    const result = filterTransacoesByRegra(txs, { padrao: 'NETFLIX', tipoMatch: 'CONTAINS' })
    expect(result.map((t) => t.id)).toEqual(['1', '3'])
  })

  it('array vazio quando nenhuma bate', () => {
    const txs = [{ id: '1', description: 'foo' }]
    expect(filterTransacoesByRegra(txs, { padrao: 'BAR', tipoMatch: 'EXACT' })).toEqual([])
  })

  it('preserva ordem original', () => {
    const txs = [
      { id: 'c', description: 'NETFLIX' },
      { id: 'a', description: 'foo' },
      { id: 'b', description: 'NETFLIX BR' },
    ]
    const result = filterTransacoesByRegra(txs, { padrao: 'NETFLIX', tipoMatch: 'CONTAINS' })
    expect(result.map((t) => t.id)).toEqual(['c', 'b'])
  })
})
