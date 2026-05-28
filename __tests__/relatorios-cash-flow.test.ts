// Sprint 5.0.4.0b Fase 3 — Testes Fluxo de Caixa (puros).

import { describe, it, expect } from 'vitest'
import {
  computeCashFlowProjection,
  computeAccumulatedBalance,
  type ProjectionInputTx,
} from '@/lib/relatorios/cash-flow'

const REF_DATE = new Date(Date.UTC(2026, 4, 27)) // 27/05/2026

describe('computeCashFlowProjection', () => {
  it('retorna 3 buckets vazios sem transações', () => {
    const r = computeCashFlowProjection([], REF_DATE)
    expect(r.buckets).toHaveLength(3)
    expect(r.buckets.map((b) => b.id)).toEqual(['30d', '60d', '90d'])
    expect(r.total.entradas).toBe(0)
    expect(r.total.saidas).toBe(0)
    expect(r.total.resultado).toBe(0)
  })

  it('bucket 30d inclui só vencimentos nos próximos 30d', () => {
    const txs: ProjectionInputTx[] = [
      // Em 15 dias → 30d/60d/90d
      { type: 'CREDIT', amount: 1000, dueDate: new Date(REF_DATE.getTime() + 15 * 86_400_000) },
      // Em 45 dias → 60d/90d, NÃO 30d
      { type: 'CREDIT', amount: 500, dueDate: new Date(REF_DATE.getTime() + 45 * 86_400_000) },
      // Em 75 dias → 90d só
      { type: 'CREDIT', amount: 200, dueDate: new Date(REF_DATE.getTime() + 75 * 86_400_000) },
    ]
    const r = computeCashFlowProjection(txs, REF_DATE)
    expect(r.buckets[0].entradas).toBe(1000) // 30d
    expect(r.buckets[1].entradas).toBe(1500) // 60d cumulativo
    expect(r.buckets[2].entradas).toBe(1700) // 90d cumulativo
  })

  it('separa CREDIT (entradas) e DEBIT (saídas)', () => {
    const txs: ProjectionInputTx[] = [
      { type: 'CREDIT', amount: 5000, dueDate: new Date(REF_DATE.getTime() + 10 * 86_400_000) },
      { type: 'DEBIT', amount: 3000, dueDate: new Date(REF_DATE.getTime() + 10 * 86_400_000) },
    ]
    const r = computeCashFlowProjection(txs, REF_DATE)
    expect(r.buckets[0].entradas).toBe(5000)
    expect(r.buckets[0].saidas).toBe(3000)
    expect(r.buckets[0].resultado).toBe(2000)
  })

  it('ignora TRANSFER', () => {
    const txs: ProjectionInputTx[] = [
      { type: 'TRANSFER', amount: 10000, dueDate: new Date(REF_DATE.getTime() + 5 * 86_400_000) },
      { type: 'CREDIT', amount: 1000, dueDate: new Date(REF_DATE.getTime() + 5 * 86_400_000) },
    ]
    const r = computeCashFlowProjection(txs, REF_DATE)
    expect(r.buckets[0].entradas).toBe(1000) // TRANSFER ignorado
    expect(r.buckets[0].saidas).toBe(0)
  })

  it('ignora vencimentos passados (dueDate <= hoje)', () => {
    const txs: ProjectionInputTx[] = [
      { type: 'CREDIT', amount: 500, dueDate: new Date(REF_DATE.getTime() - 5 * 86_400_000) }, // ontem
      { type: 'CREDIT', amount: 500, dueDate: REF_DATE }, // hoje
      { type: 'CREDIT', amount: 100, dueDate: new Date(REF_DATE.getTime() + 1 * 86_400_000) }, // amanhã
    ]
    const r = computeCashFlowProjection(txs, REF_DATE)
    expect(r.buckets[0].entradas).toBe(100) // só amanhã conta
  })

  it('vencimentos exatamente em 30d entram no bucket 30d', () => {
    const txs: ProjectionInputTx[] = [
      { type: 'CREDIT', amount: 1000, dueDate: new Date(REF_DATE.getTime() + 30 * 86_400_000) },
    ]
    const r = computeCashFlowProjection(txs, REF_DATE)
    expect(r.buckets[0].entradas).toBe(1000)
  })

  it('vencimento em 31d NÃO entra no 30d, mas entra no 60d', () => {
    const txs: ProjectionInputTx[] = [
      { type: 'CREDIT', amount: 1000, dueDate: new Date(REF_DATE.getTime() + 31 * 86_400_000) },
    ]
    const r = computeCashFlowProjection(txs, REF_DATE)
    expect(r.buckets[0].entradas).toBe(0)
    expect(r.buckets[1].entradas).toBe(1000)
  })

  it('cenário real Yussef: contas a pagar próximos 30 dias', () => {
    const txs: ProjectionInputTx[] = [
      // Fornecedor 1: R$ 18k em 5 dias
      { type: 'DEBIT', amount: 18000, dueDate: new Date(REF_DATE.getTime() + 5 * 86_400_000) },
      // Fornecedor 2: R$ 12k em 15 dias
      { type: 'DEBIT', amount: 12000, dueDate: new Date(REF_DATE.getTime() + 15 * 86_400_000) },
      // Salário em 25 dias
      { type: 'DEBIT', amount: 8500, dueDate: new Date(REF_DATE.getTime() + 25 * 86_400_000) },
      // Recebível em 10 dias
      { type: 'CREDIT', amount: 45000, dueDate: new Date(REF_DATE.getTime() + 10 * 86_400_000) },
    ]
    const r = computeCashFlowProjection(txs, REF_DATE)
    expect(r.buckets[0].entradas).toBe(45000)
    expect(r.buckets[0].saidas).toBe(38500) // 18+12+8.5k
    expect(r.buckets[0].resultado).toBe(6500)
  })
})

describe('computeAccumulatedBalance', () => {
  it('acumula corretamente a partir do saldo inicial', () => {
    const r = computeAccumulatedBalance(
      [
        { bucketStart: new Date(Date.UTC(2026, 0, 1)), net: 1000 },
        { bucketStart: new Date(Date.UTC(2026, 1, 1)), net: -500 },
        { bucketStart: new Date(Date.UTC(2026, 2, 1)), net: 2000 },
      ],
      10_000,
    )
    expect(r).toHaveLength(3)
    expect(r[0].saldoAcumulado).toBe(11_000)
    expect(r[1].saldoAcumulado).toBe(10_500)
    expect(r[2].saldoAcumulado).toBe(12_500)
  })

  it('saldo inicial default 0', () => {
    const r = computeAccumulatedBalance([
      { bucketStart: new Date(Date.UTC(2026, 0, 1)), net: 500 },
    ])
    expect(r[0].saldoAcumulado).toBe(500)
  })

  it('lista vazia retorna array vazio', () => {
    const r = computeAccumulatedBalance([], 1000)
    expect(r).toEqual([])
  })

  it('bucketKey formato YYYY-MM correto', () => {
    const r = computeAccumulatedBalance([
      { bucketStart: new Date(Date.UTC(2026, 4, 1)), net: 0 },
    ])
    expect(r[0].bucketKey).toBe('2026-05')
  })

  it('saldo pode ficar negativo (cheque especial)', () => {
    const r = computeAccumulatedBalance(
      [{ bucketStart: new Date(Date.UTC(2026, 0, 1)), net: -50_000 }],
      10_000,
    )
    expect(r[0].saldoAcumulado).toBe(-40_000)
  })
})
