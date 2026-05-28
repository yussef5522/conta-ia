// Sprint 5.0.4.0b — Testes das funções puras de preview-queries.
// Helpers de período + computeTrend (não testa as queries Prisma —
// integração rodaria contra DB; aqui só lógica pura).

import { describe, it, expect } from 'vitest'
import {
  computeTrend,
  monthLabel,
  monthLabelShort,
} from '@/lib/relatorios/preview-queries'

describe('computeTrend', () => {
  it('retorna direção up quando current > previous', () => {
    const r = computeTrend(100, 150)
    expect(r.trendDirection).toBe('up')
    expect(r.trendPercent).toBe(50)
  })

  it('retorna direção down quando current < previous', () => {
    const r = computeTrend(200, 150)
    expect(r.trendDirection).toBe('down')
    expect(r.trendPercent).toBe(-25)
  })

  it('retorna stable quando variação < 1%', () => {
    const r = computeTrend(1000, 1005)
    expect(r.trendDirection).toBe('stable')
    expect(r.trendPercent).toBeCloseTo(0.5, 1)
  })

  it('retorna null e stable quando ambos zerados', () => {
    const r = computeTrend(0, 0)
    expect(r.trendPercent).toBeNull()
    expect(r.trendDirection).toBe('stable')
  })

  it('retorna null + up quando previous=0 e current>0 (sem divisão por zero)', () => {
    const r = computeTrend(0, 500)
    expect(r.trendPercent).toBeNull()
    expect(r.trendDirection).toBe('up')
  })

  it('retorna null + down quando previous=0 e current<0', () => {
    const r = computeTrend(0, -100)
    expect(r.trendPercent).toBeNull()
    expect(r.trendDirection).toBe('down')
  })

  it('lida com previous negativo (lucro virou prejuízo)', () => {
    // Mês anterior teve prejuízo R$ -100, mês atual lucro R$ 50.
    // Trend = (50 - (-100)) / |−100| × 100 = 150%
    const r = computeTrend(-100, 50)
    expect(r.trendPercent).toBe(150)
    expect(r.trendDirection).toBe('up')
  })

  it('lida com prejuízo aumentando (current ainda menor que previous)', () => {
    // Anterior -100, atual -150 = prejuízo PIOROU
    // delta = (-150 - (-100)) / |−100| × 100 = -50%
    const r = computeTrend(-100, -150)
    expect(r.trendPercent).toBe(-50)
    expect(r.trendDirection).toBe('down')
  })

  it('arredondamento de variação 1% como stable', () => {
    const r = computeTrend(1000, 1009)
    expect(r.trendDirection).toBe('stable') // 0.9%
  })

  it('1.5% conta como up (acima do threshold 1%)', () => {
    const r = computeTrend(1000, 1015)
    expect(r.trendDirection).toBe('up')
  })
})

describe('monthLabel / monthLabelShort', () => {
  it('formata data em pt-BR completo', () => {
    const d = new Date(Date.UTC(2026, 4, 15)) // Maio
    expect(monthLabel(d)).toBe('Maio/2026')
  })

  it('formata janeiro corretamente', () => {
    const d = new Date(Date.UTC(2026, 0, 1))
    expect(monthLabel(d)).toBe('Janeiro/2026')
  })

  it('formato curto mostra mês 3 letras + ano 2 dígitos', () => {
    const d = new Date(Date.UTC(2026, 4, 1))
    expect(monthLabelShort(d)).toBe('Mai/26')
  })

  it('formato curto janeiro 2025', () => {
    const d = new Date(Date.UTC(2025, 0, 1))
    expect(monthLabelShort(d)).toBe('Jan/25')
  })

  it('formato curto dezembro virada de século (sanidade)', () => {
    const d = new Date(Date.UTC(2099, 11, 1))
    expect(monthLabelShort(d)).toBe('Dez/99')
  })
})

describe('integração: trend semântica de Lucro Líquido', () => {
  it('lucro estável mes a mes = stable', () => {
    const r = computeTrend(10_000, 10_050)
    expect(r.trendDirection).toBe('stable')
  })

  it('lucro dobrou = up forte', () => {
    const r = computeTrend(5_000, 10_000)
    expect(r.trendDirection).toBe('up')
    expect(r.trendPercent).toBe(100)
  })

  it('lucro caiu 30% = down', () => {
    const r = computeTrend(10_000, 7_000)
    expect(r.trendDirection).toBe('down')
    expect(r.trendPercent).toBe(-30)
  })
})
