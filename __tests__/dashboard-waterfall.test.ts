import { describe, it, expect } from 'vitest'
import {
  computeWaterfall,
  type WaterfallTransaction,
  type ComputeWaterfallInput,
} from '@/lib/dashboard/compute-waterfall'

const D = new Date('2026-05-15T12:00:00Z')
const PERIOD_START = new Date('2026-05-01T00:00:00Z')
const PERIOD_END = new Date('2026-05-31T23:59:59Z')

function tx(
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER',
  amount: number,
  dreGroup: string | null,
  id = `tx-${Math.random()}`,
): WaterfallTransaction {
  return { id, type, amount, date: D, dreGroup }
}

// Monta o input com periodStart/periodEnd default — testes focam na lógica de barras
function input(
  partial: Omit<ComputeWaterfallInput, 'periodStart' | 'periodEnd'>,
): ComputeWaterfallInput {
  return { ...partial, periodStart: PERIOD_START, periodEnd: PERIOD_END }
}

function run(partial: Omit<ComputeWaterfallInput, 'periodStart' | 'periodEnd'>) {
  return computeWaterfall(input(partial))
}

function bar(r: ReturnType<typeof computeWaterfall>, id: string) {
  return r.bars.find((b) => b.id === id)
}

describe('computeWaterfall — Sprint 2 Dia 1', () => {
  it('agrupa RECEITA_BRUTA/RECEITAS_FINANCEIRAS/OUTRAS_RECEITAS em "Receitas"', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 30000,
      transactions: [
        tx('CREDIT', 10000, 'RECEITA_BRUTA'),
        tx('CREDIT', 5000, 'RECEITAS_FINANCEIRAS'),
        tx('CREDIT', 3000, 'OUTRAS_RECEITAS'),
      ],
    })
    expect(bar(r, 'receitas')?.rawValue).toBe(18000)
    expect(r.totalEntradas).toBe(18000)
  })

  it('mapeia dreGroups de saída nos buckets corretos', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 0,
      transactions: [
        tx('DEBIT', 8000, 'DESPESAS_PESSOAL'),
        tx('DEBIT', 3000, 'CUSTO_PRODUTO_VENDIDO'),
        tx('DEBIT', 2000, 'DESPESAS_COMERCIAIS'),
        tx('DEBIT', 1500, 'DESPESAS_ADMINISTRATIVAS'),
        tx('DEBIT', 500, 'DESPESAS_FINANCEIRAS'),
        tx('DEBIT', 1000, 'IMPOSTOS_SOBRE_LUCRO'),
      ],
    })
    expect(bar(r, 'folha')?.rawValue).toBe(8000)
    expect(bar(r, 'fornecedores')?.rawValue).toBe(5000)
    expect(bar(r, 'operacional')?.rawValue).toBe(2000)
    expect(bar(r, 'impostos')?.rawValue).toBe(1000)
  })

  it('CREDIT sem categoria → "Outras entradas"', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 5000,
      transactions: [tx('CREDIT', 5000, null)],
    })
    expect(bar(r, 'outras-entradas')?.rawValue).toBe(5000)
    expect(bar(r, 'receitas')).toBeUndefined()
  })

  it('DEBIT sem categoria → "Outras saídas"', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: -3000,
      transactions: [tx('DEBIT', 3000, null)],
    })
    expect(bar(r, 'outras-saidas')?.rawValue).toBe(3000)
  })

  it('cenário Cacula Mix-like: TODAS sem categoria → 2 buckets "outras"', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 7000,
      transactions: [
        tx('CREDIT', 10000, null),
        tx('CREDIT', 2000, null),
        tx('DEBIT', 5000, null),
      ],
    })
    expect(bar(r, 'outras-entradas')?.rawValue).toBe(12000)
    expect(bar(r, 'outras-saidas')?.rawValue).toBe(5000)
    expect(r.totalEntradas).toBe(12000)
    expect(r.totalSaidas).toBe(5000)
  })

  it('IGNORA type=TRANSFER (movimentação interna)', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 10000,
      transactions: [
        tx('CREDIT', 10000, 'RECEITA_BRUTA'),
        tx('TRANSFER', 50000, null),
        tx('TRANSFER', 50000, 'RECEITA_BRUTA'),
      ],
    })
    expect(r.totalEntradas).toBe(10000)
    expect(r.totalSaidas).toBe(0)
  })

  it('IGNORA dreGroup=AJUSTE_SALDO (correção técnica)', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 10000,
      transactions: [
        tx('CREDIT', 10000, 'RECEITA_BRUTA'),
        tx('DEBIT', 450000, 'AJUSTE_SALDO'),
      ],
    })
    expect(r.totalEntradas).toBe(10000)
    expect(r.totalSaidas).toBe(0)
    expect(bar(r, 'outras-saidas')).toBeUndefined()
  })

  it('IGNORA dreGroup=TRANSFERENCIA (Sprint 1.7 regression — movimentação interna)', () => {
    // Mesmo que CREDIT/DEBIT (não TRANSFER), se a categoria for "Transferências"
    // não infla entradas/saídas do waterfall.
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 10000,
      transactions: [
        tx('CREDIT', 10000, 'RECEITA_BRUTA'),
        tx('DEBIT', 50000, 'TRANSFERENCIA'),
        tx('CREDIT', 50000, 'TRANSFERENCIA'),
      ],
    })
    expect(r.totalEntradas).toBe(10000)
    expect(r.totalSaidas).toBe(0)
    expect(bar(r, 'outras-saidas')).toBeUndefined()
  })

  it('DISTRIBUICAO_LUCROS + INVESTIMENTOS caem em "Outras saídas"', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 0,
      transactions: [
        tx('DEBIT', 5000, 'DISTRIBUICAO_LUCROS'),
        tx('DEBIT', 3000, 'INVESTIMENTOS'),
        tx('DEBIT', 2000, 'OUTRAS_DESPESAS'),
      ],
    })
    expect(bar(r, 'outras-saidas')?.rawValue).toBe(10000)
  })

  it('INVARIANTE do waterfall: saldoInicial + entradas − saídas = saldoFinal', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 25000,
      transactions: [
        tx('CREDIT', 40000, 'RECEITA_BRUTA'),
        tx('DEBIT', 15000, 'DESPESAS_PESSOAL'),
        tx('DEBIT', 8000, 'CUSTO_PRODUTO_VENDIDO'),
      ],
    })
    expect(r.saldoInicial).toBe(8000)
    expect(round2(r.saldoInicial + r.totalEntradas - r.totalSaidas)).toBe(
      r.saldoFinal,
    )
  })

  it('ordem das barras: saldo-inicial → entradas → saídas → saldo-final', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 12000,
      transactions: [
        tx('CREDIT', 20000, 'RECEITA_BRUTA'),
        tx('CREDIT', 1000, null),
        tx('DEBIT', 8000, 'DESPESAS_PESSOAL'),
        tx('DEBIT', 1000, null),
      ],
    })
    expect(r.bars.map((b) => b.id)).toEqual([
      'saldo-inicial',
      'receitas',
      'outras-entradas',
      'folha',
      'outras-saidas',
      'saldo-final',
    ])
  })

  it('running total: displayBase encadeia corretamente entre barras', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 15000,
      transactions: [
        tx('CREDIT', 10000, 'RECEITA_BRUTA'),
        tx('DEBIT', 5000, 'DESPESAS_PESSOAL'),
      ],
    })
    expect(bar(r, 'saldo-inicial')?.displayValue).toBe(10000)
    expect(bar(r, 'receitas')?.displayBase).toBe(10000)
    expect(bar(r, 'receitas')?.displayValue).toBe(10000)
    expect(bar(r, 'folha')?.displayBase).toBe(15000)
    expect(bar(r, 'folha')?.displayValue).toBe(5000)
    expect(bar(r, 'saldo-final')?.displayValue).toBe(15000)
  })

  it('empty period: só saldo-inicial e saldo-final, iguais', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 8000,
      transactions: [],
    })
    expect(r.bars.map((b) => b.id)).toEqual(['saldo-inicial', 'saldo-final'])
    expect(r.saldoInicial).toBe(8000)
    expect(r.saldoFinal).toBe(8000)
    expect(r.totalMovimentado).toBe(0)
  })

  it('saldo negativo: âncora desce abaixo de zero (displayBase negativo)', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: -444178.92,
      transactions: [tx('CREDIT', 5821.08, null)],
    })
    expect(r.saldoInicial).toBe(-450000)
    const inicial = bar(r, 'saldo-inicial')!
    expect(inicial.displayBase).toBe(-450000)
    expect(inicial.displayValue).toBe(450000)
  })

  it('só entradas, sem saídas → renderiza normalmente', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 10000,
      transactions: [tx('CREDIT', 10000, 'RECEITA_BRUTA')],
    })
    expect(r.totalSaidas).toBe(0)
    expect(r.bars.map((b) => b.id)).toEqual([
      'saldo-inicial',
      'receitas',
      'saldo-final',
    ])
  })

  it('period (startDate/endDate) é propagado pro result', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 0,
      transactions: [],
    })
    expect(r.period.startDate).toEqual(PERIOD_START)
    expect(r.period.endDate).toEqual(PERIOD_END)
  })

  it('companyId vazio LANÇA (multi-tenant guard)', () => {
    expect(() =>
      run({
        companyId: '',
        periodType: 'mes',
        saldoFinal: 0,
        transactions: [],
      }),
    ).toThrow(/multi-tenant/i)
  })

  it('totalMovimentado = entradas + saídas (absolutos)', () => {
    const r = run({
      companyId: 'c1',
      periodType: 'mes',
      saldoFinal: 0,
      transactions: [
        tx('CREDIT', 30000, 'RECEITA_BRUTA'),
        tx('DEBIT', 30000, 'DESPESAS_PESSOAL'),
      ],
    })
    expect(r.totalMovimentado).toBe(60000)
  })
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
