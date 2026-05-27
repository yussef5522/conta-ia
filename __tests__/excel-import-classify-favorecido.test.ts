// Sprint 5.0.2.0 — classifyFavorecido + inferEmployeeTipo.

import { describe, it, expect } from 'vitest'
import {
  classifyFavorecido,
  inferEmployeeTipo,
} from '@/lib/excel-import/classify-favorecido'

describe('classifyFavorecido — coluna Beneficiário explícita (planilha ASSECONT)', () => {
  it('Beneficiário="Fornecedores" → SUPPLIER', () => {
    const r = classifyFavorecido({
      favorecido: 'GESTRA TREINAMENTOS',
      beneficiarioTipo: 'Fornecedores',
    })
    expect(r.type).toBe('SUPPLIER')
    expect(r.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('Beneficiário="Colaboradores" → EMPLOYEE', () => {
    const r = classifyFavorecido({
      favorecido: 'ANA CAROLINE',
      beneficiarioTipo: 'Colaboradores',
      centroCusto: 'Salário Recepção',
    })
    expect(r.type).toBe('EMPLOYEE')
    expect(r.employeeTipo).toBe('CLT')
    expect(r.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('Beneficiário="Órgãos oficiais" → ORGAO_PUBLICO', () => {
    const r = classifyFavorecido({
      favorecido: 'RECEITA FEDERAL DO BRASIL',
      beneficiarioTipo: 'Órgãos oficiais',
    })
    expect(r.type).toBe('ORGAO_PUBLICO')
    expect(r.confidence).toBeGreaterThanOrEqual(0.9)
  })
})

describe('classifyFavorecido — heurística por nome (sem coluna Beneficiário)', () => {
  it('GESTRA TREINAMENTOS E MEDICINA DO TRABALHO LTDA → SUPPLIER', () => {
    const r = classifyFavorecido({
      favorecido: 'GESTRA TREINAMENTOS E MEDICINA DO TRABALHO LTDA',
    })
    expect(r.type).toBe('SUPPLIER')
    expect(r.reason).toMatch(/jurídica/)
  })

  it('RECEITA FEDERAL → ORGAO_PUBLICO', () => {
    const r = classifyFavorecido({ favorecido: 'PAGAMENTO RECEITA FEDERAL' })
    expect(r.type).toBe('ORGAO_PUBLICO')
  })

  it('INSS RECOLHIMENTO → ORGAO_PUBLICO', () => {
    const r = classifyFavorecido({ favorecido: 'INSS RECOLHIMENTO ABRIL' })
    expect(r.type).toBe('ORGAO_PUBLICO')
  })

  it('PREFEITURA MUNICIPAL → ORGAO_PUBLICO', () => {
    const r = classifyFavorecido({ favorecido: 'PREFEITURA MUNICIPAL SÃO BORJA' })
    expect(r.type).toBe('ORGAO_PUBLICO')
  })

  it('JOSE LUIS NEDEL → EMPLOYEE (pessoa física)', () => {
    const r = classifyFavorecido({ favorecido: 'JOSE LUIS NEDEL' })
    expect(r.type).toBe('EMPLOYEE')
    expect(r.employeeTipo).toBe('CLT') // default sem centro custo
  })

  it('ANA CAROLINE EMANUELI → EMPLOYEE', () => {
    const r = classifyFavorecido({
      favorecido: 'ANA CAROLINE EMANUELI',
      centroCusto: 'Salário Estagiário',
    })
    expect(r.type).toBe('EMPLOYEE')
    expect(r.employeeTipo).toBe('ESTAGIO')
  })

  it('SPAL IND BRAS DE BEBIDAS → SUPPLIER (forma jurídica)', () => {
    const r = classifyFavorecido({
      favorecido: 'SPAL INDÚSTRIA BRASILEIRA DE BEBIDAS SA',
    })
    expect(r.type).toBe('SUPPLIER')
  })

  it('AMBEV ME → SUPPLIER (microempresa)', () => {
    const r = classifyFavorecido({ favorecido: 'AMBEV ME' })
    expect(r.type).toBe('SUPPLIER')
  })

  it('Nome curto ambíguo → SUPPLIER default', () => {
    const r = classifyFavorecido({ favorecido: 'STONE' })
    expect(r.type).toBe('SUPPLIER')
    expect(r.confidence).toBeLessThan(0.7)
  })
})

describe('inferEmployeeTipo — centro de custo', () => {
  it('Salário Estagiário → ESTAGIO', () => {
    expect(inferEmployeeTipo('Salário Estagiário')).toBe('ESTAGIO')
  })

  it('Salário Professor → CLT', () => {
    expect(inferEmployeeTipo('Salário Professor')).toBe('CLT')
  })

  it('Salário Recepção → CLT', () => {
    expect(inferEmployeeTipo('Salário Recepção')).toBe('CLT')
  })

  it('Honorários Autônomo → AUTONOMO', () => {
    expect(inferEmployeeTipo('Honorários Autônomo')).toBe('AUTONOMO')
  })

  it('Prestador PJ → PJ', () => {
    expect(inferEmployeeTipo('Pagamento PJ Mensal')).toBe('PJ')
  })

  it('Sem match → CLT default', () => {
    expect(inferEmployeeTipo('Vale Transporte')).toBe('CLT')
  })

  it('null → CLT', () => {
    expect(inferEmployeeTipo(null)).toBe('CLT')
  })
})

describe('classifyFavorecido — prioridade: coluna explícita > heurística', () => {
  it('Mesmo com nome jurídico, Beneficiário="Colaboradores" sobrescreve', () => {
    // Caso edge: PJ de um professor — planilha diz Colaboradores, respeitamos
    const r = classifyFavorecido({
      favorecido: 'PROFESSOR JOÃO LTDA',
      beneficiarioTipo: 'Colaboradores',
    })
    expect(r.type).toBe('EMPLOYEE')
  })
})
