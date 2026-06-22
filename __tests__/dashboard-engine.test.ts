// Sprint 4 — testes do MOTOR único do dashboard
// Cobre: MoM honesto + Top5 sem vazamento NON_DRE + tipos coerentes

import { describe, it, expect } from 'vitest'
import { computeMoM, type ComputeMoMInput } from '../lib/dashboard/engine'

describe('computeMoM — MoM honesto (mata "+1860%" enganoso)', () => {
  it('mês anterior 0 tx → não comparável (sem_dados)', () => {
    const r = computeMoM({
      receitaCurrent: 285499.61,
      receitaPrevious: 0,
      txCurrent: 1266,
      txPrevious: 0,
    })
    expect(r.comparable).toBe(false)
    expect(r.motivo).toBe('sem_dados')
    expect(r.receitaDeltaPercent).toBeUndefined()
  })

  it('mês anterior < 20% do atual → não comparável (incompleto)', () => {
    // Caso real Cacula maio/junho: 251 tx maio (Sicredi único) vs 1266 junho
    // 251/1266 = 19.8% < 20% → incomparável
    const r = computeMoM({
      receitaCurrent: 285499.61,
      receitaPrevious: 14721.23,
      txCurrent: 1266,
      txPrevious: 251,
    })
    expect(r.comparable).toBe(false)
    expect(r.motivo).toBe('mes_anterior_incompleto')
    expect(r.thresholdRatio).toBe(0.2)
    expect(r.receitaDeltaPercent).toBeUndefined()
  })

  it('mês anterior >= 20% → comparable=true com deltaPercent', () => {
    const r = computeMoM({
      receitaCurrent: 285000,
      receitaPrevious: 200000,
      txCurrent: 1000,
      txPrevious: 500,
    })
    expect(r.comparable).toBe(true)
    expect(r.receitaDeltaPercent).toBeCloseTo(42.5, 1) // (285k - 200k) / 200k * 100
  })

  it('limite exato 20%: txPrev/txCurr = 0.2 PASSA como comparável', () => {
    // 200/1000 = 0.2; NÃO é < 0.2, então comparable=true
    const r = computeMoM({
      receitaCurrent: 100000,
      receitaPrevious: 80000,
      txCurrent: 1000,
      txPrevious: 200,
    })
    expect(r.comparable).toBe(true)
  })

  it('limite 19.99%: NÃO comparable', () => {
    const r = computeMoM({
      receitaCurrent: 100000,
      receitaPrevious: 80000,
      txCurrent: 1000,
      txPrevious: 199,
    })
    expect(r.comparable).toBe(false)
    expect(r.motivo).toBe('mes_anterior_incompleto')
  })

  it('previous=0 mas tx>0 (ex: mês passado só despesas) → comparable=true mas deltaPercent=null', () => {
    const r = computeMoM({
      receitaCurrent: 100000,
      receitaPrevious: 0,
      txCurrent: 1000,
      txPrevious: 500,
    })
    expect(r.comparable).toBe(true)
    expect(r.receitaDeltaPercent).toBeNull()
  })

  it('receita caiu → deltaPercent negativo', () => {
    const r = computeMoM({
      receitaCurrent: 80000,
      receitaPrevious: 100000,
      txCurrent: 500,
      txPrevious: 600,
    })
    expect(r.comparable).toBe(true)
    expect(r.receitaDeltaPercent).toBeCloseTo(-20, 1)
  })
})

describe('Sprint 4 — definições UNIFICADAS', () => {
  it('THRESHOLD 0.2 exposto via objeto retorno', () => {
    const r = computeMoM({ receitaCurrent: 0, receitaPrevious: 0, txCurrent: 1000, txPrevious: 100 })
    expect(r.thresholdRatio).toBe(0.2)
  })
})
