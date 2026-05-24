// Sprint 4.0.3 — testes da função pura computeFluxoPrevisto.

import { describe, it, expect } from 'vitest'
import { computeFluxoPrevisto } from '@/lib/dashboard/fluxo-previsto'

const today = new Date('2026-05-24T00:00:00Z')
const daysFromNow = (n: number) =>
  new Date(today.getTime() + n * 24 * 60 * 60 * 1000)

describe('computeFluxoPrevisto', () => {
  it('vazio → 3 buckets com zeros + saldo projetado = saldo atual', () => {
    const r = computeFluxoPrevisto([], 10_000, today)
    expect(r.saldoAtual).toBe(10_000)
    expect(r.buckets).toHaveLength(3)
    expect(r.buckets[0]).toMatchObject({
      days: 30,
      resultadoPrevisto: 0,
      saldoProjetado: 10_000,
    })
  })

  it('PAYABLE em 15d entra no bucket 30 (e 60 e 90)', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 500, dueDate: daysFromNow(15), lifecycle: 'PAYABLE' }],
      10_000,
      today,
    )
    const b30 = r.buckets.find((b) => b.days === 30)!
    expect(b30.despesasPrevistas.count).toBe(1)
    expect(b30.despesasPrevistas.total).toBe(500)
    expect(b30.resultadoPrevisto).toBe(-500)
    expect(b30.saldoProjetado).toBe(9_500)
  })

  it('RECEIVABLE em 20d → receitas no bucket 30', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 1_500, dueDate: daysFromNow(20), lifecycle: 'RECEIVABLE' }],
      10_000,
      today,
    )
    const b30 = r.buckets.find((b) => b.days === 30)!
    expect(b30.receitasPrevistas.count).toBe(1)
    expect(b30.receitasPrevistas.total).toBe(1_500)
    expect(b30.saldoProjetado).toBe(11_500)
  })

  it('tx vencida (dueDate < hoje) NÃO entra (alertas cobre)', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 300, dueDate: daysFromNow(-5), lifecycle: 'PAYABLE' }],
      10_000,
      today,
    )
    expect(r.buckets[0].despesasPrevistas.count).toBe(0)
    expect(r.buckets[0].saldoProjetado).toBe(10_000)
  })

  it('tx em 45d entra só em buckets 60 e 90 (não 30)', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 800, dueDate: daysFromNow(45), lifecycle: 'PAYABLE' }],
      10_000,
      today,
    )
    expect(r.buckets.find((b) => b.days === 30)!.despesasPrevistas.count).toBe(0)
    expect(r.buckets.find((b) => b.days === 60)!.despesasPrevistas.count).toBe(1)
    expect(r.buckets.find((b) => b.days === 90)!.despesasPrevistas.count).toBe(1)
  })

  it('tx em 75d entra só em bucket 90', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 200, dueDate: daysFromNow(75), lifecycle: 'PAYABLE' }],
      10_000,
      today,
    )
    expect(r.buckets.find((b) => b.days === 30)!.despesasPrevistas.count).toBe(0)
    expect(r.buckets.find((b) => b.days === 60)!.despesasPrevistas.count).toBe(0)
    expect(r.buckets.find((b) => b.days === 90)!.despesasPrevistas.count).toBe(1)
  })

  it('tx além de 90d nunca entra', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 999, dueDate: daysFromNow(100), lifecycle: 'PAYABLE' }],
      10_000,
      today,
    )
    for (const b of r.buckets) {
      expect(b.despesasPrevistas.count).toBe(0)
      expect(b.saldoProjetado).toBe(10_000)
    }
  })

  it('mistura receitas + despesas no mesmo bucket', () => {
    const r = computeFluxoPrevisto(
      [
        { id: '1', amount: 1_000, dueDate: daysFromNow(10), lifecycle: 'RECEIVABLE' },
        { id: '2', amount: 300, dueDate: daysFromNow(15), lifecycle: 'PAYABLE' },
        { id: '3', amount: 200, dueDate: daysFromNow(20), lifecycle: 'PAYABLE' },
      ],
      5_000,
      today,
    )
    const b30 = r.buckets[0]
    expect(b30.receitasPrevistas.total).toBe(1_000)
    expect(b30.despesasPrevistas.total).toBe(500)
    expect(b30.resultadoPrevisto).toBe(500)
    expect(b30.saldoProjetado).toBe(5_500)
  })

  it('dueDate null é ignorada', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 999, dueDate: null, lifecycle: 'PAYABLE' }],
      10_000,
      today,
    )
    expect(r.buckets[0].despesasPrevistas.count).toBe(0)
  })

  it('saldo negativo → projeção também negativa', () => {
    const r = computeFluxoPrevisto(
      [{ id: '1', amount: 5_000, dueDate: daysFromNow(10), lifecycle: 'PAYABLE' }],
      -2_000,
      today,
    )
    expect(r.buckets[0].saldoProjetado).toBe(-7_000)
  })
})
