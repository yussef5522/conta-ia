// ⚠️ TESTES DE ISOLAMENTO MULTI-TENANT — SPRINT 0.5 DIA 3 ⚠️
//
// Conta IA é SaaS multi-tenant. Dados de uma empresa NUNCA podem vazar pra
// outra, mesmo dentro do mesmo user (User pode ter N Companies).
//
// Esses testes garantem que:
//   1. Os query builders SEMPRE incluem o filtro por companyId/bankAccountId
//   2. As funções puras LANÇAM se receberem identificador vazio
//   3. Mix de transações de empresas distintas é detectável (rastreabilidade
//      via metadata.companyId no result)

import { describe, it, expect } from 'vitest'
import {
  buildConsolidatedCashflowWhere,
  buildByAccountCashflowWhere,
} from '@/lib/cashflow/query'
import { calculateConsolidatedCashflow } from '@/lib/cashflow/consolidated'
import { calculateByAccountCashflow } from '@/lib/cashflow/by-account'
import { prepareBalanceTransactions } from '@/lib/balance/prepare'

const PERIODO = {
  startDate: new Date('2026-05-01'),
  endDate: new Date('2026-05-31'),
}

describe('Query builders — contrato multi-tenant (Camada 1: SQL filter)', () => {
  it('buildConsolidatedCashflowWhere SEMPRE inclui bankAccount.companyId', () => {
    const where = buildConsolidatedCashflowWhere('comp-X', PERIODO)
    expect(where.bankAccount).toEqual({ companyId: 'comp-X' })
  })

  it('buildConsolidatedCashflowWhere SEMPRE exclui TRANSFER', () => {
    const where = buildConsolidatedCashflowWhere('comp-X', PERIODO)
    expect(where.type).toEqual({ not: 'TRANSFER' })
  })

  it('buildConsolidatedCashflowWhere inclui filtro de período', () => {
    const where = buildConsolidatedCashflowWhere('comp-X', PERIODO)
    expect(where.date).toEqual({ gte: PERIODO.startDate, lte: PERIODO.endDate })
  })

  it('buildConsolidatedCashflowWhere LANÇA se companyId vazio', () => {
    expect(() =>
      buildConsolidatedCashflowWhere('', PERIODO),
    ).toThrow(/multi-tenant/i)
  })

  it('buildByAccountCashflowWhere usa bankAccountId direto (não filtra companyId)', () => {
    const where = buildByAccountCashflowWhere('acc-1', PERIODO)
    expect(where.bankAccountId).toBe('acc-1')
    expect(where.bankAccount).toBeUndefined()
  })

  it('buildByAccountCashflowWhere NÃO filtra TRANSFER (incluído por design)', () => {
    const where = buildByAccountCashflowWhere('acc-1', PERIODO)
    expect(where.type).toBeUndefined()
  })

  it('buildByAccountCashflowWhere LANÇA se bankAccountId vazio', () => {
    expect(() => buildByAccountCashflowWhere('', PERIODO)).toThrow(/bankAccountId/i)
  })

  it('builders LANÇAM se startDate > endDate (sanidade)', () => {
    const bad = {
      startDate: new Date('2026-05-31'),
      endDate: new Date('2026-05-01'),
    }
    expect(() => buildConsolidatedCashflowWhere('comp-X', bad)).toThrow(/startDate/i)
    expect(() => buildByAccountCashflowWhere('acc-1', bad)).toThrow(/startDate/i)
  })
})

describe('Funções puras — guards de input vazio (Camada 2)', () => {
  it('calculateConsolidatedCashflow LANÇA se companyId vazio', () => {
    expect(() =>
      calculateConsolidatedCashflow(
        [],
        { startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31'), groupBy: 'day' },
        '',
      ),
    ).toThrow(/multi-tenant/i)
  })

  it('calculateByAccountCashflow LANÇA se bankAccountId vazio', () => {
    expect(() =>
      calculateByAccountCashflow(
        [],
        { startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31'), groupBy: 'day' },
        '',
      ),
    ).toThrow(/bankAccountId/i)
  })

  it('prepareBalanceTransactions LANÇA se targetAccountId vazio', () => {
    expect(() => prepareBalanceTransactions([], '')).toThrow(/multi-tenant/i)
  })

  it('prepareBalanceTransactions FILTRA transações de outras contas', () => {
    // Defesa em profundidade: mesmo se rota bugada passar dados de outra conta,
    // a função pura descarta o que não bate com targetAccountId.
    const r = prepareBalanceTransactions(
      [
        {
          id: 'mine',
          date: new Date('2026-05-15'),
          createdAt: new Date('2026-05-15'),
          type: 'CREDIT',
          amount: 100,
          bankAccountId: 'acc-target',
          transferGroupId: null,
        },
        {
          id: 'leak',
          date: new Date('2026-05-15'),
          createdAt: new Date('2026-05-15'),
          type: 'CREDIT',
          amount: 99999, // empresa diferente — não deve vazar
          bankAccountId: 'acc-OTHER-COMPANY',
          transferGroupId: null,
        },
      ],
      'acc-target',
    )
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('mine')
    expect(r[0].signedAmount).toBe(100)
  })
})

describe('Rastreabilidade: results carregam o identificador (Camada 3)', () => {
  it('calculateConsolidatedCashflow.companyId === input companyId', () => {
    const r = calculateConsolidatedCashflow(
      [],
      { startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31'), groupBy: 'day' },
      'comp-academia-7',
    )
    expect(r.companyId).toBe('comp-academia-7')
  })

  it('calculateByAccountCashflow.bankAccountId === input bankAccountId', () => {
    const r = calculateByAccountCashflow(
      [],
      { startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31'), groupBy: 'day' },
      'acc-banrisul-cacula-mix',
    )
    expect(r.bankAccountId).toBe('acc-banrisul-cacula-mix')
  })
})
