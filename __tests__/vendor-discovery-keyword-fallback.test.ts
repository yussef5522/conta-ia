// Sprint 5.0.2.o — Keyword fallback BR (casos reais Cacula Mix).

import { describe, it, expect } from 'vitest'
import {
  matchByRazaoSocialKeywords,
  RAZAO_SOCIAL_KEYWORDS_BR,
} from '@/lib/vendor-discovery/keyword-fallback'

describe('matchByRazaoSocialKeywords — casos reais do extrato Cacula Mix', () => {
  it('BOX PAPER EMBALAGENS LTDA → Material de Embalagem', () => {
    const r = matchByRazaoSocialKeywords('BOX PAPER EMBALAGENS LTDA', 'DEBIT')
    expect(r?.category).toBe('Material de Embalagem')
    expect(r?.matchedKeyword).toBe('EMBALAGENS')
    expect(r?.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('CONSERVAS ODERICH S A → Fornecedor Alimentos', () => {
    const r = matchByRazaoSocialKeywords('CONSERVAS ODERICH S A', 'DEBIT')
    expect(r?.category).toBe('Fornecedor Alimentos')
    expect(r?.matchedKeyword).toBe('CONSERVAS')
  })

  it('CASPER DISTRIBUIDORA DE PRODUTOS ALIMENTICIOS LTDA → Fornecedor Alimentos (specific > generic)', () => {
    // "PRODUTOS ALIMENTICIOS" deve bater antes de "DISTRIBUIDORA" (confidence)
    const r = matchByRazaoSocialKeywords(
      'CASPER DISTRIBUIDORA DE PRODUTOS ALIMENTICIOS LTDA',
      'DEBIT',
    )
    expect(r?.category).toBe('Fornecedor Alimentos')
  })

  it('TECNOPONTO TEC AVANCADA EM CONTROL DE P DE ACESSO → Software/Tecnologia', () => {
    const r = matchByRazaoSocialKeywords(
      'TECNOPONTO TEC AVANCADA EM CONTROL DE P DE ACESSO',
      'DEBIT',
    )
    expect(r?.category).toBe('Software/Tecnologia')
    expect(r?.confidence).toBeGreaterThanOrEqual(0.92)
  })

  it('SPAL IND BRAS DE BEBIDAS SA → Fornecedor Bebidas', () => {
    const r = matchByRazaoSocialKeywords('SPAL IND BRAS DE BEBIDAS SA', 'DEBIT')
    expect(r?.category).toBe('Fornecedor Bebidas')
    expect(r?.matchedKeyword).toBe('BEBIDAS')
  })

  it('AMBEV (sem keyword mas descrição contém marca) → não bate keyword (deixa cair pro Claude)', () => {
    // O fallback é por PALAVRA na razão social. AMBEV não bate em nenhuma
    // keyword (não tem "BEBIDAS" no nome). Esse caso é reconhecimento direto
    // do Claude (PARTE A).
    const r = matchByRazaoSocialKeywords('PAGAMENTO AMBEV S A', 'DEBIT')
    expect(r).toBeNull()
  })
})

describe('matchByRazaoSocialKeywords — palavras-chave genéricas', () => {
  it('FRIGORIFICO XYZ → Fornecedor Carnes', () => {
    const r = matchByRazaoSocialKeywords('FRIGORIFICO BOM SABOR LTDA', 'DEBIT')
    expect(r?.category).toBe('Fornecedor Carnes')
  })

  it('PADARIA SAO JOSE → Padaria', () => {
    const r = matchByRazaoSocialKeywords('PADARIA SAO JOSE', 'DEBIT')
    expect(r?.category).toBe('Padaria')
  })

  it('HORTIFRUTI DO BAIRRO → Hortifruti', () => {
    const r = matchByRazaoSocialKeywords('HORTIFRUTI DO BAIRRO', 'DEBIT')
    expect(r?.category).toBe('Hortifruti')
  })

  it('POSTO  com espaço → Combustível', () => {
    const r = matchByRazaoSocialKeywords('POSTO IPIRANGA 1234', 'DEBIT')
    expect(r?.category).toBe('Combustível')
  })

  it('CONTABILIDADE BETA → Honorários Contábeis', () => {
    const r = matchByRazaoSocialKeywords('CONTABILIDADE BETA', 'DEBIT')
    expect(r?.category).toBe('Honorários Contábeis')
  })

  it('ADVOCACIA SILVA → Honorários Jurídicos', () => {
    const r = matchByRazaoSocialKeywords('ADVOCACIA SILVA E ASSOC', 'DEBIT')
    expect(r?.category).toBe('Honorários Jurídicos')
  })

  it('TRANSPORTADORA RAPIDA → Frete', () => {
    const r = matchByRazaoSocialKeywords('TRANSPORTADORA RAPIDA LTDA', 'DEBIT')
    expect(r?.category).toBe('Frete')
  })

  it('CLINICA MEDICA → Saúde', () => {
    const r = matchByRazaoSocialKeywords('CLINICA MEDICA POPULAR', 'DEBIT')
    expect(r?.category).toBe('Saúde')
  })

  it('FARMACIA AGUIA → Material Médico', () => {
    const r = matchByRazaoSocialKeywords('FARMACIA AGUIA', 'DEBIT')
    expect(r?.category).toBe('Material Médico')
  })

  it('AUTO PECAS AURORA → Manutenção Veículos', () => {
    const r = matchByRazaoSocialKeywords('AUTO PECAS AURORA', 'DEBIT')
    expect(r?.category).toBe('Manutenção Veículos')
  })

  it('ATACADO XYZ (genérico, baixa confidence) → Compras Mercadoria', () => {
    const r = matchByRazaoSocialKeywords('ATACADO MEU BAIRRO LTDA', 'DEBIT')
    expect(r?.category).toBe('Compras Mercadoria')
    expect(r?.confidence).toBeLessThan(0.85)
  })
})

describe('matchByRazaoSocialKeywords — case insensitive + acentos', () => {
  it('lowercase entrada → ainda bate', () => {
    const r = matchByRazaoSocialKeywords('conservas oderich s a', 'DEBIT')
    expect(r?.category).toBe('Fornecedor Alimentos')
  })

  it('acentos na entrada são removidos (alimentícios → alimenticios)', () => {
    const r = matchByRazaoSocialKeywords(
      'CASPER DISTRIBUIDORA DE PRODUTOS ALIMENTÍCIOS LTDA',
      'DEBIT',
    )
    expect(r?.category).toBe('Fornecedor Alimentos')
  })
})

describe('matchByRazaoSocialKeywords — edge cases', () => {
  it('null → null', () => {
    expect(matchByRazaoSocialKeywords(null, 'DEBIT')).toBeNull()
  })

  it('descrição vazia → null', () => {
    expect(matchByRazaoSocialKeywords('', 'DEBIT')).toBeNull()
  })

  it('descrição sem nenhuma keyword → null', () => {
    const r = matchByRazaoSocialKeywords('JOSE GONCALVES SILVA', 'DEBIT')
    expect(r).toBeNull()
  })

  it('type=CREDIT NÃO roda (só DEBIT)', () => {
    const r = matchByRazaoSocialKeywords('CONSERVAS ODERICH', 'CREDIT')
    expect(r).toBeNull()
  })
})

describe('matchByRazaoSocialKeywords — priorização (specific > generic)', () => {
  it('TECNOPONTO (95%) vence SOFTWARE genérico (88%)', () => {
    const r = matchByRazaoSocialKeywords(
      'TECNOPONTO TEC AVANCADA EM SOFTWARE',
      'DEBIT',
    )
    expect(r?.confidence).toBeGreaterThanOrEqual(0.95)
    expect(r?.matchedKeyword).toBe('TECNOPONTO')
  })

  it('ALIMENTOS específico vence DISTRIBUIDORA genérico', () => {
    const r = matchByRazaoSocialKeywords(
      'DISTRIBUIDORA DE ALIMENTOS GAUCHA',
      'DEBIT',
    )
    expect(r?.category).toBe('Fornecedor Alimentos')
  })
})

describe('RAZAO_SOCIAL_KEYWORDS_BR — sanidade da lista', () => {
  it('tem ≥ 20 mappings', () => {
    expect(RAZAO_SOCIAL_KEYWORDS_BR.length).toBeGreaterThanOrEqual(20)
  })

  it('todas confidences entre 0.7 e 1.0', () => {
    for (const m of RAZAO_SOCIAL_KEYWORDS_BR) {
      expect(m.confidence).toBeGreaterThanOrEqual(0.7)
      expect(m.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('keywords são UPPERCASE', () => {
    for (const m of RAZAO_SOCIAL_KEYWORDS_BR) {
      for (const kw of m.keywords) {
        expect(kw).toBe(kw.toUpperCase())
      }
    }
  })

  it('categorias não são genéricas demais (sem "A Categorizar" ou "Despesas Diversas")', () => {
    const genericos = new Set([
      'A Categorizar',
      'Classificar manualmente',
      'Despesas Diversas',
    ])
    for (const m of RAZAO_SOCIAL_KEYWORDS_BR) {
      expect(genericos.has(m.category)).toBe(false)
    }
  })
})
