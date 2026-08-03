import { describe, it, expect } from 'vitest'
import { matchCounterpartyRule, counterpartyRulePattern, type CpRule } from '../rules'
import { detectCounterpartyCompany, type CompanyRef } from '../detect-company'
import { buildCounterpartySuggestion } from '../suggest'
import { computeCacheKey } from '@/lib/ai-categorizer/claude-cache'

const rule = (padrao: string, categoryId: string | null = 'cat1'): CpRule => ({ id: 'r_' + padrao, padrao: counterpartyRulePattern(padrao), categoryId })

describe('matchCounterpartyRule', () => {
  it('casa na 2ª ocorrência (regra criada na 1ª)', () => {
    const rules = [rule('RECEITA FEDERAL', 'impostos')]
    expect(matchCounterpartyRule('RECEITA FEDERAL', rules)?.categoryId).toBe('impostos')
    expect(matchCounterpartyRule('Receita  Federal', rules)?.categoryId).toBe('impostos') // caixa/espaço
  })
  it('nome TRUNCADO pelo banco casa com o completo da regra', () => {
    const rules = [rule('GRUBERT E BRAGA COMERCIO DE COLCHOES LTDA', 'fornecedores')]
    // PDF entregou truncado:
    expect(matchCounterpartyRule('GRUBERT E BRAGA COMERCIO DE COLCHOES LT', rules)?.categoryId).toBe('fornecedores')
  })
  it('nomes DIFERENTES não colidem', () => {
    const rules = [rule('MARCOS ADRIEL LEAL KERNBAUM', 'x')]
    expect(matchCounterpartyRule('MARIANA COSTA SILVA', rules)).toBeNull()
    expect(matchCounterpartyRule('ANA', [rule('ANTONIO', 'y')])).toBeNull()
  })
  it('sem contraparte / sem regra → null (fluxo atual intacto)', () => {
    expect(matchCounterpartyRule(null, [rule('X')])).toBeNull()
    expect(matchCounterpartyRule('QUALQUER', [])).toBeNull()
  })
})

describe('detectCounterpartyCompany (cadastro, não lista de nomes)', () => {
  const own: CompanyRef = { id: 'own', name: 'profit itaqui ltda', cnpj: '44282144000153' }
  const outra: CompanyRef = { id: 'one', name: 'PRO FIT ONE LTDA', cnpj: '11222333000144' }

  it('PRÓPRIA empresa (grafia "PRO FIT"↔"profit") → OWN', () => {
    expect(detectCounterpartyCompany('PRO FIT ITAQUI LTDA', null, own, [outra])).toEqual({ kind: 'OWN' })
  })
  it('INTRA-GRUPO por razão social → aponta a empresa', () => {
    const r = detectCounterpartyCompany('PRO FIT ONE LTDA', null, own, [outra])
    expect(r).toMatchObject({ kind: 'INTRA_GROUP' })
    expect((r as { company: CompanyRef }).company.id).toBe('one')
  })
  it('INTRA-GRUPO por CNPJ (mais forte)', () => {
    const r = detectCounterpartyCompany('NOME QUALQUER', '11.222.333/0001-44', own, [outra])
    expect((r as { company: CompanyRef }).company.id).toBe('one')
  })
  it('terceiro comum NÃO vira empresa (conservador)', () => {
    expect(detectCounterpartyCompany('MARCOS ADRIEL LEAL KERNBAUM', null, own, [outra])).toBeNull()
    expect(detectCounterpartyCompany('PRO FIT', null, own, [outra])).toBeNull() // curto demais, não casa
  })
})

describe('buildCounterpartySuggestion — prioridade + nada auto', () => {
  const own: CompanyRef = { id: 'own', name: 'profit itaqui ltda', cnpj: '44282144000153' }
  const outra: CompanyRef = { id: 'one', name: 'PRO FIT ONE LTDA', cnpj: '11222333000144' }
  const ctx = (rules: CpRule[] = []) => ({ rules, ownCompany: own, otherCompanies: [outra] })

  it('regra do usuário tem prioridade', () => {
    const s = buildCounterpartySuggestion({ counterpartyName: 'RECEITA FEDERAL', counterpartyDocument: null }, ctx([rule('RECEITA FEDERAL', 'impostos')]))
    expect(s).toMatchObject({ kind: 'RULE', categoryId: 'impostos', source: 'RULE' })
  })
  it('intra-grupo NÃO assume transferência — pede a natureza, sem auto-categoria (correção royalties)', () => {
    const s = buildCounterpartySuggestion({ counterpartyName: 'PRO FIT ONE LTDA', counterpartyDocument: null }, ctx())
    expect(s).toMatchObject({ kind: 'INTRA_GROUP', categoryId: null })
    expect(s?.reason).toMatch(/grupo/i)
    expect(s?.reason).toMatch(/royalty/i) // oferece royalty como opção
    expect(s?.reason).toMatch(/escolha/i) // pede pro user decidir
  })
  it('própria empresa → recebimento próprio, não cliente externo', () => {
    const s = buildCounterpartySuggestion({ counterpartyName: 'PRO FIT ITAQUI LTDA', counterpartyDocument: null }, ctx())
    expect(s).toMatchObject({ kind: 'OWN', categoryId: null })
  })
  it('SEM contraparte → null (não sugere nada, fluxo atual intacto)', () => {
    expect(buildCounterpartySuggestion({ counterpartyName: null, counterpartyDocument: null }, ctx())).toBeNull()
  })
})

describe('computeCacheKey — backward-compat (FASE 1.2)', () => {
  it('SEM contraparte → chave IDÊNTICA à antiga (só description)', () => {
    // referência: sha256(normalizeDescription("PIX ENVIADO")) — a mesma coisa sem cp
    const antiga = computeCacheKey('PIX ENVIADO')
    const semCp = computeCacheKey('PIX ENVIADO', null)
    const semCp2 = computeCacheKey('PIX ENVIADO', undefined)
    expect(semCp).toBe(antiga)
    expect(semCp2).toBe(antiga)
  })
  it('COM contraparte → chave diferente da antiga (não colide)', () => {
    const antiga = computeCacheKey('PIX ENVIADO')
    expect(computeCacheKey('PIX ENVIADO', 'RECEITA FEDERAL')).not.toBe(antiga)
  })
  it('duas contrapartes diferentes na MESMA descrição → chaves diferentes', () => {
    expect(computeCacheKey('PIX ENVIADO', 'RECEITA FEDERAL')).not.toBe(computeCacheKey('PIX ENVIADO', 'MARCOS ADRIEL'))
  })
})
