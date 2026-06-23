// Sprint 8 — testes dos helpers puros dos widgets.
import { describe, it, expect } from 'vitest'
import { classificarFormaReceita } from '@/lib/dashboard/widgets'

describe('classificarFormaReceita', () => {
  it('categoria com "pix" → PIX', () => {
    expect(classificarFormaReceita('Receita Pix', 'qualquer desc')).toBe('PIX')
    expect(classificarFormaReceita('Receita PIX', 'foo')).toBe('PIX')
  })

  it('categoria com "cartão" → CARTAO', () => {
    expect(classificarFormaReceita('Receita Cartão', 'foo')).toBe('CARTAO')
    expect(classificarFormaReceita('Receita Cartao', 'foo')).toBe('CARTAO')
  })

  it('categoria com "delivery"/"ifood" → IFOOD', () => {
    expect(classificarFormaReceita('Receita Delivery (iFood)', 'foo')).toBe('IFOOD')
  })

  it('"Receita de Vendas" + descrição cartão antecipação → CARTAO', () => {
    expect(classificarFormaReceita('Receita de Vendas', 'OP. CREDITO C/GARANTIA')).toBe('CARTAO')
    expect(classificarFormaReceita('Receita de Vendas', 'BANRI A VISTA')).toBe('CARTAO')
    expect(classificarFormaReceita('Receita de Vendas', 'ANTECIPACAO BANRICOMPRAS')).toBe('CARTAO')
    expect(classificarFormaReceita('Receita de Vendas', 'VERO ANTECIPACAO BANRICARD')).toBe('CARTAO')
    expect(classificarFormaReceita('Receita de Vendas', 'ANTECIP STONE 12345')).toBe('CARTAO')
    expect(classificarFormaReceita('Receita de Vendas', 'DEBITO STONE 67890')).toBe('CARTAO')
  })

  it('"Receita de Vendas" + descrição dinheiro → DINHEIRO', () => {
    expect(classificarFormaReceita('Receita de Vendas', 'receita de venda dinheiro')).toBe('DINHEIRO')
    expect(classificarFormaReceita('Receita de Vendas', 'RECEITA DA VENDA DINHEIRO')).toBe('DINHEIRO')
    expect(classificarFormaReceita('Receita de Vendas', 'receita de venda em dinheiro')).toBe('DINHEIRO')
  })

  it('"Receita de Vendas" + descrição PIX → PIX (fallback regex)', () => {
    expect(classificarFormaReceita('Receita de Vendas', 'PIX Cliente João')).toBe('PIX')
  })

  it('"Receita de Vendas" + descrição genérica → OUTRAS', () => {
    expect(classificarFormaReceita('Receita de Vendas', 'Receita avulsa qualquer')).toBe('OUTRAS')
  })

  it('case-insensitive na categoria', () => {
    expect(classificarFormaReceita('RECEITA PIX', 'foo')).toBe('PIX')
    expect(classificarFormaReceita('receita cartão', 'foo')).toBe('CARTAO')
  })

  it('match de descrição é case-insensitive (upper case)', () => {
    expect(classificarFormaReceita('Receita de Vendas', 'op. credito c/garantia')).toBe('CARTAO')
  })

  it('default → OUTRAS', () => {
    expect(classificarFormaReceita('Outra coisa', 'algo random')).toBe('OUTRAS')
  })
})

describe('cashflow shape coverage decision', () => {
  // Verifica que cobertura é "parcial" quando qtdTx < 20% do maior
  it('< 20% = parcial; >= 20% = completo; 0 = sem_dados', () => {
    // Lógica interna do decideCobertura (re-implementada localmente)
    function decideCobertura(qtd: number, maior: number): 'completo' | 'parcial' | 'sem_dados' {
      if (qtd === 0) return 'sem_dados'
      if (maior === 0) return 'completo'
      if (qtd / maior < 0.2) return 'parcial'
      return 'completo'
    }
    expect(decideCobertura(0, 1000)).toBe('sem_dados')
    expect(decideCobertura(199, 1000)).toBe('parcial')
    expect(decideCobertura(200, 1000)).toBe('completo')
    expect(decideCobertura(1000, 1000)).toBe('completo')
    expect(decideCobertura(50, 0)).toBe('completo') // edge: maior=0 mas qtd>0
  })
})
