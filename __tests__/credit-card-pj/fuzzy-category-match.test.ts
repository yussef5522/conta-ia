// Sprint Cartao R2 — testes do fuzzy match

import { describe, it, expect } from 'vitest'
import { fuzzyMatchCategory, type CategoryForMatch } from '@/lib/credit-card-pj/fuzzy-category-match'

const cats: CategoryForMatch[] = [
  { id: 'marketing', name: 'Marketing e Publicidade', type: 'EXPENSE' },
  { id: 'software', name: 'Software / Assinaturas', type: 'EXPENSE' },
  { id: 'refeicoes', name: 'Refeições', type: 'EXPENSE' },
  { id: 'transporte', name: 'Transporte', type: 'EXPENSE' },
  { id: 'combustivel', name: 'Combustível', type: 'EXPENSE' },
  { id: 'material', name: 'Material de Escritório', type: 'EXPENSE' },
  { id: 'fin', name: 'Despesas Financeiras', type: 'EXPENSE' },
  { id: 'inc-receita', name: 'Receita Bruta', type: 'INCOME' },
]

describe('fuzzyMatchCategory', () => {
  it('match EXACT case-insensitive', () => {
    const r = fuzzyMatchCategory('Marketing e Publicidade', cats)
    expect(r?.categoryId).toBe('marketing')
    expect(r?.matchType).toBe('EXACT')
    expect(r?.confidence).toBeCloseTo(0.95)
  })

  it('match EXACT acentos-insensitive', () => {
    const r = fuzzyMatchCategory('Refeicoes', cats)
    expect(r?.categoryId).toBe('refeicoes')
    expect(r?.matchType).toBe('EXACT')
  })

  it('match SUBSTRING — sugestao curta dentro do nome', () => {
    const r = fuzzyMatchCategory('Marketing', cats)
    expect(r?.categoryId).toBe('marketing')
    expect(r?.matchType).toBe('SUBSTRING')
    expect(r?.confidence).toBeCloseTo(0.85)
  })

  it('match SUBSTRING — nome dentro da sugestao', () => {
    const r = fuzzyMatchCategory('Combustivel pra carro', cats)
    expect(r?.categoryId).toBe('combustivel')
    expect(r?.matchType).toBe('SUBSTRING')
  })

  it('match TOKENS — sugestao com palavras compartilhadas', () => {
    const r = fuzzyMatchCategory('Software', cats)
    expect(r?.categoryId).toBe('software')
    expect(r?.matchType).toBe('SUBSTRING')
  })

  it('match TOKENS — sinonimo composto', () => {
    const r = fuzzyMatchCategory('Material escritorio', cats)
    expect(r?.categoryId).toBe('material')
  })

  it('NAO match em INCOME (filtra a Receita Bruta)', () => {
    const r = fuzzyMatchCategory('Receita Bruta', cats)
    expect(r).toBeNull()
  })

  it('NAO match quando nao acha nada parecido', () => {
    const r = fuzzyMatchCategory('Foo Bar Inexistente Qualquer', cats)
    expect(r).toBeNull()
  })

  it('NAO match em string vazia', () => {
    expect(fuzzyMatchCategory('', cats)).toBeNull()
    expect(fuzzyMatchCategory('   ', cats)).toBeNull()
  })

  it('NAO match quando nao tem cats EXPENSE', () => {
    const onlyIncome: CategoryForMatch[] = [{ id: 'x', name: 'Receita', type: 'INCOME' }]
    expect(fuzzyMatchCategory('Marketing', onlyIncome)).toBeNull()
  })

  it('SUBSTRING prefere nome mais longo (mais especifico)', () => {
    const c2: CategoryForMatch[] = [
      { id: 'curto', name: 'Software', type: 'EXPENSE' },
      { id: 'longo', name: 'Software / Assinaturas', type: 'EXPENSE' },
    ]
    const r = fuzzyMatchCategory('Software Assinatura', c2)
    // O nome mais longo casa via SUBSTRING (Software contém em ambos)
    // ordering por b.name.length-a.name.length faz o "longo" vir primeiro
    expect(r?.matchedName).toBe('Software / Assinaturas')
  })
})
