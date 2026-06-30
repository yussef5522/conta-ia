// Sprint Find-And-Match-Strict (30/06/2026) — helper único do where estrito.

import { describe, it, expect } from 'vitest'
import { buildStrictReconciliationWhere } from '@/lib/conciliacao/strict-where'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

describe('buildStrictReconciliationWhere', () => {
  it('OFX DEBIT → lifecycle PAYABLE', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
    )
    expect(w.lifecycle).toBe('PAYABLE')
    expect(w.type).toBe('DEBIT')
  })

  it('OFX CREDIT → lifecycle RECEIVABLE', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'CREDIT', bankAccountId: 'ba-stone' },
      'c-1',
    )
    expect(w.lifecycle).toBe('RECEIVABLE')
    expect(w.type).toBe('CREDIT')
  })

  it('campos estritos sempre presentes', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
    )
    expect(w.status).toBe('PENDING')
    expect(w.reconciledWithId).toBe(null)
    expect(w.reconciledFrom).toEqual({ none: {} })
    expect(w.paymentDate).toBe(null)
  })

  it('NÃO inclui filtros do RAMO 2 removido', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
    )
    // origin: { in: ... }  → REMOVIDO
    expect(w.origin).toBeUndefined()
    // ignoredAt → REMOVIDO (era RAMO 2)
    expect(w.ignoredAt).toBeUndefined()
    // cashCoded → REMOVIDO (era RAMO 2)
    expect(w.cashCoded).toBeUndefined()
  })

  it('AND[0] tem companyScope (4 relações OR)', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
    )
    const andArr = w.AND as Array<Record<string, unknown>>
    expect(Array.isArray(andArr)).toBe(true)
    const scope = andArr[0] as { OR: Array<Record<string, unknown>> }
    expect(scope.OR).toHaveLength(4)
    expect(scope.OR[0]).toEqual({ bankAccount: { companyId: 'c-1' } })
    expect(scope.OR[1]).toEqual({ supplier: { companyId: 'c-1' } })
    expect(scope.OR[2]).toEqual({ customer: { companyId: 'c-1' } })
    expect(scope.OR[3]).toEqual({ category: { companyId: 'c-1' } })
  })

  it('AND[1] tem sameAccountOrNull (null + ofx.bankAccountId)', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
    )
    const andArr = w.AND as Array<Record<string, unknown>>
    const sameAcc = andArr[1] as { OR: Array<Record<string, unknown>> }
    expect(sameAcc.OR).toEqual([
      { bankAccountId: null },
      { bankAccountId: 'ba-stone' },
    ])
  })

  it('janela aplicada em dueDate quando fornecida', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
      { gte: utc(2026, 5, 15), lte: utc(2026, 6, 15) },
    )
    expect(w.dueDate).toEqual({ gte: utc(2026, 5, 15), lte: utc(2026, 6, 15) })
  })

  it('SEM janela → dueDate não aparece (modo "all")', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
    )
    expect(w.dueDate).toBeUndefined()
  })

  it('idempotente: 2 chamadas mesmas args = mesma estrutura', () => {
    const a = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
      { gte: utc(2026, 5, 15), lte: utc(2026, 6, 15) },
    )
    const b = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'c-1',
      { gte: utc(2026, 5, 15), lte: utc(2026, 6, 15) },
    )
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('cenário Yussef — CORSAN -83,03 Stone', () => {
  it('CORSAN Stone gera where que NUNCA puxa caixa loja', () => {
    const w = buildStrictReconciliationWhere(
      { type: 'DEBIT', bankAccountId: 'ba-stone' },
      'cacula',
      { gte: utc(2026, 5, 14), lte: utc(2026, 6, 14) },
    )
    // lifecycle estrito = PAYABLE; caixa loja tx são EFFECTED.
    expect(w.lifecycle).toBe('PAYABLE')
    // sameAccountOrNull bloqueia conta caixa loja (id diferente).
    const sameAcc = (w.AND as Array<Record<string, unknown>>)[1] as {
      OR: Array<{ bankAccountId: string | null }>
    }
    expect(sameAcc.OR.map((o) => o.bankAccountId)).toEqual([null, 'ba-stone'])
    expect(sameAcc.OR.map((o) => o.bankAccountId)).not.toContain('ba-caixa-loja')
  })
})
