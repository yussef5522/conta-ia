// Sprint PF FATIA 1 — Default categories template (puro, sem DB).

import { describe, expect, test } from 'vitest'
import {
  PF_DEFAULT_CATEGORIES,
  getDefaultCategoriesForProfile,
} from '@/lib/personal-profile/default-categories'

describe('PF_DEFAULT_CATEGORIES', () => {
  test('tem exatamente 15 categorias', () => {
    expect(PF_DEFAULT_CATEGORIES).toHaveLength(15)
  })

  test('todas têm nome único', () => {
    const names = PF_DEFAULT_CATEGORIES.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('3 receitas + 12 despesas', () => {
    const incomes = PF_DEFAULT_CATEGORIES.filter((c) => c.type === 'INCOME')
    const expenses = PF_DEFAULT_CATEGORIES.filter((c) => c.type === 'EXPENSE')
    expect(incomes).toHaveLength(3)
    expect(expenses).toHaveLength(12)
  })

  test('inclui categorias placeholder pra fatias futuras', () => {
    const names = PF_DEFAULT_CATEGORIES.map((c) => c.name)
    // Pró-labore/Lucros → Fatia 4 (ponte PJ→PF)
    expect(names.some((n) => n.toLowerCase().includes('pró-labore'))).toBe(true)
    // Cartão de crédito → Fatia 2
    expect(names.some((n) => n.toLowerCase().includes('cartão'))).toBe(true)
  })

  test('inclui categorias essenciais pra cobrir vida cotidiana', () => {
    const names = PF_DEFAULT_CATEGORIES.map((c) => c.name.toLowerCase())
    const essentials = ['salário', 'alimentação', 'transporte', 'moradia', 'saúde']
    for (const e of essentials) {
      expect(names.some((n) => n.includes(e))).toBe(true)
    }
  })

  test('cada categoria tem cor hex válida (#RRGGBB)', () => {
    for (const c of PF_DEFAULT_CATEGORIES) {
      expect(c.color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  test('cada categoria tem icon não-vazio', () => {
    for (const c of PF_DEFAULT_CATEGORIES) {
      expect(c.icon.length).toBeGreaterThan(0)
    }
  })

  test('getDefaultCategoriesForProfile retorna o array completo', () => {
    expect(getDefaultCategoriesForProfile()).toEqual(PF_DEFAULT_CATEGORIES)
  })

  test('tipo é literal INCOME ou EXPENSE (não outros)', () => {
    for (const c of PF_DEFAULT_CATEGORIES) {
      expect(['INCOME', 'EXPENSE']).toContain(c.type)
    }
  })
})
