// Sprint A-effected Fase B.4.1 — create-adjustment helpers.

import { describe, it, expect } from 'vitest'
import {
  adjustmentTypeFromSign,
  adjustmentSignedAmount,
  buildAdjustmentTxData,
} from '@/lib/conciliacao/create-adjustment'

describe('adjustmentTypeFromSign', () => {
  it('EXPENSE → DEBIT (Juros, Tarifas, Arredondamento)', () => {
    expect(adjustmentTypeFromSign('EXPENSE')).toBe('DEBIT')
  })

  it('INCOME → CREDIT (Desconto Obtido)', () => {
    expect(adjustmentTypeFromSign('INCOME')).toBe('CREDIT')
  })
})

describe('adjustmentSignedAmount — soma do diff', () => {
  it('EXPENSE (+R$ 70 juros) → +70 (soma no Selected)', () => {
    expect(adjustmentSignedAmount(70, 'EXPENSE')).toBe(70)
  })

  it('INCOME (R$ 20 desconto) → -20 (subtrai do Selected)', () => {
    expect(adjustmentSignedAmount(20, 'INCOME')).toBe(-20)
  })

  it('Rejeita amount negativo (deve ser sempre positivo, sinal via sign)', () => {
    expect(() => adjustmentSignedAmount(-10, 'EXPENSE')).toThrow(/positivo/)
  })
})

describe('buildAdjustmentTxData — caso Juros R$ 70', () => {
  const base = {
    ofxTransactionId: 'ofx-boleto',
    bankAccountId: 'ba-banrisul',
    companyId: 'cmp-cacula',
    categoryId: 'cat-juros',
    amount: 70,
    sign: 'EXPENSE' as const,
    description: 'Juros — Fornecedor X',
    reconcileGroupId: 'rg_test_123',
    date: new Date('2026-06-05T00:00:00Z'),
    userId: 'user-yussef',
  }

  it('cria com type=DEBIT + EFFECTED + RECONCILED + origin=ADJUSTMENT', () => {
    const d = buildAdjustmentTxData(base)
    expect(d.type).toBe('DEBIT')
    expect(d.lifecycle).toBe('EFFECTED')
    expect(d.status).toBe('RECONCILED')
    expect(d.origin).toBe('ADJUSTMENT')
  })

  it('reconciledWithId fica NULL (ajuste é EFFECTED próprio, conta no DRE)', () => {
    const d = buildAdjustmentTxData(base)
    expect(d.reconciledWithId).toBeNull()
  })

  it('reconcileGroupId compartilhado com candidates do grupo', () => {
    const d = buildAdjustmentTxData(base)
    expect(d.reconcileGroupId).toBe('rg_test_123')
  })

  it('amount positivo + categoryId + bankAccountId + date herda OFX', () => {
    const d = buildAdjustmentTxData(base)
    expect(d.amount).toBe(70)
    expect(d.categoryId).toBe('cat-juros')
    expect(d.bankAccountId).toBe('ba-banrisul')
    expect(d.date).toEqual(new Date('2026-06-05T00:00:00Z'))
    expect(d.paymentDate).toEqual(new Date('2026-06-05T00:00:00Z'))
  })

  it('description preservada literal', () => {
    const d = buildAdjustmentTxData(base)
    expect(d.description).toBe('Juros — Fornecedor X')
  })

  it('cashCoded=false (não é cash coding, é ajuste de reconcile)', () => {
    const d = buildAdjustmentTxData(base)
    expect(d.cashCoded).toBe(false)
  })
})

describe('buildAdjustmentTxData — caso Desconto R$ 20 (INCOME)', () => {
  it('sign=INCOME → type=CREDIT', () => {
    const d = buildAdjustmentTxData({
      ofxTransactionId: 'ofx-boleto-desconto',
      bankAccountId: 'ba-banrisul',
      companyId: 'cmp-cacula',
      categoryId: 'cat-desconto',
      amount: 20,
      sign: 'INCOME',
      description: 'Desconto — Fornecedor Y',
      reconcileGroupId: 'rg_test_456',
      date: new Date('2026-06-10T00:00:00Z'),
      userId: 'user-yussef',
    })
    expect(d.type).toBe('CREDIT')
    expect(d.amount).toBe(20)
  })
})

describe('buildAdjustmentTxData — validações defensivas', () => {
  const base = {
    ofxTransactionId: 'ofx',
    bankAccountId: 'ba',
    companyId: 'cmp',
    categoryId: 'cat',
    amount: 70,
    sign: 'EXPENSE' as const,
    description: 'x',
    reconcileGroupId: 'rg',
    date: new Date(),
    userId: 'u',
  }

  it('Rejeita amount = 0', () => {
    expect(() => buildAdjustmentTxData({ ...base, amount: 0 })).toThrow(
      /positivo/,
    )
  })

  it('Rejeita amount negativo', () => {
    expect(() => buildAdjustmentTxData({ ...base, amount: -1 })).toThrow(
      /positivo/,
    )
  })

  it('Rejeita categoryId vazio', () => {
    expect(() => buildAdjustmentTxData({ ...base, categoryId: '' })).toThrow(
      /categoryId/,
    )
  })

  it('Rejeita description vazia', () => {
    expect(() => buildAdjustmentTxData({ ...base, description: '   ' })).toThrow(
      /description/,
    )
  })
})
