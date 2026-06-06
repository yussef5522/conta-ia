// Sprint Reimport-DedupByData: testes do helper de cenário de reimport.

import { describe, it, expect } from 'vitest'
import {
  computeReimportScenario,
  checkBatchAlive,
} from '@/lib/excel-import/check-batch-alive'

describe('computeReimportScenario', () => {
  it('0 importadas → NEVER_IMPORTED', () => {
    expect(computeReimportScenario(0, 0)).toBe('NEVER_IMPORTED')
  })

  it('todas excluídas → ALL_DELETED', () => {
    expect(computeReimportScenario(59, 0)).toBe('ALL_DELETED')
  })

  it('algumas vivas, algumas excluídas → PARTIAL', () => {
    expect(computeReimportScenario(59, 30)).toBe('PARTIAL')
  })

  it('todas ainda vivas → ALL_ALIVE', () => {
    expect(computeReimportScenario(59, 59)).toBe('ALL_ALIVE')
  })

  it('aliveCount > totalImported (raro mas defensivo) → ALL_ALIVE', () => {
    // pode acontecer se outras tx com mesmo dedupHash foram criadas fora
    expect(computeReimportScenario(10, 12)).toBe('ALL_ALIVE')
  })

  it('aliveCount = 1 de 1 → ALL_ALIVE (não PARTIAL)', () => {
    expect(computeReimportScenario(1, 1)).toBe('ALL_ALIVE')
  })

  it('aliveCount = 0 de 1 → ALL_DELETED', () => {
    expect(computeReimportScenario(1, 0)).toBe('ALL_DELETED')
  })
})

describe('checkBatchAlive — caso real Yussef (59 contas, todas excluídas)', () => {
  it('staged_rows IMPORTED tem 59 dedupHashes, 0 tx vivas → ALL_DELETED', async () => {
    const stats = await checkBatchAlive({
      loadImportedDedupHashes: async () =>
        Array.from({ length: 59 }, (_, i) => `hash-${i}`),
      countAliveTxByDedupHash: async () => 0,
    })
    expect(stats.totalImported).toBe(59)
    expect(stats.aliveCount).toBe(0)
    expect(stats.scenario).toBe('ALL_DELETED')
  })

  it('batch sem staged_rows IMPORTED (nunca confirmado) → NEVER_IMPORTED + skip query de tx', async () => {
    let countQueriesCalled = 0
    const stats = await checkBatchAlive({
      loadImportedDedupHashes: async () => [],
      countAliveTxByDedupHash: async () => {
        countQueriesCalled++
        return 0
      },
    })
    expect(stats.scenario).toBe('NEVER_IMPORTED')
    expect(stats.totalImported).toBe(0)
    // Otimização: não consulta tx se nada foi importado
    expect(countQueriesCalled).toBe(0)
  })

  it('30 vivas de 59 → PARTIAL', async () => {
    const stats = await checkBatchAlive({
      loadImportedDedupHashes: async () =>
        Array.from({ length: 59 }, (_, i) => `hash-${i}`),
      countAliveTxByDedupHash: async () => 30,
    })
    expect(stats.scenario).toBe('PARTIAL')
    expect(stats.aliveCount).toBe(30)
  })

  it('todas as 59 ainda lá → ALL_ALIVE', async () => {
    const stats = await checkBatchAlive({
      loadImportedDedupHashes: async () =>
        Array.from({ length: 59 }, (_, i) => `hash-${i}`),
      countAliveTxByDedupHash: async () => 59,
    })
    expect(stats.scenario).toBe('ALL_ALIVE')
  })
})
