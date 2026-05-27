// Sprint 5.0.2.s — Keyword fallback por SETOR (categoria contábil correta).

import { describe, it, expect } from 'vitest'
import { matchByRazaoSocialKeywords } from '@/lib/vendor-discovery/keyword-fallback'

describe('matchByRazaoSocialKeywords — RESTAURANTE (Matéria-Prima)', () => {
  it('CONSERVAS ODERICH SA → Matéria-Prima - Outros Insumos', () => {
    const r = matchByRazaoSocialKeywords('CONSERVAS ODERICH SA', 'DEBIT', 'RESTAURANTE')
    expect(r?.category).toBe('Matéria-Prima - Outros Insumos')
  })

  it('CASPER DISTRIBUIDORA PRODUTOS ALIMENTICIOS → Matéria-Prima - Outros Insumos', () => {
    const r = matchByRazaoSocialKeywords(
      'CASPER DISTRIBUIDORA PRODUTOS ALIMENTICIOS LTDA',
      'DEBIT',
      'RESTAURANTE',
    )
    expect(r?.category).toBe('Matéria-Prima - Outros Insumos')
  })

  it('SPAL IND BRAS DE BEBIDAS SA → Matéria-Prima - Bebidas', () => {
    const r = matchByRazaoSocialKeywords(
      'SPAL IND BRAS DE BEBIDAS SA',
      'DEBIT',
      'RESTAURANTE',
    )
    expect(r?.category).toBe('Matéria-Prima - Bebidas')
  })

  it('FRIGORIFICO XYZ → Matéria-Prima - Carnes', () => {
    const r = matchByRazaoSocialKeywords('FRIGORIFICO XYZ LTDA', 'DEBIT', 'RESTAURANTE')
    expect(r?.category).toBe('Matéria-Prima - Carnes')
  })

  it('HORTIFRUTI DO BAIRRO → Matéria-Prima - Hortifruti', () => {
    const r = matchByRazaoSocialKeywords('HORTIFRUTI DO BAIRRO', 'DEBIT', 'RESTAURANTE')
    expect(r?.category).toBe('Matéria-Prima - Hortifruti')
  })

  it('BOX PAPER EMBALAGENS → Embalagens - Descartáveis (não Material de Embalagem genérico)', () => {
    const r = matchByRazaoSocialKeywords(
      'BOX PAPER EMBALAGENS LTDA',
      'DEBIT',
      'RESTAURANTE',
    )
    expect(r?.category).toBe('Embalagens - Descartáveis')
  })

  it('PADARIA SAO JOSE → Matéria-Prima - Outros Insumos (setor restaurante)', () => {
    const r = matchByRazaoSocialKeywords('PADARIA SAO JOSE', 'DEBIT', 'RESTAURANTE')
    expect(r?.category).toBe('Matéria-Prima - Outros Insumos')
  })
})

describe('matchByRazaoSocialKeywords — ACADEMIA (Mercadoria Revenda)', () => {
  it('SUPLEMENTOS MAX → Mercadoria Revenda - Suplementos', () => {
    const r = matchByRazaoSocialKeywords('SUPLEMENTOS MAX LTDA', 'DEBIT', 'ACADEMIA')
    expect(r?.category).toBe('Mercadoria Revenda - Suplementos')
  })

  it('WHEY PROTEIN STORE → Mercadoria Revenda - Suplementos', () => {
    const r = matchByRazaoSocialKeywords('WHEY PROTEIN STORE', 'DEBIT', 'ACADEMIA')
    expect(r?.category).toBe('Mercadoria Revenda - Suplementos')
  })
})

describe('matchByRazaoSocialKeywords — COMERCIO_ROUPA (Mercadoria Revenda)', () => {
  it('CONFECCAO LTDA → Mercadoria Revenda - Confecções', () => {
    const r = matchByRazaoSocialKeywords('CONFECCAO ROUPAS LTDA', 'DEBIT', 'COMERCIO_ROUPA')
    expect(r?.category).toBe('Mercadoria Revenda - Confecções')
  })

  it('DISTRIBUIDORA TEXTIL → Mercadoria Revenda - Confecções (genérico do setor)', () => {
    const r = matchByRazaoSocialKeywords(
      'DISTRIBUIDORA TEXTIL DO BRASIL',
      'DEBIT',
      'COMERCIO_ROUPA',
    )
    expect(r?.category).toBe('Mercadoria Revenda - Confecções')
  })
})

describe('matchByRazaoSocialKeywords — fallback universal sem setor', () => {
  it('CONSERVAS sem setor → Fornecedor Alimentos (universal legado)', () => {
    const r = matchByRazaoSocialKeywords('CONSERVAS ODERICH SA', 'DEBIT')
    expect(r?.category).toBe('Fornecedor Alimentos')
  })

  it('BEBIDAS sem setor → Fornecedor Bebidas', () => {
    const r = matchByRazaoSocialKeywords('AMBEV BEBIDAS SA', 'DEBIT')
    expect(r?.category).toBe('Fornecedor Bebidas')
  })
})

describe('matchByRazaoSocialKeywords — VAREJO_GERAL (fallback universal)', () => {
  it('CONSERVAS em VAREJO_GERAL → Fornecedor Alimentos (override vazio cai no universal)', () => {
    const r = matchByRazaoSocialKeywords('CONSERVAS XYZ', 'DEBIT', 'VAREJO_GERAL')
    expect(r?.category).toBe('Fornecedor Alimentos')
  })
})

describe('matchByRazaoSocialKeywords — universalidade (despesas não-setoriais)', () => {
  it('TARIFA bancária em RESTAURANTE não tem override → usa universal não bate (sem keyword universal pra TARIFA)', () => {
    // TARIFA não está nos overrides nem na lista universal de keyword-fallback
    // (tarifa já está em setor-patterns.ts/UNIVERSAL pattern). Aqui retorna null.
    const r = matchByRazaoSocialKeywords('TARIFA BANCO XYZ', 'DEBIT', 'RESTAURANTE')
    expect(r).toBeNull()
  })

  it('CONTABILIDADE em RESTAURANTE → cai no fallback universal Honorários Contábeis', () => {
    const r = matchByRazaoSocialKeywords(
      'CONTABILIDADE BETA LTDA',
      'DEBIT',
      'RESTAURANTE',
    )
    expect(r?.category).toBe('Honorários Contábeis')
  })
})
