import { describe, it, expect } from 'vitest'
import {
  computeHealthCheck,
  type ComputeHealthInput,
} from '@/lib/dashboard/compute-health'

function baseInput(overrides: Partial<ComputeHealthInput> = {}): ComputeHealthInput {
  return {
    companyId: 'comp-1',
    referenceDate: new Date('2026-05-15T12:00:00Z'),
    accounts: [],
    burnHistory: [],
    net30d: 0,
    currentMonthRevenue: 0,
    currentMonthNetIncome: 0,
    ...overrides,
  }
}

function find(result: ReturnType<typeof computeHealthCheck>, id: string) {
  return result.indicators.find((i) => i.id === id)!
}

// ============================================================
// BURN RATE
// ============================================================

describe('computeHealthCheck — Burn Rate', () => {
  it('< 3 meses de dados → status gray "Acumulando dados... (X/3 meses)"', () => {
    const r = computeHealthCheck(
      baseInput({
        burnHistory: [
          { monthKey: '2026-02', expense: 1000, income: 2000 },
          { monthKey: '2026-03', expense: 1000, income: 2000 },
        ],
      }),
    )
    const burn = find(r, 'burn-rate')
    expect(burn.status).toBe('gray')
    expect(burn.statusLabel).toBe('Acumulando dados... (2/3 meses)')
    expect(burn.value).toBeNull()
  })

  it('3 meses, burn ≤70% da receita → 🟢 Saudável', () => {
    const r = computeHealthCheck(
      baseInput({
        burnHistory: [
          { monthKey: '2026-02', expense: 6_000, income: 10_000 }, // 60%
          { monthKey: '2026-03', expense: 6_000, income: 10_000 },
          { monthKey: '2026-04', expense: 6_000, income: 10_000 },
        ],
      }),
    )
    const burn = find(r, 'burn-rate')
    expect(burn.status).toBe('green')
    expect(burn.statusLabel).toBe('Saudável')
    expect(burn.value).toBe(6000)
    expect(burn.subtext).toBe('60% da receita')
  })

  it('burn 70-90% da receita → 🟡 Atenção', () => {
    const r = computeHealthCheck(
      baseInput({
        burnHistory: [
          { monthKey: '2026-02', expense: 8_000, income: 10_000 }, // 80%
          { monthKey: '2026-03', expense: 8_000, income: 10_000 },
          { monthKey: '2026-04', expense: 8_000, income: 10_000 },
        ],
      }),
    )
    const burn = find(r, 'burn-rate')
    expect(burn.status).toBe('yellow')
    expect(burn.statusLabel).toBe('Atenção')
  })

  it('burn > 90% da receita → 🔴 Crítico (margem zero = morte lenta)', () => {
    const r = computeHealthCheck(
      baseInput({
        burnHistory: [
          { monthKey: '2026-02', expense: 9_500, income: 10_000 }, // 95%
          { monthKey: '2026-03', expense: 9_500, income: 10_000 },
          { monthKey: '2026-04', expense: 9_500, income: 10_000 },
        ],
      }),
    )
    const burn = find(r, 'burn-rate')
    expect(burn.status).toBe('red')
    expect(burn.statusLabel).toBe('Crítico')
  })

  it('despesa sem receita média (0) → 🔴 Crítico', () => {
    const r = computeHealthCheck(
      baseInput({
        burnHistory: [
          { monthKey: '2026-02', expense: 1000, income: 0 },
          { monthKey: '2026-03', expense: 1000, income: 0 },
          { monthKey: '2026-04', expense: 1000, income: 0 },
        ],
      }),
    )
    const burn = find(r, 'burn-rate')
    expect(burn.status).toBe('red')
    expect(burn.subtext).toContain('sem receita')
  })

  it('tudo zero (3 meses sem movimento) → gray "Sem dados"', () => {
    const r = computeHealthCheck(
      baseInput({
        burnHistory: [
          { monthKey: '2026-02', expense: 0, income: 0 },
          { monthKey: '2026-03', expense: 0, income: 0 },
          { monthKey: '2026-04', expense: 0, income: 0 },
        ],
      }),
    )
    const burn = find(r, 'burn-rate')
    expect(burn.status).toBe('gray')
    expect(burn.statusLabel).toBe('Sem dados')
  })
})

// ============================================================
// RUNWAY
// ============================================================

describe('computeHealthCheck — Runway', () => {
  it('cálculo normal: 60k saldo / 10k burn = 6 meses', () => {
    const r = computeHealthCheck(
      baseInput({
        accounts: [
          { balance: 60_000, creditLimit: 0, allowNegativeBalance: false },
        ],
        burnHistory: [
          { monthKey: '2026-02', expense: 10_000, income: 5_000 },
          { monthKey: '2026-03', expense: 10_000, income: 5_000 },
          { monthKey: '2026-04', expense: 10_000, income: 5_000 },
        ],
      }),
    )
    const rw = find(r, 'runway')
    expect(rw.value).toBe(6)
    expect(rw.status).toBe('yellow') // 6 meses = yellow (limite inferior)
  })

  it('INCLUI cheque especial: saldo -550k + creditLimit 600k = available 50k', () => {
    // Cenário real Banrisul Yussef
    const r = computeHealthCheck(
      baseInput({
        accounts: [
          { balance: -550_000, creditLimit: 600_000, allowNegativeBalance: true },
        ],
        burnHistory: [
          { monthKey: '2026-02', expense: 10_000, income: 20_000 },
          { monthKey: '2026-03', expense: 10_000, income: 20_000 },
          { monthKey: '2026-04', expense: 10_000, income: 20_000 },
        ],
      }),
    )
    const rw = find(r, 'runway')
    // available = -550k + 600k = 50k; runway = 50k/10k = 5 meses
    expect(rw.value).toBe(5)
    expect(rw.status).toBe('red')
    expect(rw.subtext).toBe('Incluindo cheque especial')
  })

  it('múltiplas contas: soma disponibilidade correta', () => {
    const r = computeHealthCheck(
      baseInput({
        accounts: [
          { balance: 50_000, creditLimit: 600_000, allowNegativeBalance: true }, // 650k
          { balance: 30_000, creditLimit: 0, allowNegativeBalance: false }, // 30k
          { balance: -100, creditLimit: 0, allowNegativeBalance: false }, // 0 (max 0)
        ],
        burnHistory: [
          { monthKey: '2026-02', expense: 50_000, income: 60_000 },
          { monthKey: '2026-03', expense: 50_000, income: 60_000 },
          { monthKey: '2026-04', expense: 50_000, income: 60_000 },
        ],
      }),
    )
    const rw = find(r, 'runway')
    // available = 650k + 30k + 0 = 680k; runway = 680/50 = 13.6 meses
    expect(rw.value).toBeCloseTo(13.6, 1)
    expect(rw.status).toBe('green')
  })

  it('cap em 24 meses → display "Mais de 2 anos" + status green', () => {
    const r = computeHealthCheck(
      baseInput({
        accounts: [{ balance: 1_000_000, creditLimit: 0, allowNegativeBalance: false }],
        burnHistory: [
          { monthKey: '2026-02', expense: 1_000, income: 5_000 },
          { monthKey: '2026-03', expense: 1_000, income: 5_000 },
          { monthKey: '2026-04', expense: 1_000, income: 5_000 },
        ],
      }),
    )
    const rw = find(r, 'runway')
    expect(rw.display).toBe('Mais de 2 anos')
    expect(rw.status).toBe('green')
  })

  it('burn zero → display "∞" + status green', () => {
    const r = computeHealthCheck(
      baseInput({
        accounts: [{ balance: 1_000, creditLimit: 0, allowNegativeBalance: false }],
        burnHistory: [
          { monthKey: '2026-02', expense: 0, income: 5_000 },
          { monthKey: '2026-03', expense: 0, income: 5_000 },
          { monthKey: '2026-04', expense: 0, income: 5_000 },
        ],
      }),
    )
    const rw = find(r, 'runway')
    expect(rw.display).toBe('∞')
    expect(rw.status).toBe('green')
  })

  it('available ≤ 0 (saldo zerado SEM cheque especial) → 0 meses + crítico', () => {
    const r = computeHealthCheck(
      baseInput({
        accounts: [{ balance: 0, creditLimit: 0, allowNegativeBalance: false }],
        burnHistory: [
          { monthKey: '2026-02', expense: 10_000, income: 5_000 },
          { monthKey: '2026-03', expense: 10_000, income: 5_000 },
          { monthKey: '2026-04', expense: 10_000, income: 5_000 },
        ],
      }),
    )
    const rw = find(r, 'runway')
    expect(rw.display).toBe('0 meses')
    expect(rw.status).toBe('red')
  })

  it('< 3 meses de burnHistory → status gray "Acumulando dados..."', () => {
    const r = computeHealthCheck(
      baseInput({
        accounts: [{ balance: 100_000, creditLimit: 0, allowNegativeBalance: false }],
        burnHistory: [{ monthKey: '2026-04', expense: 10_000, income: 5_000 }],
      }),
    )
    const rw = find(r, 'runway')
    expect(rw.status).toBe('gray')
    expect(rw.statusLabel).toContain('1/3')
  })
})

// ============================================================
// VARIAÇÃO 30 DIAS
// ============================================================

describe('computeHealthCheck — Variação 30 dias', () => {
  it('positiva → 🟢 Subindo', () => {
    const r = computeHealthCheck(baseInput({ net30d: 12_000 }))
    const v = find(r, 'variation-30d')
    expect(v.status).toBe('green')
    expect(v.statusLabel).toBe('Subindo')
    expect(v.display).toContain('+')
  })

  it('negativa → 🔴 Caindo', () => {
    const r = computeHealthCheck(baseInput({ net30d: -8_000 }))
    const v = find(r, 'variation-30d')
    expect(v.status).toBe('red')
    expect(v.statusLabel).toBe('Caindo')
    expect(v.display).toContain('-')
  })

  it('zero → ⚪ Estável', () => {
    const r = computeHealthCheck(baseInput({ net30d: 0 }))
    const v = find(r, 'variation-30d')
    expect(v.status).toBe('gray')
    expect(v.statusLabel).toBe('Estável')
  })
})

// ============================================================
// MARGEM
// ============================================================

describe('computeHealthCheck — Margem', () => {
  it('margem ≥ 20% → 🟢 Saudável', () => {
    const r = computeHealthCheck(
      baseInput({ currentMonthRevenue: 100_000, currentMonthNetIncome: 25_000 }),
    )
    const m = find(r, 'margin')
    expect(m.value).toBe(25)
    expect(m.status).toBe('green')
    expect(m.statusLabel).toBe('Saudável')
    expect(m.display).toBe('25.0%')
  })

  it('margem 10-20% → 🟡 OK', () => {
    const r = computeHealthCheck(
      baseInput({ currentMonthRevenue: 100_000, currentMonthNetIncome: 15_000 }),
    )
    const m = find(r, 'margin')
    expect(m.status).toBe('yellow')
    expect(m.statusLabel).toBe('OK')
  })

  it('margem < 10% → 🔴 Apertada', () => {
    const r = computeHealthCheck(
      baseInput({ currentMonthRevenue: 100_000, currentMonthNetIncome: 5_000 }),
    )
    const m = find(r, 'margin')
    expect(m.status).toBe('red')
    expect(m.statusLabel).toBe('Apertada')
  })

  it('margem negativa → 🔴 Prejuízo', () => {
    const r = computeHealthCheck(
      baseInput({ currentMonthRevenue: 100_000, currentMonthNetIncome: -5_000 }),
    )
    const m = find(r, 'margin')
    expect(m.status).toBe('red')
    expect(m.statusLabel).toBe('Prejuízo')
    expect(m.value).toBe(-5)
  })

  it('receita zero → N/A + gray', () => {
    const r = computeHealthCheck(
      baseInput({ currentMonthRevenue: 0, currentMonthNetIncome: 0 }),
    )
    const m = find(r, 'margin')
    expect(m.value).toBeNull()
    expect(m.display).toBe('N/A')
    expect(m.status).toBe('gray')
    expect(m.statusLabel).toBe('Sem receita')
  })
})

// ============================================================
// Multi-tenant + estrutura
// ============================================================

describe('computeHealthCheck — multi-tenant + estrutura', () => {
  it('retorna 4 indicadores na ordem fixa', () => {
    const r = computeHealthCheck(baseInput())
    expect(r.indicators.map((i) => i.id)).toEqual([
      'burn-rate',
      'runway',
      'variation-30d',
      'margin',
    ])
  })

  it('companyId vazio LANÇA (multi-tenant guard)', () => {
    expect(() => computeHealthCheck(baseInput({ companyId: '' }))).toThrow(/multi-tenant/i)
  })

  it('result.companyId rastreabilidade', () => {
    const r = computeHealthCheck(baseInput({ companyId: 'comp-academia-3' }))
    expect(r.companyId).toBe('comp-academia-3')
  })
})
