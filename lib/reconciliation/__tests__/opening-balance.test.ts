import { describe, it, expect } from 'vitest'
import { isOpeningBalanceMemo } from '../opening-balance'
import { reconcileStatement } from '../reconcile-statement'
import type { DbBankTransaction, StatementLine } from '../types'

const D = (s: string) => new Date(`${s}T12:00:00Z`)
const dtAsOf = D('2026-06-12')

describe('isOpeningBalanceMemo', () => {
  it('detecta "SALDO INICIAL"', () => {
    expect(isOpeningBalanceMemo('SALDO INICIAL 01/06/2026 (conforme extrato Banrisul)')).toBe(true)
  })
  it('detecta "SALDO DE ABERTURA"', () => {
    expect(isOpeningBalanceMemo('SALDO DE ABERTURA / CONCILIACAO BANRISUL')).toBe(true)
  })
  it('detecta variações case e whitespace', () => {
    expect(isOpeningBalanceMemo('  saldo   inicial  ')).toBe(true)
  })
  it('NÃO detecta descrições legítimas que contenham "saldo"', () => {
    expect(isOpeningBalanceMemo('BANRI A VISTA')).toBe(false)
    expect(isOpeningBalanceMemo('PIX ENVIADO')).toBe(false)
    expect(isOpeningBalanceMemo('TARIFA SALDO ZERADO')).toBe(false)
  })
  it('null/empty retorna false', () => {
    expect(isOpeningBalanceMemo('')).toBe(false)
    expect(isOpeningBalanceMemo(null)).toBe(false)
    expect(isOpeningBalanceMemo(undefined)).toBe(false)
  })
})

describe('reconcileStatement — SALDO_ABERTURA NÃO vira orphan', () => {
  it('tx com memo "SALDO INICIAL" não aparece como orphan mesmo sem flag', () => {
    const dbs: DbBankTransaction[] = [
      { id: 'tx-abertura', date: D('2026-05-31'), signedAmount: -11373.26, memo: 'SALDO INICIAL 01/06/2026 (conforme extrato Banrisul)', lifecycle: 'EFFECTED', type: 'DEBIT' },
      { id: 'tx-real', date: D('2026-06-01'), signedAmount: 100, memo: 'BANRI A VISTA', lifecycle: 'EFFECTED', type: 'CREDIT', fitid: 'aaa111' },
    ]
    const stmt: StatementLine[] = [
      { datePosted: D('2026-06-01'), signedAmount: 100, memo: 'BANRI A VISTA', fitid: 'aaa111' },
    ]
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].dbTx.id).toBe('tx-real')
    expect(r.orphans).toHaveLength(0) // abertura NÃO é orphan
    expect(r.missing).toHaveLength(0)
  })

  it('flag excludeFromReconciliation=true também filtra (sem precisar bater no memo)', () => {
    const dbs: DbBankTransaction[] = [
      { id: 'tx-ajuste', date: D('2026-05-31'), signedAmount: -1000, memo: 'AJUSTE CONTABIL XYZ', lifecycle: 'EFFECTED', type: 'DEBIT', excludeFromReconciliation: true },
    ]
    const stmt: StatementLine[] = []
    const r = reconcileStatement(stmt, dbs, dtAsOf)
    expect(r.orphans).toHaveLength(0)
  })
})
