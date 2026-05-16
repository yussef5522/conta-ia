// Testes dos 4 novos detectors + helper Levenshtein — Sprint 2 Dia 4.

import { describe, it, expect } from 'vitest'
import { detectLargeUncategorized } from '@/lib/insights/detectors/large-uncategorized'
import { detectConcentrationRisk } from '@/lib/insights/detectors/concentration-risk'
import { detectRevenueGrowth } from '@/lib/insights/detectors/revenue-growth'
import { detectDuplicateSubscriptions } from '@/lib/insights/detectors/duplicate-subscriptions'
import {
  levenshtein,
  normalizeDescription,
} from '@/lib/insights/string-similarity'
import type {
  InsightContext,
  InsightTransaction,
} from '@/lib/insights/types'

const COMP = 'comp-1'

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    companyId: COMP,
    pendingCount: 0,
    accounts: [],
    burnHistory: [],
    uncategorizedLast30d: [],
    creditTx90d: [],
    expenseTx6m: [],
    ...overrides,
  }
}

function tx(
  partial: Partial<InsightTransaction> & {
    amount: number
    type: InsightTransaction['type']
  },
): InsightTransaction {
  return {
    id: 'tx-' + Math.random(),
    description: 'Generic',
    date: new Date('2026-05-10T12:00:00Z'),
    dreGroup: null,
    ...partial,
  }
}

// ============================================================
// Levenshtein helper
// ============================================================

describe('levenshtein (Sprint 2 Dia 4 helper)', () => {
  it('distância 0 quando strings idênticas', () => {
    expect(levenshtein('netflix', 'netflix')).toBe(0)
  })

  it('insert/delete count direto', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('substituição conta como 1', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
  })

  it('detecta variação típica de assinatura (data MM/YYYY trocando)', () => {
    expect(
      levenshtein(
        normalizeDescription('NETFLIX 04/2026'),
        normalizeDescription('NETFLIX 05/2026'),
      ),
    ).toBe(1)
  })

  it('normalizeDescription colapsa espaços + lowercase', () => {
    expect(normalizeDescription('  NETFLIX   COM.BR  ')).toBe('netflix com.br')
  })
})

// ============================================================
// detect-large-uncategorized
// ============================================================

describe('detectLargeUncategorized', () => {
  it('vazio quando não há transações sem categoria', () => {
    expect(detectLargeUncategorized(makeCtx())).toEqual([])
  })

  it('vazio quando há uncategorized mas TODAS ≤ R$5k', () => {
    const r = detectLargeUncategorized(
      makeCtx({
        uncategorizedLast30d: [
          tx({ amount: 4999, type: 'DEBIT' }),
          tx({ amount: 100, type: 'CREDIT' }),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('1-4 grandes → sugestao priority 5', () => {
    const r = detectLargeUncategorized(
      makeCtx({
        uncategorizedLast30d: [
          tx({ amount: 8000, type: 'DEBIT' }),
          tx({ amount: 6500, type: 'CREDIT' }),
        ],
      }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('sugestao')
    expect(r[0].priority).toBe(5)
  })

  it('5-19 grandes → oportunidade priority 7 (caso Yussef prod ~12)', () => {
    const txs: InsightTransaction[] = Array.from({ length: 12 }, (_, i) =>
      tx({ amount: 10000 + i * 100, type: 'DEBIT' }),
    )
    const r = detectLargeUncategorized(
      makeCtx({ uncategorizedLast30d: txs }),
    )
    expect(r[0].severity).toBe('oportunidade')
    expect(r[0].priority).toBe(7)
    expect(r[0].title).toContain('12')
  })

  it('20+ grandes → alerta priority 9', () => {
    const txs = Array.from({ length: 25 }, () =>
      tx({ amount: 6000, type: 'DEBIT' }),
    )
    const r = detectLargeUncategorized(
      makeCtx({ uncategorizedLast30d: txs }),
    )
    expect(r[0].severity).toBe('alerta')
    expect(r[0].priority).toBe(9)
  })

  it('action URL inclui companyId', () => {
    const r = detectLargeUncategorized(
      makeCtx({
        companyId: 'comp-X',
        uncategorizedLast30d: [tx({ amount: 10_000, type: 'DEBIT' })],
      }),
    )
    expect(r[0].action?.url).toBe('/empresas/comp-X/pendentes')
  })
})

// ============================================================
// detect-concentration-risk
// ============================================================

describe('detectConcentrationRisk — guarda 50% receita real', () => {
  function receita(description: string, amount: number): InsightTransaction {
    return tx({ description, amount, type: 'CREDIT', dreGroup: 'RECEITA_BRUTA' })
  }
  function naoReceita(description: string, amount: number): InsightTransaction {
    return tx({ description, amount, type: 'CREDIT', dreGroup: null })
  }

  it('SILENCIOSO quando <50% das CREDIT têm RECEITA_* (evita falso positivo de empréstimo)', () => {
    // 1 receita + 5 sem categoria → 16% receita → silencioso
    const r = detectConcentrationRisk(
      makeCtx({
        creditTx90d: [
          receita('Cliente Top', 100000),
          naoReceita('Empréstimo', 50000),
          naoReceita('Aporte', 30000),
          naoReceita('Outro', 20000),
          naoReceita('Outro2', 15000),
          naoReceita('Outro3', 10000),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('Top1 ≥ 70% → alerta priority 8', () => {
    const r = detectConcentrationRisk(
      makeCtx({
        creditTx90d: [
          receita('Cliente Top', 80000),
          receita('Cliente B', 10000),
          receita('Cliente C', 5000),
          receita('Cliente D', 5000),
        ],
      }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('alerta')
    expect(r[0].priority).toBe(8)
    expect(r[0].title).toContain('80%')
  })

  it('Top1 entre 50-70% → oportunidade priority 6', () => {
    const r = detectConcentrationRisk(
      makeCtx({
        creditTx90d: [
          receita('Cliente Médio', 60),
          receita('Cliente B', 20),
          receita('Cliente C', 10),
          receita('Cliente D', 10),
        ],
      }),
    )
    expect(r[0].severity).toBe('oportunidade')
    expect(r[0].priority).toBe(6)
  })

  it('Top1 < 50% mas Top3 ≥ 80% → oportunidade priority 6', () => {
    // 30+30+25 = 85% sobre 100, mas Top1 = 30%
    const r = detectConcentrationRisk(
      makeCtx({
        creditTx90d: [
          receita('A', 30),
          receita('B', 30),
          receita('C', 25),
          receita('D', 15),
        ],
      }),
    )
    expect(r[0].severity).toBe('oportunidade')
    expect(r[0].title).toContain('Top 3')
  })

  it('SILENCIOSO quando receitas < 3 (amostra pequena)', () => {
    const r = detectConcentrationRisk(
      makeCtx({ creditTx90d: [receita('A', 100), receita('B', 50)] }),
    )
    expect(r).toEqual([])
  })

  it('agrupa por descrição normalizada (case-insensitive + espaços)', () => {
    // "Cliente X" + "CLIENTE X" + "cliente   x" deveriam virar 1 cluster
    const r = detectConcentrationRisk(
      makeCtx({
        creditTx90d: [
          receita('CLIENTE X', 100),
          receita('cliente   x', 100),
          receita('Cliente X', 100),
          receita('Outro', 10),
        ],
      }),
    )
    expect(r[0].metadata?.clientCount).toBe(2)
    expect(r[0].title).toContain('97%')
  })
})

// ============================================================
// detect-revenue-growth
// ============================================================

describe('detectRevenueGrowth — só conta RECEITA_*', () => {
  function rec(dateStr: string, amount: number): InsightTransaction {
    return tx({
      description: 'Receita',
      amount,
      type: 'CREDIT',
      dreGroup: 'RECEITA_BRUTA',
      date: new Date(dateStr),
    })
  }

  it('SILENCIOSO quando < 4 meses de dados (precisa 3 baseline + atual)', () => {
    const r = detectRevenueGrowth(
      makeCtx({
        creditTx90d: [
          rec('2026-04-15T12:00:00Z', 1000),
          rec('2026-05-15T12:00:00Z', 1500),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('crescimento ≥ 50% → parabens priority 7 🚀', () => {
    const r = detectRevenueGrowth(
      makeCtx({
        creditTx90d: [
          rec('2026-02-15T12:00:00Z', 1000),
          rec('2026-03-15T12:00:00Z', 1000),
          rec('2026-04-15T12:00:00Z', 1000),
          rec('2026-05-15T12:00:00Z', 2000), // current = 2x baseline
        ],
      }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('parabens')
    expect(r[0].priority).toBe(7)
    expect(r[0].title).toContain('🚀')
    expect(r[0].title).toContain('100%')
  })

  it('crescimento 20-49% → parabens priority 5', () => {
    const r = detectRevenueGrowth(
      makeCtx({
        creditTx90d: [
          rec('2026-02-15T12:00:00Z', 1000),
          rec('2026-03-15T12:00:00Z', 1000),
          rec('2026-04-15T12:00:00Z', 1000),
          rec('2026-05-15T12:00:00Z', 1300),
        ],
      }),
    )
    expect(r[0].severity).toBe('parabens')
    expect(r[0].priority).toBe(5)
  })

  it('crescimento < 20% → silencioso (não celebra)', () => {
    const r = detectRevenueGrowth(
      makeCtx({
        creditTx90d: [
          rec('2026-02-15T12:00:00Z', 1000),
          rec('2026-03-15T12:00:00Z', 1000),
          rec('2026-04-15T12:00:00Z', 1000),
          rec('2026-05-15T12:00:00Z', 1100),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('IGNORA CREDIT sem dreGroup RECEITA_* (anti empréstimo)', () => {
    const credit = (date: string, amount: number, dreGroup: string | null) =>
      tx({
        description: 'X',
        amount,
        type: 'CREDIT',
        dreGroup,
        date: new Date(date),
      })
    // Sem RECEITA_* válidos suficientes — só uma "OUTRAS_RECEITAS"
    const r = detectRevenueGrowth(
      makeCtx({
        creditTx90d: [
          credit('2026-02-15T12:00:00Z', 1000, null), // sem categoria
          credit('2026-03-15T12:00:00Z', 1000, 'DESPESAS_PESSOAL'), // não-receita
          credit('2026-04-15T12:00:00Z', 1000, null),
          credit('2026-05-15T12:00:00Z', 10000, 'OUTRAS_RECEITAS'),
        ],
      }),
    )
    // Só 1 mês de receita real → < 4 meses → silencioso
    expect(r).toEqual([])
  })
})

// ============================================================
// detect-duplicate-subscriptions
// ============================================================

describe('detectDuplicateSubscriptions — Levenshtein + meses distintos', () => {
  function debit(
    description: string,
    amount: number,
    dateStr: string,
  ): InsightTransaction {
    return tx({
      description,
      amount,
      type: 'DEBIT',
      dreGroup: null,
      date: new Date(dateStr),
    })
  }

  it('SILENCIOSO sem dados', () => {
    expect(detectDuplicateSubscriptions(makeCtx())).toEqual([])
  })

  it('1 padrão em 3 meses distintos → sugestao priority 6', () => {
    const r = detectDuplicateSubscriptions(
      makeCtx({
        expenseTx6m: [
          debit('NETFLIX 03/2026', 39.9, '2026-03-15T12:00:00Z'),
          debit('NETFLIX 04/2026', 39.9, '2026-04-15T12:00:00Z'),
          debit('NETFLIX 05/2026', 39.9, '2026-05-15T12:00:00Z'),
        ],
      }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('sugestao')
    expect(r[0].priority).toBe(6)
    expect(r[0].metadata?.groupCount).toBe(1)
  })

  it('SILENCIOSO se 3 ocorrências no mesmo mês (não é mensal)', () => {
    const r = detectDuplicateSubscriptions(
      makeCtx({
        expenseTx6m: [
          debit('NETFLIX 03/2026', 39.9, '2026-03-10T12:00:00Z'),
          debit('NETFLIX 03/2026', 39.9, '2026-03-15T12:00:00Z'),
          debit('NETFLIX 03/2026', 39.9, '2026-03-20T12:00:00Z'),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('3+ padrões mensais distintos → alerta priority 8', () => {
    const r = detectDuplicateSubscriptions(
      makeCtx({
        expenseTx6m: [
          debit('NETFLIX 03', 39.9, '2026-03-15T12:00:00Z'),
          debit('NETFLIX 04', 39.9, '2026-04-15T12:00:00Z'),
          debit('NETFLIX 05', 39.9, '2026-05-15T12:00:00Z'),
          debit('SPOTIFY MAR', 19.9, '2026-03-10T12:00:00Z'),
          debit('SPOTIFY ABR', 19.9, '2026-04-10T12:00:00Z'),
          debit('SPOTIFY MAI', 19.9, '2026-05-10T12:00:00Z'),
          debit('GOOGLE WORKSPACE 03', 75, '2026-03-05T12:00:00Z'),
          debit('GOOGLE WORKSPACE 04', 75, '2026-04-05T12:00:00Z'),
          debit('GOOGLE WORKSPACE 05', 75, '2026-05-05T12:00:00Z'),
        ],
      }),
    )
    expect(r[0].severity).toBe('alerta')
    expect(r[0].priority).toBe(8)
    expect(r[0].metadata?.groupCount).toBe(3)
  })

  it('valores divergentes >10% NÃO agrupam (cluster distinto)', () => {
    const r = detectDuplicateSubscriptions(
      makeCtx({
        expenseTx6m: [
          debit('AWS 03', 100, '2026-03-15T12:00:00Z'),
          debit('AWS 04', 105, '2026-04-15T12:00:00Z'), // dentro de ±10%
          debit('AWS 05', 250, '2026-05-15T12:00:00Z'), // 150% — fora, cluster novo
        ],
      }),
    )
    // O cluster principal só tem 2 meses → silencioso
    expect(r).toEqual([])
  })

  it('descrições muito distantes (Lev > 5) NÃO agrupam', () => {
    const r = detectDuplicateSubscriptions(
      makeCtx({
        expenseTx6m: [
          debit('NETFLIX BRASIL', 39.9, '2026-03-15T12:00:00Z'),
          debit('SPOTIFY PREMIUM', 39.9, '2026-04-15T12:00:00Z'),
          debit('AMAZON PRIME VIDEO', 39.9, '2026-05-15T12:00:00Z'),
        ],
      }),
    )
    expect(r).toEqual([])
  })
})
