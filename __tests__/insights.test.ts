import { describe, it, expect } from 'vitest'
import { detectPendingClassifications } from '@/lib/insights/detectors/pending-classifications'
import { detectHighOverdraftUsage } from '@/lib/insights/detectors/high-overdraft-usage'
import { detectBurnRateSpike } from '@/lib/insights/detectors/burn-rate-spike'
import { computeInsights, REGISTERED_DETECTORS } from '@/lib/insights/compute-insights'
import type {
  InsightContext,
  InsightAccountSnapshot,
  BurnHistoryEntry,
} from '@/lib/insights/types'

const COMP = 'comp-1'

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    companyId: COMP,
    pendingCount: 0,
    accounts: [],
    burnHistory: [],
    ...overrides,
  }
}

function acc(
  balance: number,
  creditLimit: number,
  allowNegativeBalance = true,
  name = 'Conta',
  id = 'acc-' + Math.random(),
): InsightAccountSnapshot {
  return { id, name, balance, creditLimit, allowNegativeBalance }
}

function burnMonth(monthKey: string, expense: number, income = 0): BurnHistoryEntry {
  return { monthKey, expense, income }
}

// ============================================================
// pending-classifications
// ============================================================

describe('detectPendingClassifications — tiering por volume', () => {
  it('0 pendentes → []', () => {
    expect(detectPendingClassifications(makeCtx({ pendingCount: 0 }))).toEqual([])
  })

  it('1-19 pendentes → sugestao priority 5', () => {
    const r = detectPendingClassifications(makeCtx({ pendingCount: 15 }))
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('sugestao')
    expect(r[0].priority).toBe(5)
    expect(r[0].title).toContain('15')
  })

  it('20-99 pendentes → oportunidade priority 7', () => {
    const r = detectPendingClassifications(makeCtx({ pendingCount: 50 }))
    expect(r[0].severity).toBe('oportunidade')
    expect(r[0].priority).toBe(7)
  })

  it('≥100 pendentes → alerta priority 9', () => {
    const r = detectPendingClassifications(makeCtx({ pendingCount: 752 }))
    expect(r[0].severity).toBe('alerta')
    expect(r[0].priority).toBe(9)
    expect(r[0].title).toContain('752')
  })

  it('singular "1 transação aguarda" pra pendingCount=1', () => {
    const r = detectPendingClassifications(makeCtx({ pendingCount: 1 }))
    expect(r[0].title).toBe('1 transação aguarda classificação')
  })

  it('action URL inclui companyId', () => {
    const r = detectPendingClassifications(makeCtx({ pendingCount: 10, companyId: 'comp-X' }))
    expect(r[0].action?.url).toBe('/empresas/comp-X/pendentes')
  })
})

// ============================================================
// high-overdraft-usage
// ============================================================

describe('detectHighOverdraftUsage — uso de cheque especial', () => {
  it('nenhuma conta negativa → []', () => {
    const r = detectHighOverdraftUsage(
      makeCtx({ accounts: [acc(5000, 100000), acc(2000, 50000)] }),
    )
    expect(r).toEqual([])
  })

  it('conta negativa mas <70% do limite → []', () => {
    // -30k/100k = 30% — abaixo do threshold
    const r = detectHighOverdraftUsage(makeCtx({ accounts: [acc(-30000, 100000)] }))
    expect(r).toEqual([])
  })

  it('1 conta a 80% → sugestao priority 6', () => {
    const r = detectHighOverdraftUsage(
      makeCtx({ accounts: [acc(-80000, 100000, true, 'Banrisul')] }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('sugestao')
    expect(r[0].priority).toBe(6)
    expect(r[0].title).toContain('Banrisul')
    expect(r[0].title).toContain('80%')
  })

  it('1 conta a 95% → alerta priority 9 (critical)', () => {
    const r = detectHighOverdraftUsage(
      makeCtx({ accounts: [acc(-95000, 100000)] }),
    )
    expect(r[0].severity).toBe('alerta')
    expect(r[0].priority).toBe(9)
  })

  it('múltiplas contas afetadas → 1 insight agregado, pior caso destacado', () => {
    const r = detectHighOverdraftUsage(
      makeCtx({
        accounts: [
          acc(-95000, 100000, true, 'Banrisul'),
          acc(-75000, 100000, true, 'Sicoob'),
          acc(50000, 100000, true, 'Itaú'), // positiva — ignorada
        ],
      }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('alerta')
    expect(r[0].title).toContain('2 contas')
    expect(r[0].metadata?.contasAfetadas).toBe(2)
  })

  it('conta sem creditLimit (=0) é ignorada mesmo se negativa', () => {
    // Conta poupança ou pré-Sprint-0.5 sem backfill
    const r = detectHighOverdraftUsage(
      makeCtx({ accounts: [acc(-500, 0, false, 'Poupança')] }),
    )
    expect(r).toEqual([])
  })

  it('conta com allowNegativeBalance=false ignorada', () => {
    const r = detectHighOverdraftUsage(
      makeCtx({ accounts: [acc(-500, 100, false)] }),
    )
    expect(r).toEqual([])
  })

  it('cenário Cacula Mix com creditLimit=999M: 0,05% → []', () => {
    // Backfill Sprint 0.5 setou 999_999_999 — usage gigantesco impossível
    const r = detectHighOverdraftUsage(
      makeCtx({ accounts: [acc(-450000, 999_999_999, true, 'cacula mix')] }),
    )
    expect(r).toEqual([])
  })
})

// ============================================================
// burn-rate-spike
// ============================================================

describe('detectBurnRateSpike — spike de despesa', () => {
  it('<6 meses de histórico → [] (silencioso)', () => {
    const r = detectBurnRateSpike(
      makeCtx({
        burnHistory: [
          burnMonth('2026-03', 10000),
          burnMonth('2026-04', 12000),
          burnMonth('2026-05', 11000),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('baseline zero (3 meses anteriores sem despesa) → []', () => {
    const r = detectBurnRateSpike(
      makeCtx({
        burnHistory: [
          burnMonth('2025-12', 0),
          burnMonth('2026-01', 0),
          burnMonth('2026-02', 0),
          burnMonth('2026-03', 10000),
          burnMonth('2026-04', 12000),
          burnMonth('2026-05', 11000),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('growth <30% → [] (variação normal)', () => {
    const r = detectBurnRateSpike(
      makeCtx({
        burnHistory: [
          burnMonth('2025-12', 10000),
          burnMonth('2026-01', 10000),
          burnMonth('2026-02', 10000),
          burnMonth('2026-03', 11000),
          burnMonth('2026-04', 12000),
          burnMonth('2026-05', 12500),
        ],
      }),
    )
    expect(r).toEqual([])
  })

  it('growth 40% → sugestao priority 5', () => {
    const r = detectBurnRateSpike(
      makeCtx({
        burnHistory: [
          burnMonth('2025-12', 10000),
          burnMonth('2026-01', 10000),
          burnMonth('2026-02', 10000),
          burnMonth('2026-03', 14000),
          burnMonth('2026-04', 14000),
          burnMonth('2026-05', 14000),
        ],
      }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].severity).toBe('sugestao')
    expect(r[0].priority).toBe(5)
    expect(r[0].title).toContain('40%')
  })

  it('growth 80% → alerta priority 8', () => {
    const r = detectBurnRateSpike(
      makeCtx({
        burnHistory: [
          burnMonth('2025-12', 10000),
          burnMonth('2026-01', 10000),
          burnMonth('2026-02', 10000),
          burnMonth('2026-03', 18000),
          burnMonth('2026-04', 18000),
          burnMonth('2026-05', 18000),
        ],
      }),
    )
    expect(r[0].severity).toBe('alerta')
    expect(r[0].priority).toBe(8)
  })
})

// ============================================================
// compute-insights (orquestrador)
// ============================================================

describe('computeInsights — ordenação + integração', () => {
  it('3 detectors registrados (Dia 3)', () => {
    expect(REGISTERED_DETECTORS).toHaveLength(3)
  })

  it('vazio quando ctx não trigga nada', () => {
    expect(computeInsights(makeCtx())).toEqual([])
  })

  it('ordena por severity: alerta > oportunidade > sugestao', () => {
    // pending=752 → alerta priority 9
    // overdraft 80% → sugestao priority 6
    // burn 40% → sugestao priority 5
    const r = computeInsights(
      makeCtx({
        pendingCount: 752,
        accounts: [acc(-80000, 100000)],
        burnHistory: [
          burnMonth('2025-12', 10000),
          burnMonth('2026-01', 10000),
          burnMonth('2026-02', 10000),
          burnMonth('2026-03', 14000),
          burnMonth('2026-04', 14000),
          burnMonth('2026-05', 14000),
        ],
      }),
    )
    expect(r.map((i) => i.severity)).toEqual(['alerta', 'sugestao', 'sugestao'])
    expect(r[0].id).toBe('pending-classifications')
  })

  it('mesma severity → priority desc', () => {
    // pending=50 (oportunidade pri 7) + nenhuma overdraft + burn 40% (sugestao pri 5)
    const r = computeInsights(
      makeCtx({
        pendingCount: 50,
        burnHistory: [
          burnMonth('2025-12', 10000),
          burnMonth('2026-01', 10000),
          burnMonth('2026-02', 10000),
          burnMonth('2026-03', 14000),
          burnMonth('2026-04', 14000),
          burnMonth('2026-05', 14000),
        ],
      }),
    )
    expect(r[0].severity).toBe('oportunidade')
    expect(r[1].severity).toBe('sugestao')
  })

  it('determinístico: mesma entrada → mesma ordem', () => {
    const ctx = makeCtx({
      pendingCount: 25,
      accounts: [acc(-90000, 100000), acc(-95000, 100000, true, 'Conta 2')],
    })
    const r1 = computeInsights(ctx).map((i) => i.id)
    const r2 = computeInsights(ctx).map((i) => i.id)
    expect(r1).toEqual(r2)
  })

  it('companyId vazio LANÇA (multi-tenant guard)', () => {
    expect(() => computeInsights(makeCtx({ companyId: '' }))).toThrow(/multi-tenant/i)
  })

  it('cenário REAL Cacula Mix: só pending-classifications dispara', () => {
    // 752 pendentes + contas com creditLimit gigante (backfill) + 2 meses de histórico
    const r = computeInsights(
      makeCtx({
        pendingCount: 752,
        accounts: [
          acc(5821, 999_999_999, true, 'cacula mix'),
          acc(1260, 999_999_999, true, 'STONE'),
        ],
        burnHistory: [], // sem 6 meses ainda
      }),
    )
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('pending-classifications')
    expect(r[0].severity).toBe('alerta')
  })
})
