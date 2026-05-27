// Sprint 5.0.2.s — Plano de contas contábil setorial (PURO).

import { describe, it, expect } from 'vitest'
import {
  planoContasParaSetor,
  mapearCategoriaLegada,
} from '@/prisma/seeds/plano-contas-setorial'

describe('planoContasParaSetor — RESTAURANTE', () => {
  it('inclui categorias Matéria-Prima', () => {
    const plano = planoContasParaSetor('RESTAURANTE')
    const nomes = plano.map((c) => c.nome)
    expect(nomes).toContain('Matéria-Prima - Alimentos')
    expect(nomes).toContain('Matéria-Prima - Bebidas')
    expect(nomes).toContain('Matéria-Prima - Carnes')
    expect(nomes).toContain('Matéria-Prima - Hortifruti')
    expect(nomes).toContain('Matéria-Prima - Outros Insumos')
  })

  it('Matéria-Prima é CUSTO_PRODUTO_VENDIDO (CMV)', () => {
    const plano = planoContasParaSetor('RESTAURANTE')
    const mp = plano.find((c) => c.nome === 'Matéria-Prima - Carnes')
    expect(mp?.dreGroup).toBe('CUSTO_PRODUTO_VENDIDO')
  })

  it('Matéria-Prima é isCreditavel (gera crédito Lucro Real)', () => {
    const plano = planoContasParaSetor('RESTAURANTE')
    const mp = plano.find((c) => c.nome === 'Matéria-Prima - Outros Insumos')
    expect(mp?.isCreditavel).toBe(true)
  })

  it('Embalagens delivery é CMV creditável', () => {
    const plano = planoContasParaSetor('RESTAURANTE')
    const emb = plano.find((c) => c.nome === 'Embalagens - Delivery')
    expect(emb?.dreGroup).toBe('CUSTO_PRODUTO_VENDIDO')
    expect(emb?.isCreditavel).toBe(true)
  })

  it('inclui receitas delivery específicas', () => {
    const plano = planoContasParaSetor('RESTAURANTE')
    const nomes = plano.map((c) => c.nome)
    expect(nomes).toContain('Receita Delivery (iFood)')
    expect(nomes).toContain('Receita Delivery (Uber Eats)')
    expect(nomes).toContain('Receita Delivery (Rappi)')
  })

  it('inclui universais (Salários, Energia, DAS, etc)', () => {
    const plano = planoContasParaSetor('RESTAURANTE')
    const nomes = plano.map((c) => c.nome)
    expect(nomes).toContain('Salários')
    expect(nomes).toContain('Energia Elétrica')
    expect(nomes).toContain('DAS Simples Nacional')
    expect(nomes).toContain('Tarifas Bancárias')
  })

  it('códigos contábeis seguem padrão hierárquico (3.1.01.XXX pra MP)', () => {
    const plano = planoContasParaSetor('RESTAURANTE')
    const carnes = plano.find((c) => c.nome === 'Matéria-Prima - Carnes')
    expect(carnes?.codigo).toMatch(/^3\.1\.01\./)
  })
})

describe('planoContasParaSetor — ACADEMIA', () => {
  it('tem Mercadoria Revenda Suplementos (não Matéria-Prima)', () => {
    const plano = planoContasParaSetor('ACADEMIA')
    const nomes = plano.map((c) => c.nome)
    expect(nomes).toContain('Mercadoria Revenda - Suplementos')
    expect(nomes).not.toContain('Matéria-Prima - Alimentos')
  })

  it('inclui Receita Gympass/Wellhub', () => {
    const plano = planoContasParaSetor('ACADEMIA')
    const nomes = plano.map((c) => c.nome)
    expect(nomes).toContain('Receita Gympass/Wellhub')
    expect(nomes).toContain('Receita TotalPass')
  })

  it('Software Gestão Academia presente', () => {
    const plano = planoContasParaSetor('ACADEMIA')
    expect(plano.map((c) => c.nome)).toContain('Software Gestão Academia')
  })
})

describe('planoContasParaSetor — COMERCIO_ROUPA', () => {
  it('tem Mercadoria Revenda Confecções', () => {
    const plano = planoContasParaSetor('COMERCIO_ROUPA')
    expect(plano.map((c) => c.nome)).toContain('Mercadoria Revenda - Confecções')
  })

  it('inclui Receita E-commerce', () => {
    const plano = planoContasParaSetor('COMERCIO_ROUPA')
    const nomes = plano.map((c) => c.nome)
    expect(nomes).toContain('Receita E-commerce (ML)')
    expect(nomes).toContain('Receita E-commerce (Shopee)')
  })
})

describe('planoContasParaSetor — fallback VAREJO_GERAL', () => {
  it('setor null → VAREJO_GERAL', () => {
    const plano = planoContasParaSetor(null)
    expect(plano.map((c) => c.nome)).toContain('Mercadoria para Revenda')
  })

  it('setor inválido → VAREJO_GERAL', () => {
    const plano = planoContasParaSetor('SETOR_INEXISTENTE')
    expect(plano.map((c) => c.nome)).toContain('Mercadoria para Revenda')
  })
})

describe('mapearCategoriaLegada — Cacula Mix migration', () => {
  it('RESTAURANTE: Fornecedor Alimentos → Matéria-Prima - Outros Insumos', () => {
    expect(mapearCategoriaLegada('Fornecedor Alimentos', 'RESTAURANTE')).toBe(
      'Matéria-Prima - Outros Insumos',
    )
  })

  it('RESTAURANTE: Fornecedor Bebidas → Matéria-Prima - Bebidas', () => {
    expect(mapearCategoriaLegada('Fornecedor Bebidas', 'RESTAURANTE')).toBe(
      'Matéria-Prima - Bebidas',
    )
  })

  it('RESTAURANTE: Fornecedor Carnes → Matéria-Prima - Carnes', () => {
    expect(mapearCategoriaLegada('Fornecedor Carnes', 'RESTAURANTE')).toBe(
      'Matéria-Prima - Carnes',
    )
  })

  it('RESTAURANTE: Compras Mercadoria → Matéria-Prima - Outros Insumos', () => {
    expect(mapearCategoriaLegada('Compras Mercadoria', 'RESTAURANTE')).toBe(
      'Matéria-Prima - Outros Insumos',
    )
  })

  it('RESTAURANTE: Material de Embalagem → Embalagens - Descartáveis', () => {
    expect(mapearCategoriaLegada('Material de Embalagem', 'RESTAURANTE')).toBe(
      'Embalagens - Descartáveis',
    )
  })

  it('COMERCIO_ROUPA: Compras Mercadoria → Mercadoria Revenda Confecções', () => {
    expect(mapearCategoriaLegada('Compras Mercadoria', 'COMERCIO_ROUPA')).toBe(
      'Mercadoria Revenda - Confecções',
    )
  })

  it('ACADEMIA: Compras Suplementos (Revenda) → Mercadoria Revenda Suplementos', () => {
    expect(
      mapearCategoriaLegada('Compras Suplementos (Revenda)', 'ACADEMIA'),
    ).toBe('Mercadoria Revenda - Suplementos')
  })

  it('Categoria sem mapping → null (não migra)', () => {
    expect(mapearCategoriaLegada('Categoria Custom Yussef', 'RESTAURANTE')).toBeNull()
  })

  it('Setor inválido → fallback VAREJO_GERAL', () => {
    expect(mapearCategoriaLegada('Compras Mercadoria', 'XYZ')).toBe(
      'Mercadoria para Revenda',
    )
  })
})
