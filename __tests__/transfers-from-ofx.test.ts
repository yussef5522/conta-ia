// Testes do "Replace OFX" — Sprint 0.5 Dia 4 (refinamento).
// Cobre função pura buildOfxReplaceOperations + schema Zod + integração balance check.

import { describe, it, expect } from 'vitest'
import {
  buildOfxReplaceOperations,
  type OfxReplaceInput,
} from '@/lib/transfers/build-ofx-replace'
import { fromOfxSchema } from '@/lib/transfers/from-ofx'
import { TransferValidationError } from '@/lib/transfers/validate'
import { checkBalance } from '@/lib/balance/check'

function makeInput(overrides: Partial<OfxReplaceInput> = {}): OfxReplaceInput {
  return {
    importingAccount: {
      id: 'acc-importing',
      name: 'Sicredi Filial',
      companyId: 'comp-1',
      ...overrides.importingAccount,
    },
    existingTx: {
      id: 'tx-existing',
      bankAccountId: 'acc-existing',
      bankAccountName: 'Banrisul Matriz',
      bankAccountCompanyId: 'comp-1',
      type: 'DEBIT',
      amount: 5000,
      categoryId: null,
      notes: null,
      ...overrides.existingTx,
    },
    ofxTransaction: {
      amount: 5000,
      date: new Date('2026-05-11T12:00:00Z'),
      type: 'CREDIT',
      dedupHash: 'abc123hash',
      ...overrides.ofxTransaction,
    },
  }
}

// ============================================================
// Testes 1-2: Direção do par + dedupHash reservation
// ============================================================

describe('buildOfxReplaceOperations — direção do par', () => {
  it('Teste 1: ofx CREDIT na importing + existing DEBIT → from=existing, to=importing, dedupHash no creditTx', () => {
    // Cenário: Sicredi (importing) recebeu PIX CREDIT — Banrisul (existing) tem DEBIT correspondente
    const ops = buildOfxReplaceOperations(makeInput(), 'grp-1')
    expect(ops.fromAccountId).toBe('acc-existing') // Banrisul (origem da saída)
    expect(ops.toAccountId).toBe('acc-importing') // Sicredi (destino)
    // dedupHash vai na ponta TRANSFER da importingAccount (Sicredi = to)
    expect(ops.debitTx.dedupHash).toBeNull()
    expect(ops.creditTx.dedupHash).toBe('abc123hash')
  })

  it('Teste 2: ofx DEBIT na importing + existing CREDIT → from=importing, to=existing, dedupHash no debitTx', () => {
    const ops = buildOfxReplaceOperations(
      makeInput({
        ofxTransaction: {
          amount: 5000,
          date: new Date('2026-05-11'),
          type: 'DEBIT',
          dedupHash: 'def456hash',
        },
        existingTx: {
          id: 'tx-existing',
          bankAccountId: 'acc-existing',
          bankAccountName: 'Banrisul',
          bankAccountCompanyId: 'comp-1',
          type: 'CREDIT',
          amount: 5000,
          categoryId: null,
          notes: null,
        },
      }),
      'grp-2',
    )
    expect(ops.fromAccountId).toBe('acc-importing')
    expect(ops.toAccountId).toBe('acc-existing')
    expect(ops.debitTx.dedupHash).toBe('def456hash') // ponta importing
    expect(ops.creditTx.dedupHash).toBeNull()
  })
})

// ============================================================
// Testes 3-4: existingTxRevertDelta
// ============================================================

describe('buildOfxReplaceOperations — revert do impacto da existingTx', () => {
  it('Teste 3: existing CREDIT R$5k → revert delta = -5000 (subtrai pra anular entrada)', () => {
    const ops = buildOfxReplaceOperations(
      makeInput({
        existingTx: {
          id: 'tx-1',
          bankAccountId: 'acc-existing',
          bankAccountName: 'Banrisul',
          bankAccountCompanyId: 'comp-1',
          type: 'CREDIT',
          amount: 5000,
          categoryId: null,
          notes: null,
        },
        ofxTransaction: {
          amount: 5000,
          date: new Date('2026-05-11'),
          type: 'DEBIT', // oposto
          dedupHash: 'h1',
        },
      }),
      'grp-3',
    )
    expect(ops.existingTxRevertDelta).toBe(-5000)
  })

  it('Teste 4: existing DEBIT R$5k → revert delta = +5000 (soma pra anular saída)', () => {
    const ops = buildOfxReplaceOperations(makeInput(), 'grp-4')
    // default: existing DEBIT 5000, ofx CREDIT 5000
    expect(ops.existingTxRevertDelta).toBe(5000)
  })
})

// ============================================================
// Testes 5-8: Validações
// ============================================================

describe('buildOfxReplaceOperations — validações', () => {
  it('Teste 5: cross-empresa LANÇA TransferValidationError', () => {
    expect(() =>
      buildOfxReplaceOperations(
        makeInput({
          importingAccount: { id: 'a1', name: 'X', companyId: 'comp-A' },
          existingTx: {
            id: 't',
            bankAccountId: 'a2',
            bankAccountName: 'Y',
            bankAccountCompanyId: 'comp-B', // diferente!
            type: 'DEBIT',
            amount: 5000,
            categoryId: null,
            notes: null,
          },
        }),
        'g',
      ),
    ).toThrow(TransferValidationError)
  })

  it('Teste 6: mesma conta (importing == existing.bankAccount) LANÇA', () => {
    expect(() =>
      buildOfxReplaceOperations(
        makeInput({
          importingAccount: { id: 'acc-same', name: 'X', companyId: 'comp-1' },
          existingTx: {
            id: 't',
            bankAccountId: 'acc-same', // mesma!
            bankAccountName: 'Y',
            bankAccountCompanyId: 'comp-1',
            type: 'DEBIT',
            amount: 5000,
            categoryId: null,
            notes: null,
          },
        }),
        'g',
      ),
    ).toThrow(/diferentes/i)
  })

  it('Teste 7: tipos iguais (ambos CREDIT ou ambos DEBIT) LANÇA', () => {
    expect(() =>
      buildOfxReplaceOperations(
        makeInput({
          existingTx: {
            id: 't',
            bankAccountId: 'acc-existing',
            bankAccountName: 'Y',
            bankAccountCompanyId: 'comp-1',
            type: 'CREDIT', // ambos CREDIT!
            amount: 5000,
            categoryId: null,
            notes: null,
          },
          // default ofx é CREDIT também
        }),
        'g',
      ),
    ).toThrow(/opostos/i)
  })

  it('Teste 8: valores divergentes (>1 centavo) LANÇA', () => {
    expect(() =>
      buildOfxReplaceOperations(
        makeInput({
          ofxTransaction: {
            amount: 5000,
            date: new Date('2026-05-11'),
            type: 'CREDIT',
            dedupHash: 'h',
          },
          existingTx: {
            id: 't',
            bankAccountId: 'acc-existing',
            bankAccountName: 'Y',
            bankAccountCompanyId: 'comp-1',
            type: 'DEBIT',
            amount: 5500, // divergente
            categoryId: null,
            notes: null,
          },
        }),
        'g',
      ),
    ).toThrow(/divergem/i)
  })

  it('aceita divergência <= 1 centavo (rounding OFX)', () => {
    expect(() =>
      buildOfxReplaceOperations(
        makeInput({
          ofxTransaction: {
            amount: 5000.005,
            date: new Date('2026-05-11'),
            type: 'CREDIT',
            dedupHash: 'h',
          },
        }),
        'g',
      ),
    ).not.toThrow()
  })
})

// ============================================================
// Teste 9: Schema Zod
// ============================================================

describe('fromOfxSchema — validação do request', () => {
  it('Teste 9: aceita request bem-formada + rejeita campos missing', () => {
    const valid = {
      importingAccountId: 'ckl11111111111111111111111',
      ofxTransaction: {
        amount: 5000,
        date: '2026-05-11',
        type: 'CREDIT',
        dedupHash: 'abc',
      },
      existingTransactionId: 'ckl22222222222222222222222',
    }
    expect(() => fromOfxSchema.parse(valid)).not.toThrow()

    // sem dedupHash
    expect(() =>
      fromOfxSchema.parse({
        ...valid,
        ofxTransaction: { ...valid.ofxTransaction, dedupHash: '' },
      }),
    ).toThrow(/dedupHash/)

    // amount não positivo
    expect(() =>
      fromOfxSchema.parse({
        ...valid,
        ofxTransaction: { ...valid.ofxTransaction, amount: 0 },
      }),
    ).toThrow(/positivo/i)

    // type inválido
    expect(() =>
      fromOfxSchema.parse({
        ...valid,
        ofxTransaction: { ...valid.ofxTransaction, type: 'TRANSFER' },
      }),
    ).toThrow()
  })
})

// ============================================================
// Teste 10: Integração com checkBalance (Sprint 0.5 Dia 3)
// ============================================================

describe('Replace OFX — integração com balance check', () => {
  it('Teste 10: balanceCheck BLOQUEIA pareamento se saldo insuficiente', () => {
    // Cenário: fromAccount creditLimit=1000, saldo=-900, transfer 200
    // Saldo projetado = -900 - 200 = -1100 < -1000 (floor) → bloqueia
    const check = checkBalance({
      currentBalance: -900,
      allowNegativeBalance: true,
      creditLimit: 1000,
      amountChange: -200,
      accountName: 'Conta Teste',
    })
    expect(check.allowed).toBe(false)
    expect(check.projectedBalance).toBe(-1100)
    expect(check.effectiveFloor).toBe(-1000)
    expect(check.reason).toContain('cheque especial')
  })

  it('balance check passa quando dentro do limite', () => {
    const check = checkBalance({
      currentBalance: -900,
      allowNegativeBalance: true,
      creditLimit: 1000,
      amountChange: -50,
      accountName: 'Conta Teste',
    })
    expect(check.allowed).toBe(true)
    expect(check.projectedBalance).toBe(-950)
  })
})

// ============================================================
// Teste 11: Audit metadata preserva contexto da existingTx
// ============================================================

describe('Replace OFX — audit metadata', () => {
  it('Teste 11: metadata.deletedTxCategoryId + deletedTxNotes registrados', () => {
    const ops = buildOfxReplaceOperations(
      makeInput({
        existingTx: {
          id: 'tx-existing-with-data',
          bankAccountId: 'acc-existing',
          bankAccountName: 'Banrisul',
          bankAccountCompanyId: 'comp-1',
          type: 'DEBIT',
          amount: 5000,
          categoryId: 'cat-despesa-op',
          notes: 'Anotação importante do contador',
        },
      }),
      'grp-audit',
    )
    expect(ops.auditMetadata.source).toBe('ofx-replace')
    expect(ops.auditMetadata.deletedTransactionId).toBe('tx-existing-with-data')
    expect(ops.auditMetadata.deletedTxCategoryId).toBe('cat-despesa-op')
    expect(ops.auditMetadata.deletedTxNotes).toBe('Anotação importante do contador')
  })

  it('metadata captura IDs das contas + amount + dedupHash da OFX', () => {
    const ops = buildOfxReplaceOperations(makeInput(), 'grp-x')
    expect(ops.auditMetadata.importingAccountId).toBe('acc-importing')
    expect(ops.auditMetadata.fromAccountId).toBe('acc-existing')
    expect(ops.auditMetadata.toAccountId).toBe('acc-importing')
    expect(ops.auditMetadata.amount).toBe(5000)
    expect(ops.auditMetadata.ofxDedupHash).toBe('abc123hash')
  })

  it('metadata.deletedTxCategoryId é null quando existing não tinha categoria', () => {
    const ops = buildOfxReplaceOperations(makeInput(), 'g')
    expect(ops.auditMetadata.deletedTxCategoryId).toBeNull()
    expect(ops.auditMetadata.deletedTxNotes).toBeNull()
  })
})

// ============================================================
// Teste 12: Cross-empresa LANÇA mesmo com tipos opostos
// ============================================================

describe('Replace OFX — isolamento multi-tenant inviolável', () => {
  it('Teste 12: cross-empresa LANÇA mesmo com tipos opostos (defense in depth)', () => {
    // Tipos OPOSTOS (par válido em outros aspectos) — mas empresas diferentes
    expect(() =>
      buildOfxReplaceOperations(
        {
          importingAccount: {
            id: 'acc-banrisul-cacula-mix',
            name: 'Banrisul Cacula Mix',
            companyId: 'comp-cacula-mix',
          },
          existingTx: {
            id: 'tx-academia-3',
            bankAccountId: 'acc-banrisul-academia-3',
            bankAccountName: 'Banrisul Academia 3',
            bankAccountCompanyId: 'comp-academia-3', // OUTRA empresa!
            type: 'DEBIT',
            amount: 5000,
            categoryId: null,
            notes: null,
          },
          ofxTransaction: {
            amount: 5000,
            date: new Date('2026-05-11'),
            type: 'CREDIT', // OPOSTO de DEBIT — par válido em isolamento
            dedupHash: 'h',
          },
        },
        'g',
      ),
    ).toThrow(/mesma empresa/i)
  })

  it('mesma empresa + tudo OK → não lança', () => {
    expect(() => buildOfxReplaceOperations(makeInput(), 'g')).not.toThrow()
  })
})

// ============================================================
// Testes adicionais de robustez
// ============================================================

describe('buildOfxReplaceOperations — deltas de saldo', () => {
  it('fromBalanceDelta = -amount, toBalanceDelta = +amount, simétricos', () => {
    const ops = buildOfxReplaceOperations(makeInput(), 'g')
    expect(ops.fromBalanceDelta).toBe(-5000)
    expect(ops.toBalanceDelta).toBe(5000)
    expect(ops.fromBalanceDelta + ops.toBalanceDelta).toBe(0)
  })

  it('par TRANSFER tem mesmo transferGroupId, type=TRANSFER, status=RECONCILED', () => {
    const ops = buildOfxReplaceOperations(makeInput(), 'group-abc')
    expect(ops.debitTx.transferGroupId).toBe('group-abc')
    expect(ops.creditTx.transferGroupId).toBe('group-abc')
    expect(ops.debitTx.type).toBe('TRANSFER')
    expect(ops.creditTx.type).toBe('TRANSFER')
    expect(ops.debitTx.status).toBe('RECONCILED')
    expect(ops.creditTx.status).toBe('RECONCILED')
  })
})
