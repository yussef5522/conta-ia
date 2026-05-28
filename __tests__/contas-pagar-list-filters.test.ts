// Sprint 5.0.3.0a — Tests do buildPayableListWhere/OrderBy.
//
// Cobre multi-tenant guard (5 ORs), filtros aplicados condicionalmente,
// período no campo escolhido, busca textual compose com AND, e parse Zod.

import { describe, it, expect } from 'vitest'
import {
  buildPayableListWhere,
  buildPayableOrderBy,
  listPayableSchema,
} from '@/lib/contas-pagar/list-filters'

const COMPANY = 'cmpcompanycuid000000000'
const NOW = new Date('2026-05-27T12:00:00.000Z')

function parse(qs: Record<string, string>) {
  return listPayableSchema.parse({ empresaId: COMPANY, ...qs })
}

describe('buildPayableListWhere — multi-tenant guard + lifecycle scope', () => {
  it('sem filtros: AND[mt, lifecycleScope] (bug-fix 28/05/2026)', () => {
    const where = buildPayableListWhere(parse({}), NOW)
    // Bug-fix 28/05: lifecycle não está mais top-level.
    // Estrutura nova: AND[0]=multi-tenant OR, AND[1]=lifecycle scope OR
    expect(where.lifecycle).toBeUndefined()
    expect(Array.isArray(where.AND)).toBe(true)
    const and = where.AND as Array<Record<string, unknown>>
    expect(and).toHaveLength(2)
    // AND[0] = multi-tenant OR (5 paths)
    const mtOR = and[0].OR as Array<Record<string, unknown>>
    expect(mtOR).toHaveLength(5)
    expect(mtOR).toContainEqual({ bankAccount: { companyId: COMPANY } })
    expect(mtOR).toContainEqual({ supplier: { companyId: COMPANY } })
    expect(mtOR).toContainEqual({ employee: { companyId: COMPANY } })
    expect(mtOR).toContainEqual({ category: { companyId: COMPANY } })
    // AND[1] = lifecycle scope (PAYABLE OR EFFECTED-com-dueDate)
    const lifecycleOR = and[1].OR as Array<Record<string, unknown>>
    expect(lifecycleOR).toHaveLength(2)
    expect(lifecycleOR[0]).toEqual({ lifecycle: 'PAYABLE' })
    expect(lifecycleOR[1]).toMatchObject({
      lifecycle: 'EFFECTED',
      type: 'DEBIT',
      reconciledWithId: null,
    })
  })

  it('busca textual adiciona AND[2] sem destruir multi-tenant/lifecycle', () => {
    const where = buildPayableListWhere(parse({ q: 'gestra' }), NOW)
    expect(where.OR).toBeUndefined()
    expect(Array.isArray(where.AND)).toBe(true)
    const and = where.AND as Array<Record<string, unknown>>
    expect(and).toHaveLength(3)
    // AND[0] = OR multi-tenant
    expect((and[0].OR as unknown[]).length).toBe(5)
    // AND[1] = lifecycle scope OR
    expect((and[1].OR as unknown[]).length).toBe(2)
    // AND[2] = busca textual
    expect(Array.isArray(and[2].OR)).toBe(true)
  })
})

describe('buildPayableListWhere — filtros condicionais', () => {
  it('status PENDING aplica filtro', () => {
    expect(
      buildPayableListWhere(parse({ status: 'PENDING' }), NOW).status,
    ).toBe('PENDING')
  })

  it('status TODOS NÃO aplica filtro (omite o campo)', () => {
    const where = buildPayableListWhere(parse({ status: 'TODOS' }), NOW)
    expect(where.status).toBeUndefined()
  })

  it('vencidasOnly força status=PENDING + dueDate<now', () => {
    const where = buildPayableListWhere(parse({ vencidasOnly: 'true' }), NOW)
    expect(where.status).toBe('PENDING')
    expect(where.dueDate).toEqual({ lt: NOW })
  })

  it('período no campo padrão (dueDate)', () => {
    const where = buildPayableListWhere(
      parse({ dataDe: '2026-03-01', dataAte: '2026-03-31' }),
      NOW,
    )
    expect(where.dueDate).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lte: new Date('2026-03-31T23:59:59.999Z'),
    })
  })

  it('período em paymentDate quando dataField=paymentDate', () => {
    const where = buildPayableListWhere(
      parse({
        dataDe: '2026-03-01',
        dataAte: '2026-03-31',
        dataField: 'paymentDate',
      }),
      NOW,
    )
    expect(where.paymentDate).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lte: new Date('2026-03-31T23:59:59.999Z'),
    })
    expect(where.dueDate).toBeUndefined()
  })

  it('só dataDe (sem dataAte): só gte', () => {
    const where = buildPayableListWhere(parse({ dataDe: '2026-03-01' }), NOW)
    expect(where.dueDate).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
    })
  })

  it('multi-select supplierIds: array virou in[]', () => {
    const where = buildPayableListWhere(
      parse({ supplierIds: 'cmp1,cmp2,cmp3' }),
      NOW,
    )
    expect(where.supplierId).toEqual({ in: ['cmp1', 'cmp2', 'cmp3'] })
  })

  it('multi-select com 1 item só', () => {
    const where = buildPayableListWhere(
      parse({ categoryIds: 'catX' }),
      NOW,
    )
    expect(where.categoryId).toEqual({ in: ['catX'] })
  })

  it('multi-select vazio é ignorado', () => {
    const where = buildPayableListWhere(parse({ supplierIds: '' }), NOW)
    expect(where.supplierId).toBeUndefined()
  })

  it('valor range — só min', () => {
    const where = buildPayableListWhere(parse({ valorMin: '100' }), NOW)
    expect(where.amount).toEqual({ gte: 100 })
  })

  it('valor range — min + max', () => {
    const where = buildPayableListWhere(
      parse({ valorMin: '100', valorMax: '500' }),
      NOW,
    )
    expect(where.amount).toEqual({ gte: 100, lte: 500 })
  })

  it('busca textual normaliza com trim — vazia mantém AND[mt, lifecycle]', () => {
    const where = buildPayableListWhere(parse({ q: '   ' }), NOW)
    expect(where.OR).toBeUndefined() // tudo agora dentro de AND
    expect(Array.isArray(where.AND)).toBe(true)
    const and = where.AND as Array<Record<string, unknown>>
    // q vazia NÃO adiciona AND[2] de busca — mantém só [mt, lifecycle]
    expect(and).toHaveLength(2)
  })
})

describe('buildPayableOrderBy', () => {
  it('default dueDate asc + tiebreaker createdAt desc', () => {
    const order = buildPayableOrderBy(parse({}))
    expect(order).toEqual([
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ])
  })

  it('sort por amount desc', () => {
    const order = buildPayableOrderBy(
      parse({ sortBy: 'amount', sortDir: 'desc' }),
    )
    expect(order[0]).toEqual({ amount: 'desc' })
  })

  it('tiebreaker estável presente em todos os sorts', () => {
    for (const sortBy of [
      'dueDate',
      'paymentDate',
      'amount',
      'description',
      'createdAt',
    ] as const) {
      const order = buildPayableOrderBy(parse({ sortBy }))
      expect(order[1]).toEqual({ createdAt: 'desc' })
    }
  })
})

describe('listPayableSchema — parse + coerce + defaults', () => {
  it('strings de search params são coerced pros tipos corretos', () => {
    const parsed = listPayableSchema.parse({
      empresaId: COMPANY,
      page: '3',
      limit: '100',
      valorMin: '99.50',
      vencidasOnly: 'true',
    })
    expect(parsed.page).toBe(3)
    expect(parsed.limit).toBe(100)
    expect(parsed.valorMin).toBe(99.5)
    expect(parsed.vencidasOnly).toBe(true)
  })

  it('limit > 500 é rejeitado (proteção contra abuse)', () => {
    expect(() =>
      listPayableSchema.parse({ empresaId: COMPANY, limit: 1000 }),
    ).toThrow()
  })

  it('page < 1 é rejeitado', () => {
    expect(() =>
      listPayableSchema.parse({ empresaId: COMPANY, page: 0 }),
    ).toThrow()
  })

  it('sortBy/sortDir/dataField defaults aplicam', () => {
    const parsed = listPayableSchema.parse({ empresaId: COMPANY })
    expect(parsed.sortBy).toBe('dueDate')
    expect(parsed.sortDir).toBe('asc')
    expect(parsed.dataField).toBe('dueDate')
  })
})
