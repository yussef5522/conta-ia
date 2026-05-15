import { describe, it, expect } from 'vitest'
import {
  buildWaterfallDrillDownUrl,
  computeConnectorSegments,
  exitLevel,
} from '@/lib/dashboard/waterfall-drilldown'
import type { WaterfallBar } from '@/lib/dashboard/compute-waterfall'

const PERIOD = {
  startDate: new Date('2026-05-01T00:00:00Z'),
  endDate: new Date('2026-05-31T23:59:59Z'),
}

function mkBar(
  kind: WaterfallBar['kind'],
  rawValue: number,
  displayBase: number,
  displayValue: number,
  id: string = kind,
): WaterfallBar {
  return { id, label: id, kind, rawValue, displayBase, displayValue, color: '#000' }
}

// ============================================================
// Drill-down URL
// ============================================================

describe('buildWaterfallDrillDownUrl — Sprint 2 Dia 2', () => {
  it('barra de ENTRADA → /transacoes?tipo=CREDIT', () => {
    const url = buildWaterfallDrillDownUrl({ kind: 'income' }, PERIOD)
    expect(url).toContain('/transacoes?')
    expect(url).toContain('tipo=CREDIT')
  })

  it('barra de SAÍDA → /transacoes?tipo=DEBIT', () => {
    const url = buildWaterfallDrillDownUrl({ kind: 'expense' }, PERIOD)
    expect(url).toContain('tipo=DEBIT')
  })

  it('âncora SALDO INICIAL → null (sem drill-down)', () => {
    expect(buildWaterfallDrillDownUrl({ kind: 'start' }, PERIOD)).toBeNull()
  })

  it('âncora SALDO FINAL → null (sem drill-down)', () => {
    expect(buildWaterfallDrillDownUrl({ kind: 'end' }, PERIOD)).toBeNull()
  })

  it('inclui inicio e fim do período na URL (YYYY-MM-DD)', () => {
    const url = buildWaterfallDrillDownUrl({ kind: 'income' }, PERIOD)!
    expect(url).toContain('inicio=2026-05-01')
    expect(url).toContain('fim=2026-05-31')
  })

  it('URL é válida e parseável', () => {
    const url = buildWaterfallDrillDownUrl({ kind: 'expense' }, PERIOD)!
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('tipo')).toBe('DEBIT')
    expect(params.get('inicio')).toBe('2026-05-01')
    expect(params.get('fim')).toBe('2026-05-31')
  })
})

// ============================================================
// exitLevel
// ============================================================

describe('exitLevel — nível do running total após cada barra', () => {
  it('start: exitLevel = rawValue (o saldo)', () => {
    expect(exitLevel(mkBar('start', 10000, 0, 10000))).toBe(10000)
  })

  it('start negativo: exitLevel = rawValue negativo', () => {
    expect(exitLevel(mkBar('start', -450000, -450000, 450000))).toBe(-450000)
  })

  it('income: exitLevel = displayBase + displayValue (subiu)', () => {
    // running antes = 10000, valor = 5000 → displayBase=10000, displayValue=5000
    expect(exitLevel(mkBar('income', 5000, 10000, 5000))).toBe(15000)
  })

  it('expense: exitLevel = displayBase (desceu)', () => {
    // running antes = 15000, valor = 3000 → displayBase=12000, displayValue=3000
    expect(exitLevel(mkBar('expense', 3000, 12000, 3000))).toBe(12000)
  })

  it('end: exitLevel = rawValue (saldo final)', () => {
    expect(exitLevel(mkBar('end', 12000, 0, 12000))).toBe(12000)
  })
})

// ============================================================
// computeConnectorSegments
// ============================================================

describe('computeConnectorSegments — Sprint 2 Dia 2', () => {
  it('N barras → N-1 segmentos', () => {
    const bars = [
      mkBar('start', 10000, 0, 10000, 'b0'),
      mkBar('income', 5000, 10000, 5000, 'b1'),
      mkBar('expense', 3000, 12000, 3000, 'b2'),
      mkBar('end', 12000, 0, 12000, 'b3'),
    ]
    const segs = computeConnectorSegments(bars)
    expect(segs).toHaveLength(3)
    expect(segs.map((s) => [s.fromIndex, s.toIndex])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ])
  })

  it('segmento liga no exitLevel da barra de origem', () => {
    const bars = [
      mkBar('start', 10000, 0, 10000),
      mkBar('income', 5000, 10000, 5000),
      mkBar('end', 15000, 0, 15000),
    ]
    const segs = computeConnectorSegments(bars)
    // seg 0: do start (exitLevel 10000) → income
    expect(segs[0].y).toBe(10000)
    // seg 1: do income (exitLevel 10000+5000=15000) → end
    expect(segs[1].y).toBe(15000)
  })

  it('lista vazia → []', () => {
    expect(computeConnectorSegments([])).toEqual([])
  })

  it('1 barra só → [] (nada pra conectar)', () => {
    expect(computeConnectorSegments([mkBar('start', 100, 0, 100)])).toEqual([])
  })

  it('cenário completo: saldo cresce e cai, conectores encadeiam', () => {
    // saldoInicial 8000 → +receitas 40000 → -folha 15000 → -fornec 8000 → final 25000
    const bars = [
      mkBar('start', 8000, 0, 8000, 'inicial'),
      mkBar('income', 40000, 8000, 40000, 'receitas'),
      mkBar('expense', 15000, 33000, 15000, 'folha'),
      mkBar('expense', 8000, 25000, 8000, 'fornecedores'),
      mkBar('end', 25000, 0, 25000, 'final'),
    ]
    const segs = computeConnectorSegments(bars)
    expect(segs.map((s) => s.y)).toEqual([8000, 48000, 33000, 25000])
  })
})
