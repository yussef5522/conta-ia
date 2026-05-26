// Sprint 5.0.2.l — Engine matchAgainstPatterns (DB-backed, função pura)
// + resolveSetorCategoryId.

import { describe, it, expect } from 'vitest'
import {
  matchAgainstPatterns,
  resolveSetorCategoryId,
  type SetorPatternSnapshot,
} from '@/lib/categorization/match-setor-pattern'
import { SETOR_PATTERNS_SEED, categoriesNeededForSetor } from '@/prisma/seeds/setor-patterns'

function snapshotFromSeed(setorEmpresa: string): SetorPatternSnapshot[] {
  // Replica a ordenação que loadPatternsForSetor faz
  return SETOR_PATTERNS_SEED.filter(
    (p) => p.setor === 'UNIVERSAL' || p.setor === setorEmpresa,
  )
    .map((p, idx) => ({
      id: `seed-${idx}`,
      setor: p.setor,
      matchType: p.matchType,
      pattern: p.pattern,
      categoryName: p.categoryName,
      type: p.type,
      confidence: p.confidence,
    }))
    .sort((a, b) => {
      const aMatch = a.setor === setorEmpresa ? 1 : 0
      const bMatch = b.setor === setorEmpresa ? 1 : 0
      if (aMatch !== bMatch) return bMatch - aMatch
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return b.pattern.length - a.pattern.length
    })
}

const UNIVERSAL = snapshotFromSeed('UNIVERSAL')
const RESTAURANTE = snapshotFromSeed('RESTAURANTE')
const ACADEMIA = snapshotFromSeed('ACADEMIA')
const COMERCIO = snapshotFromSeed('COMERCIO_ROUPA')

describe('matchAgainstPatterns — UNIVERSAL', () => {
  it('DARF → Tributos Federais (AUTO)', () => {
    const r = matchAgainstPatterns(
      { description: 'PAGAMENTO DARF 0420', type: 'DEBIT' },
      UNIVERSAL,
    )
    expect(r?.pattern.categoryName).toBe('Tributos Federais')
    expect(r?.tier).toBe('AUTO')
  })

  it('DAS SIMPLES tem precedência (length desc)', () => {
    const r = matchAgainstPatterns(
      { description: 'DAS SIMPLES NACIONAL', type: 'DEBIT' },
      UNIVERSAL,
    )
    expect(r?.pattern.categoryName).toBe('DAS Simples Nacional')
  })

  it('PAGAMENTO STONE em CREDIT → Receita Cartão', () => {
    const r = matchAgainstPatterns(
      { description: 'PAGAMENTO STONE 03/05/2026', type: 'CREDIT' },
      UNIVERSAL,
    )
    expect(r?.pattern.categoryName).toBe('Receita Cartão')
  })

  it('CELESC → Energia Elétrica', () => {
    const r = matchAgainstPatterns(
      { description: 'PAGAMENTO CELESC', type: 'DEBIT' },
      UNIVERSAL,
    )
    expect(r?.pattern.categoryName).toBe('Energia Elétrica')
  })

  it('ESTORNO casa ANY em qualquer tipo', () => {
    const r1 = matchAgainstPatterns(
      { description: 'ESTORNO COMPRA', type: 'DEBIT' },
      UNIVERSAL,
    )
    const r2 = matchAgainstPatterns(
      { description: 'ESTORNO COMPRA', type: 'CREDIT' },
      UNIVERSAL,
    )
    expect(r1?.pattern.categoryName).toBe('Estornos')
    expect(r2?.pattern.categoryName).toBe('Estornos')
  })
})

describe('matchAgainstPatterns — RESTAURANTE', () => {
  it('IFOOD em CREDIT → Receita Delivery (iFood) — setor específico ganha prioridade', () => {
    const r = matchAgainstPatterns(
      { description: 'IFOOD REPASSE', type: 'CREDIT' },
      RESTAURANTE,
    )
    expect(r?.pattern.categoryName).toBe('Receita Delivery (iFood)')
    expect(r?.pattern.setor).toBe('RESTAURANTE')
  })

  it('AMBEV em DEBIT → Fornecedor Bebidas', () => {
    const r = matchAgainstPatterns(
      { description: 'PAGAMENTO AMBEV S/A', type: 'DEBIT' },
      RESTAURANTE,
    )
    expect(r?.pattern.categoryName).toBe('Fornecedor Bebidas')
  })

  it('JBS / FRIBOI / SADIA → Fornecedor Carnes', () => {
    const r1 = matchAgainstPatterns(
      { description: 'JBS FRIGORIFICO', type: 'DEBIT' },
      RESTAURANTE,
    )
    const r2 = matchAgainstPatterns(
      { description: 'PAGAMENTO FRIBOI', type: 'DEBIT' },
      RESTAURANTE,
    )
    const r3 = matchAgainstPatterns(
      { description: 'PAGAMENTO SADIA SA', type: 'DEBIT' },
      RESTAURANTE,
    )
    expect(r1?.pattern.categoryName).toBe('Fornecedor Carnes')
    expect(r2?.pattern.categoryName).toBe('Fornecedor Carnes')
    expect(r3?.pattern.categoryName).toBe('Fornecedor Carnes')
  })

  it('ATACADAO / ASSAI → Compras Mercadoria', () => {
    const r1 = matchAgainstPatterns(
      { description: 'COMPRA ATACADAO', type: 'DEBIT' },
      RESTAURANTE,
    )
    const r2 = matchAgainstPatterns(
      { description: 'ASSAI ATACADISTA', type: 'DEBIT' },
      RESTAURANTE,
    )
    expect(r1?.pattern.categoryName).toBe('Compras Mercadoria')
    expect(r2?.pattern.categoryName).toBe('Compras Mercadoria')
  })

  it('CEAGESP → Hortifruti', () => {
    const r = matchAgainstPatterns(
      { description: 'CEAGESP COMPRA', type: 'DEBIT' },
      RESTAURANTE,
    )
    expect(r?.pattern.categoryName).toBe('Hortifruti')
  })

  it('UNIVERSAL ainda funciona dentro de RESTAURANTE (DARF)', () => {
    const r = matchAgainstPatterns(
      { description: 'DARF PARCELA', type: 'DEBIT' },
      RESTAURANTE,
    )
    expect(r?.pattern.categoryName).toBe('Tributos Federais')
    expect(r?.pattern.setor).toBe('UNIVERSAL')
  })
})

describe('matchAgainstPatterns — ACADEMIA', () => {
  it('GYMPASS em CREDIT → Receita Gympass/Wellhub', () => {
    const r = matchAgainstPatterns(
      { description: 'GYMPASS REPASSE 04/2026', type: 'CREDIT' },
      ACADEMIA,
    )
    expect(r?.pattern.categoryName).toBe('Receita Gympass/Wellhub')
  })

  it('WELLHUB → Receita Gympass/Wellhub', () => {
    const r = matchAgainstPatterns(
      { description: 'WELLHUB PAGAMENTO', type: 'CREDIT' },
      ACADEMIA,
    )
    expect(r?.pattern.categoryName).toBe('Receita Gympass/Wellhub')
  })

  it('TOTALPASS → Receita TotalPass', () => {
    const r = matchAgainstPatterns(
      { description: 'TOTALPASS RECEBIDO', type: 'CREDIT' },
      ACADEMIA,
    )
    expect(r?.pattern.categoryName).toBe('Receita TotalPass')
  })

  it('MAX TITANIUM → Compras Suplementos (Revenda)', () => {
    const r = matchAgainstPatterns(
      { description: 'COMPRA MAX TITANIUM', type: 'DEBIT' },
      ACADEMIA,
    )
    expect(r?.pattern.categoryName).toBe('Compras Suplementos (Revenda)')
  })

  it('TECNOFIT → Software Gestão Academia', () => {
    const r = matchAgainstPatterns(
      { description: 'TECNOFIT MENSALIDADE', type: 'DEBIT' },
      ACADEMIA,
    )
    expect(r?.pattern.categoryName).toBe('Software Gestão Academia')
  })

  it('META PLATFORMS → Marketing Digital (specific antes do GOOGLE BR genérico)', () => {
    const r = matchAgainstPatterns(
      { description: 'META PLATFORMS IRELAND', type: 'DEBIT' },
      ACADEMIA,
    )
    expect(r?.pattern.categoryName).toBe('Marketing Digital')
  })
})

describe('matchAgainstPatterns — COMERCIO_ROUPA', () => {
  it('MERCADO LIVRE em CREDIT → Receita E-commerce (ML)', () => {
    const r = matchAgainstPatterns(
      { description: 'MERCADO LIVRE PAGAMENTO', type: 'CREDIT' },
      COMERCIO,
    )
    expect(r?.pattern.categoryName).toBe('Receita E-commerce (ML)')
  })

  it('SHOPEE → Receita E-commerce (Shopee)', () => {
    const r = matchAgainstPatterns(
      { description: 'SHOPEE BR', type: 'CREDIT' },
      COMERCIO,
    )
    expect(r?.pattern.categoryName).toBe('Receita E-commerce (Shopee)')
  })

  it('JADLOG → Frete', () => {
    const r = matchAgainstPatterns(
      { description: 'JADLOG PAGAMENTO', type: 'DEBIT' },
      COMERCIO,
    )
    expect(r?.pattern.categoryName).toBe('Frete')
  })

  it('CORREIOS → Frete', () => {
    const r = matchAgainstPatterns(
      { description: 'CORREIOS POSTAGEM', type: 'DEBIT' },
      COMERCIO,
    )
    expect(r?.pattern.categoryName).toBe('Frete')
  })

  it('HERING → Compras Mercadoria', () => {
    const r = matchAgainstPatterns(
      { description: 'HERING COMPRA', type: 'DEBIT' },
      COMERCIO,
    )
    expect(r?.pattern.categoryName).toBe('Compras Mercadoria')
  })
})

describe('matchAgainstPatterns — prioridade setor empresa > UNIVERSAL', () => {
  it('Em ACADEMIA, padrão UNIVERSAL "GOOGLE BR" perde pra ACADEMIA "META PLATFORMS"', () => {
    // META PLATFORMS é setor=ACADEMIA, deve vir primeiro mesmo com confidence igual
    const r = matchAgainstPatterns(
      { description: 'META PLATFORMS GOOGLE BR', type: 'DEBIT' },
      ACADEMIA,
    )
    expect(r?.pattern.setor).toBe('ACADEMIA')
  })
})

describe('matchAgainstPatterns — edge cases', () => {
  it('descrição null → null', () => {
    expect(matchAgainstPatterns({ description: null, type: 'DEBIT' }, UNIVERSAL)).toBeNull()
  })

  it('type null + pattern ANY → bate', () => {
    const r = matchAgainstPatterns(
      { description: 'ESTORNO', type: null },
      UNIVERSAL,
    )
    expect(r?.pattern.categoryName).toBe('Estornos')
  })

  it('case insensitive (lowercase input)', () => {
    const r = matchAgainstPatterns(
      { description: 'pagamento darf', type: 'DEBIT' },
      UNIVERSAL,
    )
    expect(r?.pattern.categoryName).toBe('Tributos Federais')
  })

  it('descrição sem match → null', () => {
    const r = matchAgainstPatterns(
      { description: 'TRANSACAO COMPLETAMENTE ESTRANHA QUE NAO BATE', type: 'DEBIT' },
      UNIVERSAL,
    )
    expect(r).toBeNull()
  })
})

describe('resolveSetorCategoryId', () => {
  const cats = [
    { id: 'cat-receita-cartao', name: 'Receita Cartão', isActive: true },
    { id: 'cat-darf', name: 'Tributos Federais', isActive: true },
    { id: 'cat-ifood', name: 'Receita Delivery (iFood)', isActive: true },
    { id: 'cat-inativa', name: 'Inativa', isActive: false },
  ]

  it('match exato por nome', () => {
    expect(resolveSetorCategoryId(cats, 'Receita Cartão')).toBe('cat-receita-cartao')
  })

  it('case-insensitive', () => {
    expect(resolveSetorCategoryId(cats, 'RECEITA CARTÃO')).toBe('cat-receita-cartao')
  })

  it('match parcial', () => {
    // "Receita Delivery" parcial casa com "Receita Delivery (iFood)"
    expect(resolveSetorCategoryId(cats, 'Receita Delivery')).toBe('cat-ifood')
  })

  it('ignora categoria inativa', () => {
    expect(resolveSetorCategoryId(cats, 'Inativa')).toBeNull()
  })

  it('null quando nada bate', () => {
    expect(resolveSetorCategoryId(cats, 'Categoria Inexistente XYZ')).toBeNull()
  })
})

describe('categoriesNeededForSetor — helper do seed', () => {
  it('RESTAURANTE inclui UNIVERSAL + Fornecedor Bebidas + iFood + Carnes', () => {
    const set = categoriesNeededForSetor('RESTAURANTE')
    expect(set.has('Tributos Federais')).toBe(true) // UNIVERSAL
    expect(set.has('Tarifas Bancárias')).toBe(true) // UNIVERSAL
    expect(set.has('Fornecedor Bebidas')).toBe(true) // RESTAURANTE
    expect(set.has('Fornecedor Carnes')).toBe(true) // RESTAURANTE
    expect(set.has('Receita Delivery (iFood)')).toBe(true) // RESTAURANTE
  })

  it('ACADEMIA NÃO inclui Fornecedor Carnes (apenas RESTAURANTE tem)', () => {
    const set = categoriesNeededForSetor('ACADEMIA')
    expect(set.has('Fornecedor Carnes')).toBe(false)
    expect(set.has('Receita Gympass/Wellhub')).toBe(true)
    expect(set.has('Software Gestão Academia')).toBe(true)
  })

  it('UNIVERSAL inclui só categorias UNIVERSAL', () => {
    const set = categoriesNeededForSetor('UNIVERSAL')
    expect(set.has('Tributos Federais')).toBe(true)
    expect(set.has('Fornecedor Bebidas')).toBe(false)
    expect(set.has('Receita Gympass/Wellhub')).toBe(false)
  })
})

describe('SETOR_PATTERNS_SEED — sanidade da KB', () => {
  it('tem ≥140 padrões', () => {
    expect(SETOR_PATTERNS_SEED.length).toBeGreaterThanOrEqual(140)
  })

  it('cada padrão tem confidence entre 0.7 e 1.0', () => {
    for (const p of SETOR_PATTERNS_SEED) {
      expect(p.confidence).toBeGreaterThanOrEqual(0.7)
      expect(p.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('matchType válido', () => {
    const valid = new Set(['STARTS_WITH', 'CONTAINS', 'EQUALS'])
    for (const p of SETOR_PATTERNS_SEED) expect(valid.has(p.matchType)).toBe(true)
  })

  it('type válido (INCOME/EXPENSE/ANY)', () => {
    const valid = new Set(['INCOME', 'EXPENSE', 'ANY'])
    for (const p of SETOR_PATTERNS_SEED) expect(valid.has(p.type)).toBe(true)
  })

  it('setor válido (5 valores)', () => {
    const valid = new Set([
      'UNIVERSAL',
      'RESTAURANTE',
      'ACADEMIA',
      'COMERCIO_ROUPA',
      'VAREJO_GERAL',
    ])
    for (const p of SETOR_PATTERNS_SEED) expect(valid.has(p.setor)).toBe(true)
  })
})
