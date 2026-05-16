// Testes de unidade do buildPairPendentes — Sprint 1.7.
// Testa a função PURA (sem DB). Atomicidade da rota é coberta via integration.

import { describe, it, expect } from 'vitest'
import { buildPairPendentes } from '@/lib/transfers/build-pair-pendentes'
import type { PendenteSnapshot } from '@/lib/transfers/build-pair-pendentes'
import { TransferValidationError } from '@/lib/transfers/validate'

const COMPANY_ID = 'comp-1'

function makeSnapshot(overrides: Partial<PendenteSnapshot> = {}): PendenteSnapshot {
  return {
    id: 'tx-default',
    bankAccountId: 'acc-1',
    bankAccountName: 'Banrisul Matriz',
    bankAccountCompanyId: COMPANY_ID,
    type: 'DEBIT',
    amount: 1500,
    date: new Date('2026-05-11T12:00:00Z'),
    description: 'PIX Yussef Musa',
    dedupHash: 'hash-default',
    ...overrides,
  }
}

describe('buildPairPendentes (Sprint 1.7)', () => {
  describe('happy path — cenário Yussef PIX R$ 11.900 Cacula Mix', () => {
    it('pareia DEBIT Banrisul + CREDIT Stone como par TRANSFER com mesmo groupId', () => {
      const debitOriginal = makeSnapshot({
        id: 'tx-banrisul',
        bankAccountId: 'acc-banrisul',
        bankAccountName: 'Banrisul Cacula Mix',
        type: 'DEBIT',
        amount: 11900,
        date: new Date('2026-04-30T10:00:00Z'),
        description: 'PIX TRANSF P/STONE 5060',
        dedupHash: 'hash-banrisul-out',
      })
      const creditOriginal = makeSnapshot({
        id: 'tx-stone',
        bankAccountId: 'acc-stone',
        bankAccountName: 'Stone Cacula Mix',
        type: 'CREDIT',
        amount: 11900,
        date: new Date('2026-04-30T10:00:01Z'),
        description: 'PIX RECEBIDO BANRISUL',
        dedupHash: 'hash-stone-in',
      })

      const ops = buildPairPendentes(
        { txA: debitOriginal, txB: creditOriginal },
        'group-cacula-pix',
      )

      expect(ops.fromAccountId).toBe('acc-banrisul')
      expect(ops.toAccountId).toBe('acc-stone')
      expect(ops.debitTx.transferGroupId).toBe('group-cacula-pix')
      expect(ops.creditTx.transferGroupId).toBe('group-cacula-pix')
      expect(ops.debitTx.type).toBe('TRANSFER')
      expect(ops.creditTx.type).toBe('TRANSFER')
      expect(ops.debitTx.amount).toBe(11900)
      expect(ops.creditTx.amount).toBe(11900)
    })

    it('inverte direção quando txA é CREDIT e txB é DEBIT', () => {
      const credit = makeSnapshot({
        id: 'tx-c',
        bankAccountId: 'acc-c',
        type: 'CREDIT',
        amount: 500,
      })
      const debit = makeSnapshot({
        id: 'tx-d',
        bankAccountId: 'acc-d',
        type: 'DEBIT',
        amount: 500,
      })

      const ops = buildPairPendentes({ txA: credit, txB: debit }, 'g')

      expect(ops.fromAccountId).toBe('acc-d') // DEBIT = origem
      expect(ops.toAccountId).toBe('acc-c') // CREDIT = destino
    })

    it('preserva o dedupHash de CADA conta nas duas pontas TRANSFER (proteção de re-import)', () => {
      const debitOrig = makeSnapshot({
        id: 'tx-1',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        dedupHash: 'hash-acc1-debit',
      })
      const creditOrig = makeSnapshot({
        id: 'tx-2',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        dedupHash: 'hash-acc2-credit',
      })

      const ops = buildPairPendentes({ txA: debitOrig, txB: creditOrig }, 'g')

      // Cada ponta TRANSFER herda o dedupHash DA ORIGINAL DAQUELA conta.
      expect(ops.debitTx.dedupHash).toBe('hash-acc1-debit')
      expect(ops.creditTx.dedupHash).toBe('hash-acc2-credit')
    })

    it('deltas de saldo netam zero por conta (revert + apply)', () => {
      const debit = makeSnapshot({
        id: 'd',
        bankAccountId: 'acc-from',
        type: 'DEBIT',
        amount: 800,
      })
      const credit = makeSnapshot({
        id: 'c',
        bankAccountId: 'acc-to',
        type: 'CREDIT',
        amount: 800,
      })

      const ops = buildPairPendentes({ txA: debit, txB: credit }, 'g')

      // fromAccount: delete da DEBIT (+800) + apply TRANSFER saída (-800) = 0
      expect(ops.fromAccountRevertDelta + ops.fromAccountApplyDelta).toBe(0)
      // toAccount: delete da CREDIT (-800) + apply TRANSFER entrada (+800) = 0
      expect(ops.toAccountRevertDelta + ops.toAccountApplyDelta).toBe(0)
    })

    it('usa a data MAIS ANTIGA das duas como data da transferência', () => {
      const old = makeSnapshot({
        id: 'old',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        date: new Date('2026-04-30T00:00:00Z'),
      })
      const newer = makeSnapshot({
        id: 'new',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        date: new Date('2026-05-02T00:00:00Z'),
      })

      const ops = buildPairPendentes({ txA: old, txB: newer }, 'g')

      expect(ops.debitTx.date).toEqual(new Date('2026-04-30T00:00:00Z'))
      expect(ops.creditTx.date).toEqual(new Date('2026-04-30T00:00:00Z'))
    })
  })

  describe('validações', () => {
    it('rejeita parear a mesma transação consigo mesma', () => {
      const tx = makeSnapshot()
      expect(() =>
        buildPairPendentes({ txA: tx, txB: { ...tx } }, 'g'),
      ).toThrow(TransferValidationError)
    })

    it('rejeita contas de empresas diferentes (isolamento multi-tenant)', () => {
      const a = makeSnapshot({
        id: 'a',
        bankAccountId: 'acc-1',
        bankAccountCompanyId: 'comp-1',
        type: 'DEBIT',
      })
      const b = makeSnapshot({
        id: 'b',
        bankAccountId: 'acc-2',
        bankAccountCompanyId: 'comp-OTHER',
        type: 'CREDIT',
      })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).toThrow(
        /mesma empresa/i,
      )
    })

    it('rejeita transações na mesma conta', () => {
      const a = makeSnapshot({ id: 'a', bankAccountId: 'acc-1', type: 'DEBIT' })
      const b = makeSnapshot({ id: 'b', bankAccountId: 'acc-1', type: 'CREDIT' })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).toThrow(
        /contas diferentes/i,
      )
    })

    it('rejeita tipos iguais (precisa ser CREDIT ↔ DEBIT)', () => {
      const a = makeSnapshot({ id: 'a', bankAccountId: 'acc-1', type: 'DEBIT' })
      const b = makeSnapshot({ id: 'b', bankAccountId: 'acc-2', type: 'DEBIT' })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).toThrow(
        /opostos/i,
      )
    })

    it('rejeita valores divergentes acima de R$ 0,01', () => {
      const a = makeSnapshot({
        id: 'a',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        amount: 1000,
      })
      const b = makeSnapshot({
        id: 'b',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        amount: 1000.5,
      })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).toThrow(
        /Valores divergem/i,
      )
    })

    it('aceita valores com diferença ≤ R$ 0,01 (tolerância de centavo)', () => {
      const a = makeSnapshot({
        id: 'a',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        amount: 1000.0,
      })
      const b = makeSnapshot({
        id: 'b',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        amount: 1000.01,
      })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).not.toThrow()
    })

    it('rejeita datas com mais de 3 dias de diferença', () => {
      const a = makeSnapshot({
        id: 'a',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        date: new Date('2026-05-01T00:00:00Z'),
      })
      const b = makeSnapshot({
        id: 'b',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        date: new Date('2026-05-05T12:00:00Z'),
      })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).toThrow(
        /Datas distantes/i,
      )
    })

    it('aceita datas exatamente ±3 dias', () => {
      const a = makeSnapshot({
        id: 'a',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        date: new Date('2026-05-01T00:00:00Z'),
      })
      const b = makeSnapshot({
        id: 'b',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        date: new Date('2026-05-04T00:00:00Z'),
      })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).not.toThrow()
    })

    it('rejeita amount não-positivo', () => {
      const a = makeSnapshot({
        id: 'a',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        amount: 0,
      })
      const b = makeSnapshot({
        id: 'b',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        amount: 0,
      })
      expect(() => buildPairPendentes({ txA: a, txB: b }, 'g')).toThrow(
        /positivo/i,
      )
    })
  })

  describe('audit metadata', () => {
    it('expõe deletedTransactionIds + source pair-pendentes', () => {
      const a = makeSnapshot({ id: 'A', bankAccountId: 'acc-1', type: 'DEBIT' })
      const b = makeSnapshot({ id: 'B', bankAccountId: 'acc-2', type: 'CREDIT' })

      const ops = buildPairPendentes({ txA: a, txB: b }, 'g')

      expect(ops.auditMetadata.source).toBe('pair-pendentes')
      expect(ops.auditMetadata.deletedTransactionIds).toEqual(['A', 'B'])
      expect(ops.auditMetadata.amount).toBe(a.amount)
    })

    it('snapshota os dedupHashes originais (rastreabilidade)', () => {
      const a = makeSnapshot({
        id: 'A',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        dedupHash: 'orig-a',
      })
      const b = makeSnapshot({
        id: 'B',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        dedupHash: 'orig-b',
      })

      const ops = buildPairPendentes({ txA: a, txB: b }, 'g')

      expect(ops.auditMetadata.txAOriginalDedupHash).toBe('orig-a')
      expect(ops.auditMetadata.txBOriginalDedupHash).toBe('orig-b')
    })
  })

  describe('robustez', () => {
    it('aceita uma das transações sem dedupHash (criada manualmente)', () => {
      const a = makeSnapshot({
        id: 'A',
        bankAccountId: 'acc-1',
        type: 'DEBIT',
        dedupHash: null,
      })
      const b = makeSnapshot({
        id: 'B',
        bankAccountId: 'acc-2',
        type: 'CREDIT',
        dedupHash: 'hash-ofx',
      })

      const ops = buildPairPendentes({ txA: a, txB: b }, 'g')
      expect(ops.debitTx.dedupHash).toBeNull()
      expect(ops.creditTx.dedupHash).toBe('hash-ofx')
    })
  })
})
