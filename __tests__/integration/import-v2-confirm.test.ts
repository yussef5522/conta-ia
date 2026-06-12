// Sub-fase 2D — Testes do orquestrador /v2-confirm.
//
// Cobre funções puras (validações, integridade, delta, redes de segurança).
// Cenários do plano:
//   C1.  CREATE 1 tx → delta esperado correto
//   C2.  SKIP → delta esperado 0
//   C3.  REPLACE_MANUAL TRANSFER → delta esperado 0 (saldo NÃO MUDA)
//   C4.  REPLACE_MANUAL solta → delta esperado 0
//   C5.  CONCILIATE_PAYABLE 1:1 → delta esperado ±amount
//   C6.  CONCILIATE_PAYABLE com adjustment (TOZZO) → delta esperado bate
//   C7.  expectedDelta divergente → INTERNAL_DELTA_DIVERGENCE (rollback)
//   C8.  LEDGERBAL não bate + acceptHistoricalDivergence=false → LEDGER_BAL_DIVERGENCE
//   C9.  LEDGERBAL não bate + acceptHistoricalDivergence=true → passa
//   C10. Multi-tenant: matchedTx de outra empresa → CROSS_COMPANY
//   C11. REPLACE_MANUAL pra manual já linkada → MANUAL_ALREADY_LINKED
//   C12. CONCILIATE pra Excel já EFFECTED → NOT_PAYABLE
//   C13. validateIntegrity: rawTx divergente → INTEGRITY_CHECK_FAILED
//   C14. Cenário Banrisul completo: 5 REPLACE → delta=0 (saldo NÃO MUDA)
//   C15. CONCILIATE_PAYABLE com adjustment somando errado → CONCILIATE_SUM_MISMATCH

import { describe, it, expect } from 'vitest'
import {
  validateIntegrity,
  computeExpectedDelta,
  validateDecisionAgainstCandidate,
  checkSafetyNets,
  signedTxAmount,
  signedAdjustmentAmount,
  V2ConfirmError,
  type V2ConfirmDecision,
  type CandidateForValidation,
} from '../../lib/ofx/v2-confirm'

/** Helper: captura erro e valida code. */
function expectV2Code(fn: () => void, code: string) {
  let caught: unknown
  try { fn() } catch (e) { caught = e }
  expect(caught).toBeInstanceOf(V2ConfirmError)
  expect((caught as V2ConfirmError).code).toBe(code)
}

function decision(opts: Partial<V2ConfirmDecision> & {
  action: V2ConfirmDecision['action']
}): V2ConfirmDecision {
  return {
    ofxIndex: opts.ofxIndex ?? 0,
    rawTx: opts.rawTx ?? {
      fitid: 'fitid-' + (opts.ofxIndex ?? 0),
      dedupHash: 'hash',
      date: '2026-06-12T00:00:00.000Z',
      amount: 100,
      type: 'DEBIT',
      memo: 'TX',
    },
    action: opts.action,
    matchedTxId: opts.matchedTxId,
    adjustment: opts.adjustment,
  }
}

function parsedTx(opts: { fitid: string; amount: number; type: 'CREDIT' | 'DEBIT'; memo?: string }) {
  return {
    fitid: opts.fitid,
    datePosted: new Date('2026-06-12T00:00:00.000Z'),
    amount: opts.amount,
    type: opts.type,
    memo: opts.memo ?? 'M',
  }
}

function candidate(opts: Partial<CandidateForValidation> & { id: string }): CandidateForValidation {
  return {
    id: opts.id,
    bankAccountId: opts.bankAccountId ?? 'bank-A',
    bankAccountCompanyId: opts.bankAccountCompanyId ?? 'company-A',
    supplierCompanyId: opts.supplierCompanyId ?? null,
    customerCompanyId: opts.customerCompanyId ?? null,
    categoryCompanyId: opts.categoryCompanyId ?? null,
    amount: opts.amount ?? 100,
    type: opts.type ?? 'DEBIT',
    origin: opts.origin ?? 'MANUAL',
    lifecycle: opts.lifecycle ?? 'EFFECTED',
    reconciledWithId: opts.reconciledWithId ?? null,
    transferGroupId: opts.transferGroupId ?? null,
    categoryId: opts.categoryId ?? null,
    supplierId: opts.supplierId ?? null,
  }
}

describe('Sub-fase 2D — computeExpectedDelta', () => {
  // ──────────────────────────────────────────────────────────
  it('C1. CREATE 1 tx CRED → delta +amount', () => {
    const decisions = [
      decision({ action: 'CREATE', rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'CREDIT', memo: 'X' } }),
    ]
    expect(computeExpectedDelta(decisions)).toBe(100)
  })

  it('C1b. CREATE 1 tx DEB → delta -amount', () => {
    const decisions = [
      decision({ action: 'CREATE', rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 250, type: 'DEBIT', memo: 'X' } }),
    ]
    expect(computeExpectedDelta(decisions)).toBe(-250)
  })

  it('C2. SKIP → delta 0', () => {
    const decisions = [decision({ action: 'SKIP', matchedTxId: 'sys-1' })]
    expect(computeExpectedDelta(decisions)).toBe(0)
  })

  it('C3. REPLACE_MANUAL → delta 0 (saldo NÃO MUDA — manual já contribuiu)', () => {
    const decisions = [
      decision({
        action: 'REPLACE_MANUAL', matchedTxId: 'mn-1',
        rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 7400, type: 'DEBIT', memo: 'PIX' },
      }),
    ]
    expect(computeExpectedDelta(decisions)).toBe(0)
  })

  it('C4. REPLACE_MANUAL solta → delta 0 (mesmo motivo)', () => {
    const decisions = [
      decision({
        action: 'REPLACE_MANUAL', matchedTxId: 'mn-solta',
        rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
      }),
    ]
    expect(computeExpectedDelta(decisions)).toBe(0)
  })

  it('C5. CONCILIATE_PAYABLE 1:1 → delta ±amount', () => {
    const decisions = [
      decision({
        action: 'CONCILIATE_PAYABLE', matchedTxId: 'excel-1',
        rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 198.80, type: 'DEBIT', memo: 'RM2' },
      }),
    ]
    expect(computeExpectedDelta(decisions)).toBe(-198.80)
  })

  it('C6. CONCILIATE com adjustment (TOZZO) → delta = OFX + ADJ signed', () => {
    const decisions = [
      decision({
        action: 'CONCILIATE_PAYABLE', matchedTxId: 'excel-tozzo',
        rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 1191.13, type: 'DEBIT', memo: 'TOZZO' },
        adjustment: { amount: 25.63, categoryId: 'cat-juros', sign: 'EXPENSE', description: 'Juros' },
      }),
    ]
    // OFX -1191.13 + ADJ -25.63 = -1216.76
    expect(computeExpectedDelta(decisions)).toBeCloseTo(-1216.76, 2)
  })

  it('⚠️ C14. Cenário Banrisul real: 5 REPLACE → delta 0 (saldo NÃO MUDA)', () => {
    const decisions = [
      decision({ action: 'REPLACE_MANUAL', matchedTxId: 'mn-1', rawTx: { fitid: 'f1', dedupHash: 'h', date: '2026-06-01', amount: 21000, type: 'DEBIT', memo: 'PIX' } }),
      decision({ action: 'REPLACE_MANUAL', matchedTxId: 'mn-2', rawTx: { fitid: 'f2', dedupHash: 'h', date: '2026-06-03', amount: 9100, type: 'DEBIT', memo: 'PIX' } }),
      decision({ action: 'REPLACE_MANUAL', matchedTxId: 'mn-3', rawTx: { fitid: 'f3', dedupHash: 'h', date: '2026-06-08', amount: 34000, type: 'DEBIT', memo: 'PIX' } }),
      decision({ action: 'REPLACE_MANUAL', matchedTxId: 'mn-4', rawTx: { fitid: 'f4', dedupHash: 'h', date: '2026-06-09', amount: 1100, type: 'DEBIT', memo: 'PIX' } }),
      decision({ action: 'REPLACE_MANUAL', matchedTxId: 'mn-5', rawTx: { fitid: 'f5', dedupHash: 'h', date: '2026-06-09', amount: 650, type: 'DEBIT', memo: 'PIX' } }),
    ]
    expect(computeExpectedDelta(decisions)).toBe(0)
  })

  it('helpers: signedTxAmount + signedAdjustmentAmount', () => {
    expect(signedTxAmount({ type: 'CREDIT', amount: 100 })).toBe(100)
    expect(signedTxAmount({ type: 'DEBIT', amount: 100 })).toBe(-100)
    expect(signedAdjustmentAmount({ amount: 25, sign: 'EXPENSE' })).toBe(-25)
    expect(signedAdjustmentAmount({ amount: 25, sign: 'INCOME' })).toBe(25)
  })
})

describe('Sub-fase 2D — checkSafetyNets', () => {
  // ──────────────────────────────────────────────────────────
  it('C7. expectedDelta divergente → INTERNAL_DELTA_DIVERGENCE (rollback)', () => {
    expectV2Code(
      () => checkSafetyNets({
        deltaAplicado: 100,
        expectedDelta: 200,
        balancePos: 0,
        ledgerBalAmount: 0,
        acceptHistoricalDivergence: true,
      }),
      'INTERNAL_DELTA_DIVERGENCE',
    )
  })

  it('C8. LEDGERBAL não bate + acceptHistoricalDivergence=false → LEDGER_BAL_DIVERGENCE', () => {
    expectV2Code(
      () => checkSafetyNets({
        deltaAplicado: 100,
        expectedDelta: 100,
        balancePos: 100,
        ledgerBalAmount: 50,
        acceptHistoricalDivergence: false,
      }),
      'LEDGER_BAL_DIVERGENCE',
    )
  })

  it('C9. LEDGERBAL não bate + acceptHistoricalDivergence=true → passa', () => {
    const r = checkSafetyNets({
      deltaAplicado: 100,
      expectedDelta: 100,
      balancePos: 100,
      ledgerBalAmount: 50,
      acceptHistoricalDivergence: true,
    })
    expect(r.ledgerCheck.available).toBe(true)
    expect(r.ledgerCheck.bate).toBe(false)
    expect(r.ledgerCheck.diff).toBeCloseTo(-50, 2)
  })

  it('C9b. LEDGERBAL bate → passa', () => {
    const r = checkSafetyNets({
      deltaAplicado: 0,
      expectedDelta: 0,
      balancePos: -7816.71,
      ledgerBalAmount: -7816.71,
      acceptHistoricalDivergence: false,
    })
    expect(r.ledgerCheck.bate).toBe(true)
  })

  it('LEDGERBAL ausente: available=false, sem throw', () => {
    const r = checkSafetyNets({
      deltaAplicado: 100,
      expectedDelta: 100,
      balancePos: 100,
      ledgerBalAmount: null,
      acceptHistoricalDivergence: false,
    })
    expect(r.ledgerCheck.available).toBe(false)
  })
})

describe('Sub-fase 2D — validateDecisionAgainstCandidate', () => {
  // ──────────────────────────────────────────────────────────
  it('C10. Multi-tenant: matchedTx de outra empresa → CROSS_COMPANY', () => {
    const dec = decision({
      action: 'REPLACE_MANUAL', matchedTxId: 'mn-other',
      rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
    })
    const cand = candidate({
      id: 'mn-other', bankAccountCompanyId: 'company-OUTRA',
      origin: 'MANUAL', lifecycle: 'EFFECTED',
    })
    expectV2Code(() => validateDecisionAgainstCandidate(dec, cand, 'company-A'), 'CROSS_COMPANY')
  })

  it('C11. REPLACE_MANUAL pra manual já linkada → MANUAL_ALREADY_LINKED', () => {
    const dec = decision({
      action: 'REPLACE_MANUAL', matchedTxId: 'mn-1',
      rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
    })
    const cand = candidate({
      id: 'mn-1', origin: 'MANUAL', lifecycle: 'EFFECTED',
      reconciledWithId: 'outra-tx',
    })
    expectV2Code(() => validateDecisionAgainstCandidate(dec, cand, 'company-A'), 'MANUAL_ALREADY_LINKED')
  })

  it('C12. CONCILIATE pra Excel já EFFECTED → NOT_PAYABLE', () => {
    const dec = decision({
      action: 'CONCILIATE_PAYABLE', matchedTxId: 'excel-1',
      rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
    })
    const cand = candidate({
      id: 'excel-1', origin: 'IMPORT_EXCEL', lifecycle: 'EFFECTED',
    })
    expectV2Code(() => validateDecisionAgainstCandidate(dec, cand, 'company-A'), 'NOT_PAYABLE')
  })

  it('C15. CONCILIATE adjustment soma errada → CONCILIATE_SUM_MISMATCH', () => {
    const dec = decision({
      action: 'CONCILIATE_PAYABLE', matchedTxId: 'excel-1',
      rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 150, type: 'DEBIT', memo: 'X' },
      adjustment: { amount: 25, categoryId: 'cat', sign: 'EXPENSE', description: 'Juros' },
    })
    const cand = candidate({
      id: 'excel-1', amount: 100, origin: 'IMPORT_EXCEL', lifecycle: 'PAYABLE',
    })
    expectV2Code(() => validateDecisionAgainstCandidate(dec, cand, 'company-A'), 'CONCILIATE_SUM_MISMATCH')
  })

  it('REPLACE valido → passa', () => {
    const dec = decision({
      action: 'REPLACE_MANUAL', matchedTxId: 'mn-1',
      rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 7400, type: 'DEBIT', memo: 'PIX' },
    })
    const cand = candidate({
      id: 'mn-1', amount: 7400, origin: 'MANUAL', lifecycle: 'EFFECTED', type: 'TRANSFER',
    })
    expect(() => validateDecisionAgainstCandidate(dec, cand, 'company-A')).not.toThrow()
  })

  it('CONCILIATE 1:1 valido (sem adj) → passa', () => {
    const dec = decision({
      action: 'CONCILIATE_PAYABLE', matchedTxId: 'excel-1',
      rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 198.80, type: 'DEBIT', memo: 'RM2' },
    })
    const cand = candidate({
      id: 'excel-1', amount: 198.80, origin: 'IMPORT_EXCEL', lifecycle: 'PAYABLE',
      bankAccountCompanyId: null, supplierCompanyId: 'company-A',
    })
    expect(() => validateDecisionAgainstCandidate(dec, cand, 'company-A')).not.toThrow()
  })

  it('CONCILIATE com adj soma certa (TOZZO) → passa', () => {
    // Excel 1.165,50 + ADJ 25,63 EXPENSE = 1.165,50 + |-25,63| = 1.191,13 = OFX
    const dec = decision({
      action: 'CONCILIATE_PAYABLE', matchedTxId: 'excel-tozzo',
      rawTx: { fitid: 'x', dedupHash: 'h', date: '2026-06-12', amount: 1191.13, type: 'DEBIT', memo: 'TOZZO' },
      adjustment: { amount: 25.63, categoryId: 'cat-juros', sign: 'EXPENSE', description: 'Juros' },
    })
    const cand = candidate({
      id: 'excel-tozzo', amount: 1165.50, origin: 'IMPORT_EXCEL', lifecycle: 'PAYABLE',
      bankAccountCompanyId: null, supplierCompanyId: 'company-A',
    })
    expect(() => validateDecisionAgainstCandidate(dec, cand, 'company-A')).not.toThrow()
  })

  it('candidate ausente em REPLACE → TX_NOT_FOUND', () => {
    const dec = decision({ action: 'REPLACE_MANUAL', matchedTxId: 'inexistente' })
    expectV2Code(() => validateDecisionAgainstCandidate(dec, null, 'company-A'), 'TX_NOT_FOUND')
  })
})

describe('Sub-fase 2D — validateIntegrity', () => {
  // ──────────────────────────────────────────────────────────
  it('C13. validateIntegrity: rawTx amount divergente → INTEGRITY_CHECK_FAILED', () => {
    const decisions = [
      decision({
        ofxIndex: 0, action: 'CREATE',
        rawTx: { fitid: 'fid', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
      }),
    ]
    const parsed = [parsedTx({ fitid: 'fid', amount: 200, type: 'DEBIT' })]  // amount diverge
    expectV2Code(() => validateIntegrity(decisions, parsed), 'INTEGRITY_CHECK_FAILED')
  })

  it('C13b. validateIntegrity: FITID divergente → INTEGRITY_CHECK_FAILED', () => {
    const decisions = [
      decision({
        ofxIndex: 0, action: 'CREATE',
        rawTx: { fitid: 'fid-A', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
      }),
    ]
    const parsed = [parsedTx({ fitid: 'fid-B', amount: 100, type: 'DEBIT' })]
    expectV2Code(() => validateIntegrity(decisions, parsed), 'INTEGRITY_CHECK_FAILED')
  })

  it('C13c. validateIntegrity: type divergente → INTEGRITY_CHECK_FAILED', () => {
    const decisions = [
      decision({
        ofxIndex: 0, action: 'CREATE',
        rawTx: { fitid: 'fid', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
      }),
    ]
    const parsed = [parsedTx({ fitid: 'fid', amount: 100, type: 'CREDIT' })]
    expectV2Code(() => validateIntegrity(decisions, parsed), 'INTEGRITY_CHECK_FAILED')
  })

  it('validateIntegrity: ofxIndex fora do range → INTEGRITY_CHECK_FAILED', () => {
    const decisions = [
      decision({
        ofxIndex: 5, action: 'CREATE',
        rawTx: { fitid: 'fid', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
      }),
    ]
    const parsed = [parsedTx({ fitid: 'fid', amount: 100, type: 'DEBIT' })]
    expectV2Code(() => validateIntegrity(decisions, parsed), 'INTEGRITY_CHECK_FAILED')
  })

  it('validateIntegrity: tudo coerente → passa', () => {
    const decisions = [
      decision({
        ofxIndex: 0, action: 'CREATE',
        rawTx: { fitid: 'fid', dedupHash: 'h', date: '2026-06-12', amount: 100, type: 'DEBIT', memo: 'X' },
      }),
    ]
    const parsed = [parsedTx({ fitid: 'fid', amount: 100, type: 'DEBIT' })]
    expect(() => validateIntegrity(decisions, parsed)).not.toThrow()
  })
})

describe('Sub-fase 2D — V2ConfirmError shape', () => {
  it('Code + status preservados', () => {
    const err = new V2ConfirmError('FOO', 'bar', 409, { x: 1 })
    expect(err.code).toBe('FOO')
    expect(err.message).toBe('bar')
    expect(err.status).toBe(409)
    expect(err.detail).toEqual({ x: 1 })
  })
})
