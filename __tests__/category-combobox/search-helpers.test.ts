// Sprint Category-Combobox (29/06/2026) — helpers PUROS de busca/agrupamento.

import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  filterCategories,
  groupCategories,
  groupColor,
  DRE_GROUP_LABELS,
  DRE_GROUP_ORDER,
} from '@/lib/transacoes/category-search'

describe('normalizeText', () => {
  it('remove acento', () => {
    expect(normalizeText('Matéria-Prima')).toBe('materia-prima')
    expect(normalizeText('Distribuição de Lucros')).toBe('distribuicao de lucros')
    expect(normalizeText('Imposto sobre Operação')).toBe('imposto sobre operacao')
  })
  it('case-insensitive', () => {
    expect(normalizeText('FRETE')).toBe('frete')
    expect(normalizeText('Frete')).toBe('frete')
  })
  it('trim', () => {
    expect(normalizeText('  espaço  ')).toBe('espaco')
  })
  it('cedilha cai pra c', () => {
    expect(normalizeText('Manutenção')).toBe('manutencao')
  })
})

describe('filterCategories', () => {
  const cats = [
    { id: '1', name: 'Matéria-Prima' },
    { id: '2', name: 'Materiais de Limpeza' },
    { id: '3', name: 'Distribuição de Lucros' },
    { id: '4', name: 'Frete' },
    { id: '5', name: 'Aluguel' },
  ]

  it('query vazia retorna todas', () => {
    const r = filterCategories(cats, '')
    expect(r).toHaveLength(5)
  })

  it('busca "mater" acha as 2 (Matéria + Materiais)', () => {
    const r = filterCategories(cats, 'mater')
    expect(r).toHaveLength(2)
    expect(r.map((s) => s.cat.id).sort()).toEqual(['1', '2'])
  })

  it('busca sem acento bate com nome COM acento', () => {
    const r = filterCategories(cats, 'distribuicao')
    expect(r).toHaveLength(1)
    expect(r[0].cat.id).toBe('3')
  })

  it('busca case-insensitive', () => {
    const r = filterCategories(cats, 'FRETE')
    expect(r).toHaveLength(1)
    expect(r[0].cat.id).toBe('4')
  })

  it('score: começa com query rankeia maior que contém', () => {
    const inputs = [
      { id: 'a', name: 'Despesas Operacionais' },
      { id: 'b', name: 'Outras Despesas' },
    ]
    const r = filterCategories(inputs, 'desp')
    expect(r[0].cat.id).toBe('a') // começa com "desp"
    expect(r[1].cat.id).toBe('b') // só contém
  })

  it('matchStart/matchEnd marcam o trecho', () => {
    const r = filterCategories(cats, 'mater')
    const first = r.find((s) => s.cat.id === '1')!
    expect(first.matchStart).toBe(0)
    expect(first.matchEnd).toBe(5)
  })

  it('sem match retorna lista vazia', () => {
    const r = filterCategories(cats, 'xyz123')
    expect(r).toHaveLength(0)
  })
})

describe('groupCategories', () => {
  it('agrupa por dreGroup na ordem visual', () => {
    const cats = [
      { id: '1', name: 'A', dreGroup: 'DESPESAS_OPERACIONAIS' },
      { id: '2', name: 'B', dreGroup: 'RECEITA_BRUTA' },
      { id: '3', name: 'C', dreGroup: 'DESPESAS_PESSOAL' },
    ]
    const scored = filterCategories(cats, '')
    const groups = groupCategories(scored)
    // RECEITA_BRUTA vem antes na ordem visual
    expect(groups[0].key).toBe('RECEITA_BRUTA')
    expect(groups[0].label).toBe('Receitas')
  })

  it('sem dreGroup vai pro grupo "Outros"', () => {
    const cats = [{ id: '1', name: 'X' }]
    const groups = groupCategories(filterCategories(cats, ''))
    expect(groups[0].key).toBe('OUTROS')
  })

  it('preserva labels', () => {
    expect(DRE_GROUP_LABELS.RECEITA_BRUTA).toBe('Receitas')
    expect(DRE_GROUP_LABELS.DESPESAS_PESSOAL).toBe('Despesas com Pessoal')
  })

  it('DRE_GROUP_ORDER cobre os grupos comuns', () => {
    expect(DRE_GROUP_ORDER).toContain('RECEITA_BRUTA')
    expect(DRE_GROUP_ORDER).toContain('DESPESAS_OPERACIONAIS')
    expect(DRE_GROUP_ORDER).toContain('DISTRIBUICAO_LUCROS')
    expect(DRE_GROUP_ORDER).toContain('OUTROS')
  })
})

describe('groupColor', () => {
  it('retorna cor semântica por grupo', () => {
    expect(groupColor('RECEITA_BRUTA')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(groupColor('DESPESAS_OPERACIONAIS')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('fallback OUTROS pra null/desconhecido', () => {
    expect(groupColor(null)).toBe(groupColor('OUTROS'))
    expect(groupColor('GRUPO_INEXISTENTE')).toBe(groupColor('OUTROS'))
  })
})
