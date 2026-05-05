import { describe, it, expect } from 'vitest'
import { slugify, generateTemplateKey } from '../lib/categories/template-key'

describe('slugify', () => {
  it('lowercase: "Aluguel" → "aluguel"', () => {
    expect(slugify('Aluguel')).toBe('aluguel')
  })

  it('remove acentos: "Salários e pró-labore" → "salarios_e_pro_labore"', () => {
    expect(slugify('Salários e pró-labore')).toBe('salarios_e_pro_labore')
  })

  it('espaços viram underscore: "Material de consumo" → "material_de_consumo"', () => {
    expect(slugify('Material de consumo')).toBe('material_de_consumo')
  })

  it('remove caracteres especiais: "Receita 100%!" → "receita_100"', () => {
    expect(slugify('Receita 100%!')).toBe('receita_100')
  })

  it('hífens viram underscore: "pré-labore" → "pre_labore"', () => {
    expect(slugify('pré-labore')).toBe('pre_labore')
  })

  it('colapsa underscores múltiplos no trim das pontas', () => {
    expect(slugify('  aluguel  ')).toBe('aluguel')
    expect(slugify('--aluguel--')).toBe('aluguel')
  })

  it('cedilha removida: "operações" → "operacoes"', () => {
    expect(slugify('operações')).toBe('operacoes')
  })

  it('determinístico: mesma entrada → mesmo resultado', () => {
    expect(slugify('Salários e pró-labore')).toBe(slugify('Salários e pró-labore'))
    expect(slugify('Aluguel')).toBe(slugify('Aluguel'))
  })
})

describe('generateTemplateKey', () => {
  it('formato setor:dreGroup:slug', () => {
    expect(
      generateTemplateKey('RESTAURANT', 'DESPESAS_ADMINISTRATIVAS', 'Aluguel'),
    ).toBe('RESTAURANT:DESPESAS_ADMINISTRATIVAS:aluguel')
  })

  it('setor lowercase é uppercased', () => {
    expect(
      generateTemplateKey('restaurant', 'DESPESAS_ADMINISTRATIVAS', 'Aluguel'),
    ).toBe('RESTAURANT:DESPESAS_ADMINISTRATIVAS:aluguel')
  })

  it('dreGroup também é uppercased', () => {
    expect(
      generateTemplateKey('SERVICE', 'receita_bruta', 'Mensalidades'),
    ).toBe('SERVICE:RECEITA_BRUTA:mensalidades')
  })

  it('nome com acentos é normalizado no slug', () => {
    expect(
      generateTemplateKey('SERVICE', 'DESPESAS_PESSOAL', 'Salários e pró-labore'),
    ).toBe('SERVICE:DESPESAS_PESSOAL:salarios_e_pro_labore')
  })

  it('determinístico: mesma entrada → mesma chave', () => {
    const a = generateTemplateKey('RESTAURANT', 'RECEITA_BRUTA', 'Vendas no Salão')
    const b = generateTemplateKey('RESTAURANT', 'RECEITA_BRUTA', 'Vendas no Salão')
    expect(a).toBe(b)
  })

  it('case-insensitive no nome (mas não no setor/dre)', () => {
    const a = generateTemplateKey('SERVICE', 'RECEITA_BRUTA', 'Mensalidades')
    const b = generateTemplateKey('SERVICE', 'RECEITA_BRUTA', 'mensalidades')
    const c = generateTemplateKey('SERVICE', 'RECEITA_BRUTA', 'MENSALIDADES')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})
