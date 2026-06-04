// Sprint A — testes do find-candidates relaxado (RAMO 1 + RAMO 2 EFFECTED órfão).
//
// Foco em validar: query montada com escopo correto + mapeamento da linha
// EFFECTED entrando como targetLifecycle.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const findManyMock = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: { transaction: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}))

import { findReconciliationCandidates, resolveTargetDate } from '@/lib/conciliacao/find-candidates'
import type { OFXTransaction } from '@/lib/conciliacao/match'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

const baseDebitOFX: OFXTransaction = {
  id: 'ofx-nestle',
  description: 'NESTLE BRASIL LTDA - Pagamento',
  amount: 105.86,
  type: 'DEBIT',
  date: utc(2026, 5, 3),
  supplierId: null,
  bankAccountId: 'ba-banrisul',
}

const baseCreditOFX: OFXTransaction = {
  ...baseDebitOFX,
  id: 'ofx-cliente-x',
  description: 'CLIENTE X - PIX recebido',
  type: 'CREDIT',
  amount: 500,
}

describe('resolveTargetDate', () => {
  it('prefere dueDate quando presente', () => {
    const r = resolveTargetDate({
      id: 'x', lifecycle: 'PAYABLE', description: 'x', amount: 1,
      dueDate: utc(2026, 5, 1),
      paymentDate: utc(2026, 5, 10),
      date: utc(2026, 5, 20),
      supplierId: null, customerId: null, categoryId: null,
    })
    expect(r.toISOString()).toBe(utc(2026, 5, 1).toISOString())
  })

  it('fallback paymentDate quando dueDate=null', () => {
    const r = resolveTargetDate({
      id: 'x', lifecycle: 'EFFECTED', description: 'x', amount: 1,
      dueDate: null,
      paymentDate: utc(2026, 5, 10),
      date: utc(2026, 5, 20),
      supplierId: null, customerId: null, categoryId: null,
    })
    expect(r.toISOString()).toBe(utc(2026, 5, 10).toISOString())
  })

  it('fallback date quando dueDate=null e paymentDate=null', () => {
    const r = resolveTargetDate({
      id: 'x', lifecycle: 'EFFECTED', description: 'x', amount: 1,
      dueDate: null,
      paymentDate: null,
      date: utc(2026, 5, 20),
      supplierId: null, customerId: null, categoryId: null,
    })
    expect(r.toISOString()).toBe(utc(2026, 5, 20).toISOString())
  })
})

describe('findReconciliationCandidates — RAMO 1 (clássico PAYABLE)', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('OFX DEBIT → busca PAYABLE pendente E EFFECTED órfão DEBIT', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'company-1')

    expect(findManyMock).toHaveBeenCalledOnce()
    const where = findManyMock.mock.calls[0][0].where
    expect(where.reconciledWithId).toBe(null)
    // OR aninhado dentro de AND
    const ramos = where.AND[1].OR
    expect(ramos).toHaveLength(2)

    // RAMO 1
    expect(ramos[0]).toMatchObject({
      lifecycle: 'PAYABLE',
      status: 'PENDING',
    })
    expect(ramos[0].dueDate.gte).toBeInstanceOf(Date)

    // RAMO 2 — EFFECTED órfão DEBIT
    expect(ramos[1]).toMatchObject({
      lifecycle: 'EFFECTED',
      type: 'DEBIT',
    })
    expect(ramos[1].origin.in).toEqual(['IMPORT_EXCEL', 'MANUAL'])
  })

  it('OFX CREDIT → busca RECEIVABLE pendente E EFFECTED órfão CREDIT', async () => {
    await findReconciliationCandidates(baseCreditOFX, 'company-1')

    const ramos = findManyMock.mock.calls[0][0].where.AND[1].OR
    expect(ramos[0].lifecycle).toBe('RECEIVABLE')
    expect(ramos[1].type).toBe('CREDIT')
  })
})

describe('findReconciliationCandidates — RAMO 2 (EFFECTED órfão Sprint A)', () => {
  beforeEach(() => {
    findManyMock.mockReset()
  })

  it('🚨 nunca inclui origin=OFX no ramo 2 (não concilia OFX-vs-OFX)', async () => {
    findManyMock.mockResolvedValue([])
    await findReconciliationCandidates(baseDebitOFX, 'company-1')

    const ramo2 = findManyMock.mock.calls[0][0].where.AND[1].OR[1]
    expect(ramo2.origin.in).not.toContain('OFX')
    expect(ramo2.origin.in).toEqual(['IMPORT_EXCEL', 'MANUAL'])
  })

  it('EFFECTED órfão sai com lifecycle = targetLifecycle (DEBIT → PAYABLE)', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'excel-nestle',
        lifecycle: 'EFFECTED',
        description: 'Nestle Brasil Ltda',
        amount: 105.86,
        dueDate: utc(2026, 5, 3),
        paymentDate: utc(2026, 5, 3),
        date: utc(2026, 5, 3),
        supplierId: null,
        customerId: null,
        categoryId: null,
      },
    ])

    const r = await findReconciliationCandidates(baseDebitOFX, 'company-1')
    expect(r).toHaveLength(1)
    // Mesmo sendo EFFECTED no banco, o scorer recebe como PAYABLE pra checar direção
    expect(r[0].lifecycle).toBe('PAYABLE')
    expect(r[0].id).toBe('excel-nestle')
  })

  it('EFFECTED órfão CREDIT sai como RECEIVABLE', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'manual-cliente',
        lifecycle: 'EFFECTED',
        description: 'Recebimento avulso',
        amount: 500,
        dueDate: null,
        paymentDate: utc(2026, 5, 3),
        date: utc(2026, 5, 3),
        supplierId: null,
        customerId: null,
        categoryId: null,
      },
    ])

    const r = await findReconciliationCandidates(baseCreditOFX, 'company-1')
    expect(r[0].lifecycle).toBe('RECEIVABLE')
  })

  it('PAYABLE clássico mantém lifecycle PAYABLE (não é EFFECTED)', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'payable-x',
        lifecycle: 'PAYABLE',
        description: 'AP normal',
        amount: 100,
        dueDate: utc(2026, 5, 1),
        paymentDate: null,
        date: utc(2026, 5, 1),
        supplierId: null,
        customerId: null,
        categoryId: null,
      },
    ])

    const r = await findReconciliationCandidates(baseDebitOFX, 'company-1')
    expect(r[0].lifecycle).toBe('PAYABLE')
  })
})

describe('findReconciliationCandidates — janela ±15 dias', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('aplica janela ±15d em torno de OFX.date no ramo 1', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c')
    const ramo1 = findManyMock.mock.calls[0][0].where.AND[1].OR[0]
    const expectedMin = new Date(baseDebitOFX.date.getTime() - 15 * 86400000)
    const expectedMax = new Date(baseDebitOFX.date.getTime() + 15 * 86400000)
    expect(ramo1.dueDate.gte.toISOString()).toBe(expectedMin.toISOString())
    expect(ramo1.dueDate.lte.toISOString()).toBe(expectedMax.toISOString())
  })

  it('ramo 2 tem 3 fallbacks de data (paymentDate / dueDate / date)', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c')
    const ramo2 = findManyMock.mock.calls[0][0].where.AND[1].OR[1]
    expect(ramo2.OR).toHaveLength(3)
    expect(ramo2.OR[0]).toHaveProperty('paymentDate.gte')
    expect(ramo2.OR[1].paymentDate).toBe(null)
    expect(ramo2.OR[1]).toHaveProperty('dueDate.gte')
    expect(ramo2.OR[2].paymentDate).toBe(null)
    expect(ramo2.OR[2].dueDate).toBe(null)
    expect(ramo2.OR[2]).toHaveProperty('date.gte')
  })
})

describe('findReconciliationCandidates — multi-tenant (companyId)', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('aplica scope companyId via OR nas 4 relações', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c-1')
    const scope = findManyMock.mock.calls[0][0].where.AND[0]
    expect(scope.OR).toHaveLength(4)
    expect(scope.OR[0]).toEqual({ bankAccount: { companyId: 'c-1' } })
    expect(scope.OR[1]).toEqual({ supplier: { companyId: 'c-1' } })
    expect(scope.OR[2]).toEqual({ customer: { companyId: 'c-1' } })
    expect(scope.OR[3]).toEqual({ category: { companyId: 'c-1' } })
  })
})
