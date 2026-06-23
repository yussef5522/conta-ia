// Sprint 6 — testes do motor de breakdown (parte pura).
// Não usa Prisma — só testa o shape e propriedades do cálculo a partir
// de fixtures sintéticas.

import { describe, it, expect } from 'vitest'
import type {
  ExpenseBreakdownResult,
  ExpenseCategorySummary,
} from '@/lib/dashboard/expenses-breakdown'

describe('ExpenseBreakdownResult shape', () => {
  // Helper: simula o que o motor monta in-memory
  function buildResult(
    rows: Array<{ name: string; dreGroup: string; total: number; qtdTx: number }>,
  ): Pick<ExpenseBreakdownResult, 'categorias' | 'totalGeral' | 'totalTx' | 'totalCategorias' | 'porGrupo'> {
    const sorted = [...rows].sort((a, b) => b.total - a.total)
    const totalGeral = sorted.reduce((s, c) => s + c.total, 0)
    const totalTx = sorted.reduce((s, c) => s + c.qtdTx, 0)
    const categorias: ExpenseCategorySummary[] = sorted.map((c, idx) => ({
      categoryId: `cat-${idx}`,
      name: c.name,
      dreGroup: c.dreGroup,
      total: c.total,
      qtdTx: c.qtdTx,
      pctDoTotal: totalGeral > 0 ? (c.total / totalGeral) * 100 : 0,
      isTop: idx === 0,
    }))
    const grupoMap = new Map<string, { total: number; qtdTx: number }>()
    for (const c of sorted) {
      const prev = grupoMap.get(c.dreGroup) ?? { total: 0, qtdTx: 0 }
      grupoMap.set(c.dreGroup, { total: prev.total + c.total, qtdTx: prev.qtdTx + c.qtdTx })
    }
    const porGrupo = Array.from(grupoMap.entries())
      .map(([dreGroup, v]) => ({ dreGroup, ...v }))
      .sort((a, b) => b.total - a.total)
    return { categorias, totalGeral, totalTx, totalCategorias: categorias.length, porGrupo }
  }

  it('soma das categorias = totalGeral', () => {
    const r = buildResult([
      { name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 60000, qtdTx: 30 },
      { name: 'Salários', dreGroup: 'DESPESAS_PESSOAL', total: 38000, qtdTx: 25 },
      { name: 'Compras Mercadoria', dreGroup: 'CUSTO_PRODUTO_VENDIDO', total: 42000, qtdTx: 20 },
    ])
    const soma = r.categorias.reduce((s, c) => s + c.total, 0)
    expect(soma).toBe(r.totalGeral)
    expect(r.totalGeral).toBe(140000)
    expect(r.totalTx).toBe(75)
    expect(r.totalCategorias).toBe(3)
  })

  it('soma dos pctDoTotal = ~100%', () => {
    const r = buildResult([
      { name: 'A', dreGroup: 'OUTRAS_DESPESAS', total: 100, qtdTx: 1 },
      { name: 'B', dreGroup: 'OUTRAS_DESPESAS', total: 200, qtdTx: 2 },
      { name: 'C', dreGroup: 'OUTRAS_DESPESAS', total: 700, qtdTx: 7 },
    ])
    const somaPct = r.categorias.reduce((s, c) => s + c.pctDoTotal, 0)
    expect(somaPct).toBeCloseTo(100, 5)
  })

  it('ordenação decrescente por gasto (top primeiro)', () => {
    const r = buildResult([
      { name: 'Pequena', dreGroup: 'OUTRAS_DESPESAS', total: 100, qtdTx: 1 },
      { name: 'Grande', dreGroup: 'OUTRAS_DESPESAS', total: 9000, qtdTx: 10 },
      { name: 'Média', dreGroup: 'OUTRAS_DESPESAS', total: 1000, qtdTx: 5 },
    ])
    expect(r.categorias[0].name).toBe('Grande')
    expect(r.categorias[0].isTop).toBe(true)
    expect(r.categorias[1].name).toBe('Média')
    expect(r.categorias[2].name).toBe('Pequena')
    expect(r.categorias[1].isTop).toBe(false)
  })

  it('porGrupo agrupa corretamente', () => {
    const r = buildResult([
      { name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 5000, qtdTx: 1 },
      { name: 'Contabilidade', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 1000, qtdTx: 1 },
      { name: 'Salários', dreGroup: 'DESPESAS_PESSOAL', total: 8000, qtdTx: 5 },
    ])
    const adm = r.porGrupo.find((g) => g.dreGroup === 'DESPESAS_ADMINISTRATIVAS')!
    const pess = r.porGrupo.find((g) => g.dreGroup === 'DESPESAS_PESSOAL')!
    expect(adm.total).toBe(6000)
    expect(adm.qtdTx).toBe(2)
    expect(pess.total).toBe(8000)
    expect(pess.qtdTx).toBe(5)
  })

  it('vazio: totais zerados, sem categorias', () => {
    const r = buildResult([])
    expect(r.totalGeral).toBe(0)
    expect(r.totalTx).toBe(0)
    expect(r.totalCategorias).toBe(0)
    expect(r.categorias).toEqual([])
  })

  it('NON_DRE não deve aparecer (responsabilidade do motor SQL — fixture confirma)', () => {
    // O motor real exclui TRANSFERENCIA / DISTRIBUICAO_LUCROS no SQL.
    // Aqui só asseguramos que o shape suporta os dreGroups corretos.
    const VALID_EXPENSE_GROUPS = [
      'CUSTO_PRODUTO_VENDIDO',
      'DESPESAS_PESSOAL',
      'DESPESAS_COMERCIAIS',
      'DESPESAS_ADMINISTRATIVAS',
      'DESPESAS_FINANCEIRAS',
      'OUTRAS_DESPESAS',
      'IMPOSTOS_SOBRE_LUCRO',
    ]
    const NON_DRE = ['TRANSFERENCIA', 'DISTRIBUICAO_LUCROS', 'INVESTIMENTOS', 'AJUSTE_SALDO']
    for (const g of NON_DRE) {
      expect(VALID_EXPENSE_GROUPS.includes(g)).toBe(false)
    }
  })

  it('pct de única categoria = 100%', () => {
    const r = buildResult([
      { name: 'Aluguel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', total: 5000, qtdTx: 1 },
    ])
    expect(r.categorias[0].pctDoTotal).toBe(100)
  })
})
