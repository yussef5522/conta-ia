// Sprint A-effected Fase B.4.1 — Templates de categoria de ajuste.

import { describe, it, expect } from 'vitest'
import {
  ADJUSTMENT_CATEGORY_TEMPLATES,
  suggestCategoryKeyForDiff,
  applicableTemplates,
} from '@/lib/conciliacao/adjustment-categories'

describe('ADJUSTMENT_CATEGORY_TEMPLATES', () => {
  it('contém exatamente 4 templates', () => {
    expect(ADJUSTMENT_CATEGORY_TEMPLATES).toHaveLength(4)
  })

  it('cada template tem key, name, type, dreGroup, suggestWhen', () => {
    for (const t of ADJUSTMENT_CATEGORY_TEMPLATES) {
      expect(t.key).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(['INCOME', 'EXPENSE']).toContain(t.type)
      expect(t.dreGroup).toBeTruthy()
      expect(['PAID_MORE', 'PAID_LESS', 'ROUNDING']).toContain(t.suggestWhen)
    }
  })

  it('Juros e Multas → DESPESAS_FINANCEIRAS (DRE correto)', () => {
    const t = ADJUSTMENT_CATEGORY_TEMPLATES.find(
      (t) => t.key === 'JUROS_MULTAS_BANCARIAS',
    )!
    expect(t.type).toBe('EXPENSE')
    expect(t.dreGroup).toBe('DESPESAS_FINANCEIRAS')
  })

  it('Descontos Obtidos → INCOME + RECEITAS_FINANCEIRAS', () => {
    const t = ADJUSTMENT_CATEGORY_TEMPLATES.find(
      (t) => t.key === 'DESCONTOS_OBTIDOS',
    )!
    expect(t.type).toBe('INCOME')
    expect(t.dreGroup).toBe('RECEITAS_FINANCEIRAS')
  })
})

describe('suggestCategoryKeyForDiff', () => {
  it('Diff > 0 + > R$ 1 → Juros (caso boleto R$ 5070 vs AP R$ 5000 = +70)', () => {
    expect(suggestCategoryKeyForDiff(70)).toBe('JUROS_MULTAS_BANCARIAS')
  })

  it('Diff < 0 → Desconto (caso pagou R$ 980 boleto R$ 1000)', () => {
    expect(suggestCategoryKeyForDiff(-20)).toBe('DESCONTOS_OBTIDOS')
  })

  it('Diff |x| ≤ R$ 1 → Arredondamento', () => {
    expect(suggestCategoryKeyForDiff(0.01)).toBe('AJUSTES_ARREDONDAMENTO')
    expect(suggestCategoryKeyForDiff(0.5)).toBe('AJUSTES_ARREDONDAMENTO')
    expect(suggestCategoryKeyForDiff(1.0)).toBe('AJUSTES_ARREDONDAMENTO')
    expect(suggestCategoryKeyForDiff(-0.5)).toBe('AJUSTES_ARREDONDAMENTO')
  })

  it('Diff == 0 (já bate) → null (não sugere ajuste)', () => {
    expect(suggestCategoryKeyForDiff(0)).toBeNull()
    expect(suggestCategoryKeyForDiff(0.005)).toBeNull() // < R$ 0,01 = bate
  })

  it('Threshold customizado pra arredondamento', () => {
    expect(suggestCategoryKeyForDiff(0.5, 0.3)).toBe('JUROS_MULTAS_BANCARIAS')
    expect(suggestCategoryKeyForDiff(2.0, 5)).toBe('AJUSTES_ARREDONDAMENTO')
  })
})

describe('applicableTemplates — dropdown adaptativo', () => {
  it('Diff > R$ 1 → Juros + Tarifas (NÃO mostra Desconto nem Arredondamento)', () => {
    const ts = applicableTemplates(70)
    expect(ts.map((t) => t.key)).toEqual([
      'JUROS_MULTAS_BANCARIAS',
      'TARIFAS_BANCARIAS',
    ])
  })

  it('Diff < 0 + > R$ 1 → Desconto APENAS', () => {
    const ts = applicableTemplates(-20)
    expect(ts.map((t) => t.key)).toEqual(['DESCONTOS_OBTIDOS'])
  })

  it('Diff = R$ 0,50 → Juros + Tarifas + Arredondamento', () => {
    const ts = applicableTemplates(0.5)
    expect(ts.map((t) => t.key)).toEqual([
      'JUROS_MULTAS_BANCARIAS',
      'TARIFAS_BANCARIAS',
      'AJUSTES_ARREDONDAMENTO',
    ])
  })

  it('Diff = -R$ 0,50 → Desconto + Arredondamento', () => {
    const ts = applicableTemplates(-0.5)
    expect(ts.map((t) => t.key)).toEqual([
      'DESCONTOS_OBTIDOS',
      'AJUSTES_ARREDONDAMENTO',
    ])
  })

  it('Diff = 0 (bate) → vazio (não precisa ajuste)', () => {
    expect(applicableTemplates(0)).toEqual([])
    expect(applicableTemplates(0.005)).toEqual([])
  })

  it('Threshold customizado afeta arredondamento', () => {
    expect(applicableTemplates(0.5, 0.3).map((t) => t.key)).toEqual([
      'JUROS_MULTAS_BANCARIAS',
      'TARIFAS_BANCARIAS',
    ])
  })
})
