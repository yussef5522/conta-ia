import { describe, it, expect } from 'vitest'
import {
  computeTopCategories,
  TOP_CATEGORY_COLORS,
  type CategoryGroup,
  type CategoryMeta,
} from '@/lib/dashboard/compute-top-categories'

function catMap(...cats: CategoryMeta[]): Map<string, CategoryMeta> {
  return new Map(cats.map((c) => [c.id, c]))
}

const FOLHA: CategoryMeta = { id: 'cat-folha', name: 'Folha', dreGroup: 'DESPESAS_PESSOAL' }
const ALUGUEL: CategoryMeta = { id: 'cat-aluguel', name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS' }
const MARKETING: CategoryMeta = { id: 'cat-marketing', name: 'Marketing', dreGroup: 'DESPESAS_COMERCIAIS' }
const ENERGIA: CategoryMeta = { id: 'cat-energia', name: 'Energia', dreGroup: 'DESPESAS_ADMINISTRATIVAS' }
const FRETE: CategoryMeta = { id: 'cat-frete', name: 'Frete', dreGroup: 'OUTRAS_DESPESAS' }
const RECEITA: CategoryMeta = { id: 'cat-receita', name: 'Mensalidades', dreGroup: 'RECEITA_BRUTA' }
const PROLABORE: CategoryMeta = { id: 'cat-pro', name: 'Pró-labore', dreGroup: 'DISTRIBUICAO_LUCROS' }

describe('computeTopCategories — Sprint 1 Dia 2', () => {
  it('top 5 ordenado por valor DESC', () => {
    const groups: CategoryGroup[] = [
      { categoryId: ALUGUEL.id, totalAmount: 8_200 },
      { categoryId: FOLHA.id, totalAmount: 28_500 },
      { categoryId: MARKETING.id, totalAmount: 5_100 },
      { categoryId: ENERGIA.id, totalAmount: 3_200 },
      { categoryId: FRETE.id, totalAmount: 2_900 },
    ]
    const r = computeTopCategories(groups, catMap(FOLHA, ALUGUEL, MARKETING, ENERGIA, FRETE), 'comp-1')
    expect(r.items.map((i) => i.categoryId)).toEqual([
      FOLHA.id, ALUGUEL.id, MARKETING.id, ENERGIA.id, FRETE.id,
    ])
  })

  it('limite 5 mesmo com 8 candidatos', () => {
    const extras = ['c1', 'c2', 'c3'].map((id) => ({
      id,
      name: id,
      dreGroup: 'DESPESAS_PESSOAL' as const,
    }))
    const groups: CategoryGroup[] = [
      { categoryId: FOLHA.id, totalAmount: 100 },
      { categoryId: ALUGUEL.id, totalAmount: 90 },
      { categoryId: MARKETING.id, totalAmount: 80 },
      { categoryId: ENERGIA.id, totalAmount: 70 },
      { categoryId: FRETE.id, totalAmount: 60 },
      { categoryId: 'c1', totalAmount: 50 },
      { categoryId: 'c2', totalAmount: 40 },
      { categoryId: 'c3', totalAmount: 30 },
    ]
    const r = computeTopCategories(
      groups,
      catMap(FOLHA, ALUGUEL, MARKETING, ENERGIA, FRETE, ...extras),
      'comp-1',
    )
    expect(r.items).toHaveLength(5)
  })

  it('IGNORA RECEITA_BRUTA (só despesas)', () => {
    const groups: CategoryGroup[] = [
      { categoryId: RECEITA.id, totalAmount: 100_000 }, // receita — não deve entrar
      { categoryId: FOLHA.id, totalAmount: 8_000 },
    ]
    const r = computeTopCategories(groups, catMap(RECEITA, FOLHA), 'comp-1')
    expect(r.items).toHaveLength(1)
    expect(r.items[0].categoryId).toBe(FOLHA.id)
  })

  it('IGNORA DISTRIBUICAO_LUCROS (não é despesa operacional)', () => {
    const groups: CategoryGroup[] = [
      { categoryId: PROLABORE.id, totalAmount: 30_000 },
      { categoryId: FOLHA.id, totalAmount: 8_000 },
    ]
    const r = computeTopCategories(groups, catMap(PROLABORE, FOLHA), 'comp-1')
    expect(r.items.map((i) => i.categoryId)).toEqual([FOLHA.id])
  })

  it('ignora categoryId sem metadata (categoria deletada/órfã)', () => {
    const groups: CategoryGroup[] = [
      { categoryId: 'cat-orfa', totalAmount: 99_999 },
      { categoryId: FOLHA.id, totalAmount: 100 },
    ]
    const r = computeTopCategories(groups, catMap(FOLHA), 'comp-1')
    expect(r.items).toHaveLength(1)
    expect(r.items[0].categoryId).toBe(FOLHA.id)
  })

  it('ignora categoria com dreGroup=null', () => {
    const semGrupo: CategoryMeta = { id: 'cat-x', name: 'Sem grupo', dreGroup: null }
    const groups: CategoryGroup[] = [
      { categoryId: semGrupo.id, totalAmount: 99_999 },
      { categoryId: FOLHA.id, totalAmount: 100 },
    ]
    const r = computeTopCategories(groups, catMap(semGrupo, FOLHA), 'comp-1')
    expect(r.items).toHaveLength(1)
  })

  it('cores fixas da paleta nos índices 0-4', () => {
    const cats = [
      { ...FOLHA }, { ...ALUGUEL }, { ...MARKETING }, { ...ENERGIA }, { ...FRETE },
    ]
    const groups = cats.map((c, i) => ({
      categoryId: c.id,
      totalAmount: 1000 - i, // ordem garantida
    }))
    const r = computeTopCategories(groups, catMap(...cats), 'comp-1')
    expect(r.items[0].color).toBe(TOP_CATEGORY_COLORS[0]) // brand
    expect(r.items[1].color).toBe(TOP_CATEGORY_COLORS[1]) // success
    expect(r.items[2].color).toBe(TOP_CATEGORY_COLORS[2]) // warning
    expect(r.items[3].color).toBe(TOP_CATEGORY_COLORS[3]) // danger
    expect(r.items[4].color).toBe(TOP_CATEGORY_COLORS[4]) // gray
  })

  it('percent é relativo ao total das top (não ao total geral)', () => {
    const groups: CategoryGroup[] = [
      { categoryId: FOLHA.id, totalAmount: 70 },
      { categoryId: ALUGUEL.id, totalAmount: 30 },
    ]
    const r = computeTopCategories(groups, catMap(FOLHA, ALUGUEL), 'comp-1')
    expect(r.totalDespesas).toBe(100)
    expect(r.items[0].percent).toBe(70)
    expect(r.items[1].percent).toBe(30)
  })

  it('lista vazia: items=[], totalDespesas=0', () => {
    const r = computeTopCategories([], catMap(), 'comp-1')
    expect(r.items).toHaveLength(0)
    expect(r.totalDespesas).toBe(0)
  })

  it('limit customizável (top 3)', () => {
    const groups: CategoryGroup[] = [
      { categoryId: FOLHA.id, totalAmount: 100 },
      { categoryId: ALUGUEL.id, totalAmount: 90 },
      { categoryId: MARKETING.id, totalAmount: 80 },
      { categoryId: ENERGIA.id, totalAmount: 70 },
      { categoryId: FRETE.id, totalAmount: 60 },
    ]
    const r = computeTopCategories(
      groups,
      catMap(FOLHA, ALUGUEL, MARKETING, ENERGIA, FRETE),
      'comp-1',
      3,
    )
    expect(r.items).toHaveLength(3)
  })

  it('companyId vazio LANÇA (multi-tenant guard)', () => {
    expect(() => computeTopCategories([], catMap(), '')).toThrow(/multi-tenant/i)
  })

  it('result.companyId === input.companyId', () => {
    const r = computeTopCategories([], catMap(), 'comp-academia-3')
    expect(r.companyId).toBe('comp-academia-3')
  })
})
