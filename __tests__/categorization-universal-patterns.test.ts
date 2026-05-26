// Sprint 5.0.2.l — Padrões universais brasileiros + engine matchUniversalPattern.

import { describe, it, expect } from 'vitest'
import {
  matchUniversalPattern,
  resolveUniversalCategoryId,
  UNIVERSAL_AUTO_THRESHOLD,
} from '@/lib/categorization/apply-universal-patterns'
import {
  UNIVERSAL_PATTERNS_BR,
  UNIVERSAL_PATTERN_CATEGORIES,
} from '@/lib/categorization/universal-patterns-br'

describe('matchUniversalPattern — receitas (cartões)', () => {
  it('PAGAMENTO STONE em CREDIT → Receita Cartão (AUTO)', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO STONE 03/05/2026',
      type: 'CREDIT',
    })
    expect(r).not.toBeNull()
    expect(r?.pattern.categoryNameHint).toBe('Receita Cartão')
    expect(r?.tier).toBe('AUTO')
  })

  it('PAGAMENTO STONE em DEBIT → não bate (tipo errado)', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO STONE 03/05/2026',
      type: 'DEBIT',
    })
    expect(r).toBeNull()
  })

  it('CRED STONE em CREDIT → Receita Cartão', () => {
    const r = matchUniversalPattern({
      description: 'CRED STONE 1234567890',
      type: 'CREDIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Receita Cartão')
  })

  it('LIQUIDACAO ADQUIRENTE → Receita Cartão', () => {
    const r = matchUniversalPattern({
      description: 'LIQUIDACAO ADQUIRENTE CIELO',
      type: 'CREDIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Receita Cartão')
  })

  it('RECEBIMENTO PIX → Receita Pix (SUGGEST tier)', () => {
    const r = matchUniversalPattern({
      description: 'RECEBIMENTO PIX-PIX_CRED 86284304072 MURILLO',
      type: 'CREDIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Receita Pix')
    expect(r?.tier).toBe('SUGGEST') // confidence 0.80 < 0.90
  })
})

describe('matchUniversalPattern — tributários', () => {
  it('DARF → Tributos Federais (AUTO)', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO DARF 0420',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Tributos Federais')
    expect(r?.tier).toBe('AUTO')
  })

  it('DAS SIMPLES tem precedência sobre DARF (length desc)', () => {
    const r = matchUniversalPattern({
      description: 'DAS SIMPLES NACIONAL',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('DAS Simples Nacional')
  })

  it('GPS INSS → INSS', () => {
    const r = matchUniversalPattern({
      description: 'PAGTO GPS INSS COMP 04/2026',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('INSS')
  })

  it('FGTS → FGTS (AUTO)', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO FGTS COMP 04/2026',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('FGTS')
    expect(r?.tier).toBe('AUTO')
  })

  it('GUIA ICMS → ICMS', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO GUIA ICMS SC',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('ICMS')
  })

  it('ICMS ST tem precedência sobre ICMS', () => {
    const r = matchUniversalPattern({
      description: 'ICMS ST IMPORTACAO',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('ICMS-ST')
  })

  it('IPTU → IPTU', () => {
    const r = matchUniversalPattern({
      description: 'IPTU 2026 PARCELA 5',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('IPTU')
  })
})

describe('matchUniversalPattern — bancárias', () => {
  it('TARIFA PIX → Tarifas Bancárias', () => {
    const r = matchUniversalPattern({
      description: 'TARIFA PIX ENVIO',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Tarifas Bancárias')
  })

  it('TARIFA STONE tem precedência sobre TARIFA solta', () => {
    const r = matchUniversalPattern({
      description: 'TARIFA STONE ANTECIPACAO',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Taxa Cartão')
  })

  it('IOF → Tarifas Bancárias', () => {
    const r = matchUniversalPattern({
      description: 'IOF SOBRE OPERACAO',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Tarifas Bancárias')
  })

  it('CHEQUE ESPECIAL → Juros e Encargos', () => {
    const r = matchUniversalPattern({
      description: 'JUROS CHEQUE ESPECIAL 04/2026',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Juros e Encargos')
  })
})

describe('matchUniversalPattern — utilidades', () => {
  it('CELESC → Energia Elétrica', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO CELESC CONTA 04/2026',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Energia Elétrica')
  })

  it('SABESP → Água e Esgoto', () => {
    const r = matchUniversalPattern({
      description: 'SABESP FATURA',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Água e Esgoto')
  })

  it('VIVO espaço → Telefonia (word boundary mitiga falsos positivos)', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO VIVO INTERNET',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Telefonia e Internet')
  })

  it('VIVOS (sem espaço) NÃO bate em VIVO ', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO VIVOSEGUROS',
      type: 'DEBIT',
    })
    // VIVO  (com espaço) não bate em VIVOSEGUROS
    expect(r?.pattern.categoryNameHint).not.toBe('Telefonia e Internet')
  })
})

describe('matchUniversalPattern — folha + ops', () => {
  it('FOLHA PAGAMENTO → Salários', () => {
    const r = matchUniversalPattern({
      description: 'FOLHA PAGAMENTO 04/2026',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Salários')
  })

  it('VALE TRANSPORTE → Vale Transporte', () => {
    const r = matchUniversalPattern({
      description: 'VALE TRANSPORTE COMP 04/2026',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Vale Transporte')
  })

  it('ALUGUEL → Aluguel', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO ALUGUEL SEDE',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Aluguel')
  })

  it('POSTO  → Combustível', () => {
    const r = matchUniversalPattern({
      description: 'POSTO IPIRANGA 123',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Combustível')
  })
})

describe('matchUniversalPattern — apps', () => {
  it('UBER  espaço → Transporte Uber', () => {
    const r = matchUniversalPattern({
      description: 'UBER TRIP',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Transporte (Uber)')
  })

  it('IFOOD → Alimentação', () => {
    const r = matchUniversalPattern({
      description: 'IFOOD PAGAMENTO',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Alimentação')
  })

  it('NETFLIX → Assinaturas', () => {
    const r = matchUniversalPattern({
      description: 'NETFLIX MENSALIDADE',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Assinaturas')
  })

  it('AMAZON AWS → Software/Tecnologia', () => {
    const r = matchUniversalPattern({
      description: 'AMAZON AWS PAGAMENTO',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Software/Tecnologia')
  })
})

describe('matchUniversalPattern — estornos (ANY)', () => {
  it('ESTORNO em CREDIT → Estornos', () => {
    const r = matchUniversalPattern({
      description: 'ESTORNO COMPRA CARTAO',
      type: 'CREDIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Estornos')
  })

  it('ESTORNO em DEBIT → Estornos (ANY casa)', () => {
    const r = matchUniversalPattern({
      description: 'ESTORNO COMPRA CARTAO',
      type: 'DEBIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Estornos')
  })
})

describe('matchUniversalPattern — edge cases', () => {
  it('descrição null → null', () => {
    expect(matchUniversalPattern({ description: null, type: 'DEBIT' })).toBeNull()
  })

  it('descrição vazia → null', () => {
    expect(matchUniversalPattern({ description: '', type: 'DEBIT' })).toBeNull()
  })

  it('descrição sem match → null', () => {
    const r = matchUniversalPattern({
      description: 'ALGUMA TRANSACAO QUALQUER SEM MATCH',
      type: 'DEBIT',
    })
    expect(r).toBeNull()
  })

  it('type null/undefined com pattern tipo INCOME → não bate', () => {
    const r = matchUniversalPattern({
      description: 'PAGAMENTO STONE',
      type: null,
    })
    expect(r).toBeNull()
  })

  it('type null com pattern ANY → bate', () => {
    const r = matchUniversalPattern({
      description: 'ESTORNO COMPRA',
      type: null,
    })
    expect(r?.pattern.categoryNameHint).toBe('Estornos')
  })

  it('case insensitive (lowercase input)', () => {
    const r = matchUniversalPattern({
      description: 'pagamento stone',
      type: 'CREDIT',
    })
    expect(r?.pattern.categoryNameHint).toBe('Receita Cartão')
  })
})

describe('UNIVERSAL_AUTO_THRESHOLD coerência', () => {
  it('threshold é 0.9', () => {
    expect(UNIVERSAL_AUTO_THRESHOLD).toBe(0.9)
  })

  it('todo pattern tem confidence entre 0.70 e 1.0', () => {
    for (const p of UNIVERSAL_PATTERNS_BR) {
      expect(p.confidence).toBeGreaterThanOrEqual(0.7)
      expect(p.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('todo pattern tem matchType válido', () => {
    for (const p of UNIVERSAL_PATTERNS_BR) {
      expect(['STARTS_WITH', 'CONTAINS', 'EQUALS']).toContain(p.matchType)
    }
  })

  it('todo pattern tem dreGroup válido', () => {
    const validGroups = new Set([
      'RECEITA_BRUTA',
      'DEDUCOES',
      'CUSTO_PRODUTO_VENDIDO',
      'DESPESAS_COMERCIAIS',
      'DESPESAS_ADMINISTRATIVAS',
      'DESPESAS_PESSOAL',
      'RECEITAS_FINANCEIRAS',
      'DESPESAS_FINANCEIRAS',
      'OUTRAS_RECEITAS',
      'OUTRAS_DESPESAS',
      'IMPOSTOS_SOBRE_LUCRO',
      'TRANSFERENCIA',
    ])
    for (const p of UNIVERSAL_PATTERNS_BR) {
      expect(validGroups.has(p.dreGroup)).toBe(true)
    }
  })
})

describe('UNIVERSAL_PATTERN_CATEGORIES — derivação', () => {
  it('tem pelo menos 25 categorias únicas', () => {
    expect(UNIVERSAL_PATTERN_CATEGORIES.length).toBeGreaterThanOrEqual(25)
  })

  it('cada categoria tem txType derivado corretamente', () => {
    for (const c of UNIVERSAL_PATTERN_CATEGORIES) {
      if (c.dreGroup === 'RECEITA_BRUTA' || c.dreGroup === 'OUTRAS_RECEITAS') {
        expect(c.txType).toBe('INCOME')
      } else if (c.dreGroup === 'TRANSFERENCIA') {
        expect(c.txType).toBe('TRANSFER')
      } else {
        expect(c.txType).toBe('EXPENSE')
      }
    }
  })

  it('não tem duplicatas (name × dreGroup)', () => {
    const seen = new Set<string>()
    for (const c of UNIVERSAL_PATTERN_CATEGORIES) {
      const key = `${c.name}|${c.dreGroup}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('resolveUniversalCategoryId', () => {
  const cats = [
    { id: 'cat-receita-cartao', name: 'Receita Cartão', dreGroup: 'RECEITA_BRUTA', isActive: true },
    { id: 'cat-receita-pix', name: 'Receita Pix', dreGroup: 'RECEITA_BRUTA', isActive: true },
    { id: 'cat-fgts', name: 'FGTS', dreGroup: 'DESPESAS_PESSOAL', isActive: true },
    { id: 'cat-energia', name: 'Energia Elétrica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', isActive: true },
    { id: 'cat-outra-admin', name: 'Outra Despesa Admin', dreGroup: 'DESPESAS_ADMINISTRATIVAS', isActive: true },
    { id: 'cat-inativa', name: 'Inativa', dreGroup: 'RECEITA_BRUTA', isActive: false },
  ]

  it('match exato por nome', () => {
    const id = resolveUniversalCategoryId(cats, {
      categoryNameHint: 'Receita Cartão',
      dreGroup: 'RECEITA_BRUTA',
    })
    expect(id).toBe('cat-receita-cartao')
  })

  it('match case-insensitive', () => {
    const id = resolveUniversalCategoryId(cats, {
      categoryNameHint: 'RECEITA CARTÃO',
      dreGroup: 'RECEITA_BRUTA',
    })
    expect(id).toBe('cat-receita-cartao')
  })

  it('match parcial + dreGroup', () => {
    const id = resolveUniversalCategoryId(cats, {
      categoryNameHint: 'Energia',
      dreGroup: 'DESPESAS_ADMINISTRATIVAS',
    })
    expect(id).toBe('cat-energia')
  })

  it('fallback por dreGroup quando nome não bate', () => {
    const id = resolveUniversalCategoryId(cats, {
      categoryNameHint: 'Categoria Que Nao Existe',
      dreGroup: 'DESPESAS_ADMINISTRATIVAS',
    })
    // Primeira categoria ATIVA com dreGroup matching = cat-energia
    expect(id).toBe('cat-energia')
  })

  it('null quando nada bate', () => {
    const id = resolveUniversalCategoryId(cats, {
      categoryNameHint: 'Nada',
      dreGroup: 'IMPOSTOS_SOBRE_LUCRO',
    })
    expect(id).toBeNull()
  })

  it('ignora categoria inativa', () => {
    const id = resolveUniversalCategoryId(cats, {
      categoryNameHint: 'Inativa',
      dreGroup: 'RECEITA_BRUTA',
    })
    // Bate "Receita Cartão" como fallback dreGroup pq Inativa.isActive=false
    expect(id).toBe('cat-receita-cartao')
  })
})
