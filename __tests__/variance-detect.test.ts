// Sprint 5.0.4.0c1 Fase 2 — Testes do algoritmo de detecção de variâncias.

import { describe, it, expect } from 'vitest'
import {
  detectVariances,
  summarizeVariances,
  type CategoryPeriodData,
} from '@/lib/variance/detect-variances'

function cat(
  id: string,
  name: string,
  amount: number,
  dreGroup: string | null = null,
): CategoryPeriodData {
  return { categoryId: id, categoryName: name, dreGroup, amount }
}

describe('detectVariances — levels básicos', () => {
  it('CRITICAL_UP quando categoria dobrou (+100%)', () => {
    const r = detectVariances(
      [cat('1', 'Folha', 20_000)],
      [cat('1', 'Folha', 10_000)],
    )
    expect(r).toHaveLength(1)
    expect(r[0].level).toBe('CRITICAL_UP')
    expect(r[0].severity).toBe('critical')
    expect(r[0].variationPct).toBe(100)
    expect(r[0].variationAbs).toBe(10_000)
  })

  it('HIGH_UP em +30%', () => {
    const r = detectVariances(
      [cat('1', 'Aluguel', 13_000)],
      [cat('1', 'Aluguel', 10_000)],
    )
    expect(r[0].level).toBe('HIGH_UP')
    expect(r[0].severity).toBe('high')
  })

  it('MODERATE_UP em +20%', () => {
    const r = detectVariances(
      [cat('1', 'Energia', 12_000)],
      [cat('1', 'Energia', 10_000)],
    )
    expect(r[0].level).toBe('MODERATE_UP')
    expect(r[0].severity).toBe('moderate')
  })

  it('MODERATE_DOWN em -20%', () => {
    const r = detectVariances(
      [cat('1', 'Marketing', 8_000)],
      [cat('1', 'Marketing', 10_000)],
    )
    expect(r[0].level).toBe('MODERATE_DOWN')
    expect(r[0].variationPct).toBe(-20)
  })

  it('HIGH_DOWN em -30%', () => {
    const r = detectVariances(
      [cat('1', 'Marketing', 7_000)],
      [cat('1', 'Marketing', 10_000)],
    )
    expect(r[0].level).toBe('HIGH_DOWN')
  })

  it('CRITICAL_DOWN em -60%', () => {
    const r = detectVariances(
      [cat('1', 'Marketing', 4_000)],
      [cat('1', 'Marketing', 10_000)],
    )
    expect(r[0].level).toBe('CRITICAL_DOWN')
    expect(r[0].severity).toBe('critical')
  })
})

describe('detectVariances — NEW e DISAPPEARED', () => {
  it('NEW quando categoria não existia na base', () => {
    const r = detectVariances(
      [cat('1', 'Marketing', 8_500)],
      [],
    )
    expect(r).toHaveLength(1)
    expect(r[0].level).toBe('NEW')
    expect(r[0].severity).toBe('high')
    expect(r[0].variationPct).toBeNull()
    expect(r[0].baseAmount).toBe(0)
    expect(r[0].currentAmount).toBe(8_500)
  })

  it('DISAPPEARED quando categoria sumiu', () => {
    const r = detectVariances(
      [],
      [cat('1', 'Marketing antigo', 5_000)],
    )
    expect(r).toHaveLength(1)
    expect(r[0].level).toBe('DISAPPEARED')
    expect(r[0].severity).toBe('moderate')
    expect(r[0].currentAmount).toBe(0)
    expect(r[0].baseAmount).toBe(5_000)
  })

  it('base = 0 + current > 0 vira NEW (não divisão por zero)', () => {
    const r = detectVariances(
      [cat('1', 'Folha', 10_000)],
      [cat('1', 'Folha', 0)],
    )
    expect(r[0].level).toBe('NEW')
    expect(r[0].variationPct).toBeNull()
  })
})

describe('detectVariances — Materiality threshold', () => {
  it('ignora variação se max(current, base) < R$ 500 (default)', () => {
    const r = detectVariances(
      [cat('1', 'Café', 100)],
      [cat('1', 'Café', 50)],
    )
    expect(r).toHaveLength(0)
  })

  it('inclui se current >= R$ 500 mesmo com base baixa', () => {
    const r = detectVariances(
      [cat('1', 'Marketing', 600)],
      [cat('1', 'Marketing', 50)],
    )
    expect(r).toHaveLength(1)
  })

  it('inclui se base >= R$ 500 mesmo com current baixo', () => {
    const r = detectVariances(
      [cat('1', 'Algo', 100)],
      [cat('1', 'Algo', 600)],
    )
    expect(r).toHaveLength(1)
  })

  it('threshold custom R$ 1000 aplicado', () => {
    const r = detectVariances(
      [cat('1', 'X', 800)],
      [cat('1', 'X', 400)],
      { minAbsoluteValue: 1_000 },
    )
    expect(r).toHaveLength(0)
  })

  it('threshold 0 deixa tudo passar', () => {
    const r = detectVariances(
      [cat('1', 'Café', 10)],
      [cat('1', 'Café', 5)],
      { minAbsoluteValue: 0 },
    )
    expect(r).toHaveLength(1)
    expect(r[0].level).toBe('CRITICAL_UP') // +100%
  })
})

describe('detectVariances — STABLE filter', () => {
  it('STABLE (±15%) filtrado out por padrão', () => {
    const r = detectVariances(
      [cat('1', 'Aluguel', 10_500)], // +5%
      [cat('1', 'Aluguel', 10_000)],
    )
    expect(r).toHaveLength(0)
  })

  it('STABLE incluído com includeStable=true', () => {
    const r = detectVariances(
      [cat('1', 'Aluguel', 10_500)],
      [cat('1', 'Aluguel', 10_000)],
      { includeStable: true },
    )
    expect(r).toHaveLength(1)
    expect(r[0].level).toBe('STABLE')
  })

  it('±14.9% ainda é STABLE (fronteira)', () => {
    const r = detectVariances(
      [cat('1', 'X', 11_490)], // +14.9%
      [cat('1', 'X', 10_000)],
      { includeStable: true },
    )
    expect(r[0].level).toBe('STABLE')
  })

  it('+15% exato é MODERATE_UP (cruzou fronteira)', () => {
    const r = detectVariances(
      [cat('1', 'X', 11_500)], // +15%
      [cat('1', 'X', 10_000)],
    )
    expect(r[0].level).toBe('MODERATE_UP')
  })
})

describe('detectVariances — fronteiras exatas', () => {
  it('+50% vira CRITICAL_UP', () => {
    const r = detectVariances(
      [cat('1', 'X', 15_000)],
      [cat('1', 'X', 10_000)],
    )
    expect(r[0].level).toBe('CRITICAL_UP')
  })

  it('+25% vira HIGH_UP', () => {
    const r = detectVariances(
      [cat('1', 'X', 12_500)],
      [cat('1', 'X', 10_000)],
    )
    expect(r[0].level).toBe('HIGH_UP')
  })

  it('-25% vira HIGH_DOWN', () => {
    const r = detectVariances(
      [cat('1', 'X', 7_500)],
      [cat('1', 'X', 10_000)],
    )
    expect(r[0].level).toBe('HIGH_DOWN')
  })

  it('-50% vira CRITICAL_DOWN', () => {
    const r = detectVariances(
      [cat('1', 'X', 5_000)],
      [cat('1', 'X', 10_000)],
    )
    expect(r[0].level).toBe('CRITICAL_DOWN')
  })
})

describe('detectVariances — ordenação', () => {
  it('ordena por severidade DESC, depois por |variationAbs| DESC', () => {
    const r = detectVariances(
      [
        cat('1', 'A', 5_000),
        cat('2', 'B', 8_000),
        cat('3', 'C', 11_000),
        cat('4', 'D', 5_000),
      ],
      [
        cat('1', 'A', 4_300), // +16% MODERATE_UP, +700
        cat('2', 'B', 6_000), // +33% HIGH_UP, +2000
        cat('3', 'C', 5_000), // +120% CRITICAL_UP, +6000
        cat('4', 'D', 1_000), // +400% CRITICAL_UP, +4000
      ],
    )
    // 2 critical (C com +6k, D com +4k) → critical primeiro ordenados por |abs|
    // depois high (B +2k)
    // depois moderate (A +700)
    expect(r[0].categoryName).toBe('C')
    expect(r[1].categoryName).toBe('D')
    expect(r[2].categoryName).toBe('B')
    expect(r[3].categoryName).toBe('A')
  })
})

describe('detectVariances — cenário real Cacula Mar→Abr', () => {
  it('cenário Yussef: Folha disparou, Marketing nova, IPTU sumiu', () => {
    const base = [
      cat('folha', 'Salários', 23_000, 'DESPESAS_PESSOAL'),
      cat('iptu', 'IPTU', 12_000, 'DESPESAS_ADMINISTRATIVAS'),
      cat('aluguel', 'Aluguel', 19_000, 'DESPESAS_ADMINISTRATIVAS'),
    ]
    const current = [
      cat('folha', 'Salários', 45_000, 'DESPESAS_PESSOAL'),
      cat('marketing', 'Marketing', 8_500, 'DESPESAS_COMERCIAIS'),
      cat('aluguel', 'Aluguel', 19_600, 'DESPESAS_ADMINISTRATIVAS'),
    ]
    const r = detectVariances(current, base)

    // 3 variâncias: Folha (CRITICAL_UP), Marketing (NEW), IPTU (DISAPPEARED)
    // Aluguel é STABLE (+3%) — filtrado
    expect(r).toHaveLength(3)
    const byCat = new Map(r.map((v) => [v.categoryName, v]))
    expect(byCat.get('Salários')?.level).toBe('CRITICAL_UP')
    expect(byCat.get('Marketing')?.level).toBe('NEW')
    expect(byCat.get('IPTU')?.level).toBe('DISAPPEARED')

    // Verifica ordenação: critical primeiro
    expect(r[0].level).toBe('CRITICAL_UP')
  })
})

describe('summarizeVariances', () => {
  it('conta corretamente por severidade', () => {
    const variances = [
      {
        categoryId: '1',
        categoryName: 'A',
        dreGroup: null,
        currentAmount: 10_000,
        baseAmount: 5_000,
        variationAbs: 5_000,
        variationPct: 100,
        level: 'CRITICAL_UP' as const,
        severity: 'critical' as const,
        type: 'increase' as const,
      },
      {
        categoryId: '2',
        categoryName: 'B',
        dreGroup: null,
        currentAmount: 6_000,
        baseAmount: 4_000,
        variationAbs: 2_000,
        variationPct: 50,
        level: 'HIGH_UP' as const,
        severity: 'high' as const,
        type: 'increase' as const,
      },
      {
        categoryId: '3',
        categoryName: 'C',
        dreGroup: null,
        currentAmount: 1_500,
        baseAmount: 0,
        variationAbs: 1_500,
        variationPct: null,
        level: 'NEW' as const,
        severity: 'high' as const,
        type: 'new' as const,
      },
    ]
    const s = summarizeVariances(variances)
    expect(s.critical.count).toBe(1)
    expect(s.critical.totalImpact).toBe(5_000)
    expect(s.high.count).toBe(2) // CRITICAL_UP não conta como high, mas HIGH_UP + NEW sim
    expect(s.new.count).toBe(1)
    expect(s.new.totalImpact).toBe(1_500) // currentAmount, não variationAbs
  })

  it('totalImpact zero quando lista vazia', () => {
    const s = summarizeVariances([])
    expect(s.critical.count).toBe(0)
    expect(s.high.count).toBe(0)
    expect(s.moderate.count).toBe(0)
    expect(s.new.count).toBe(0)
  })
})

describe('detectVariances — defesa contra dados ruins', () => {
  it('listas vazias retornam array vazio', () => {
    expect(detectVariances([], [])).toEqual([])
  })

  it('valores negativos não quebram (estranho mas válido)', () => {
    const r = detectVariances(
      [cat('1', 'Estorno', 1_000)],
      [cat('1', 'Estorno', -500)],
      { minAbsoluteValue: 0 },
    )
    // Math operations funcionam — sem assertion sobre level
    // (estorno negativo é caso edge que não devia acontecer na prática)
    expect(r).toHaveLength(1)
  })
})
