// Sprint Trava-Permanente (16/06/2026) — testes da regra 5.
//
// 4 camadas de defesa:
//   1) validateLifecycleState — função pura JS/TS
//   2) Excel confirm — quando EFFECTED+sem-bank → seta cashCoded=true
//   3) Postgres CHECK constraint effected_needs_bank_or_cash_or_reconcile
//   4) Monitor countOrphanEffected — pra detectar drift
//
// Cobre os 3 casos válidos + o caso proibido + 2 casos clássicos PAYABLE.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateLifecycleState } from '@/lib/lifecycle'

const RECON_ID = 'ckxxxxxxxxxxxxxxxxxxxxxx'
const BANK_ID = 'ckbankxxxxxxxxxxxxxxxxxx'

// ============================================================================
// (a) Testes da regra 5 em validateLifecycleState
// ============================================================================
describe('Sprint Trava-Permanente — validateLifecycleState regra 5', () => {
  it('EFFECTED + bankAccountId NOT NULL → válido', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'EFFECTED',
        status: 'RECONCILED',
        paymentDate: new Date(),
        dueDate: null,
        bankAccountId: BANK_ID,
        cashCoded: false,
        reconciledWithId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('EFFECTED + bankAccountId NULL + cashCoded=true → válido (despesa em dinheiro)', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'EFFECTED',
        status: 'RECONCILED',
        paymentDate: new Date(),
        dueDate: null,
        bankAccountId: null,
        cashCoded: true,
        reconciledWithId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('EFFECTED + bankAccountId NULL + reconciledWithId set → válido (par OFX tem banco)', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'EFFECTED',
        status: 'RECONCILED',
        paymentDate: new Date(),
        dueDate: null,
        bankAccountId: null,
        cashCoded: false,
        reconciledWithId: RECON_ID,
      }),
    ).toEqual({ valid: true })
  })

  it('🚨 EFFECTED + bankNull + !cashCoded + !reconciled → BLOQUEADO (estado órfão)', () => {
    const r = validateLifecycleState({
      lifecycle: 'EFFECTED',
      status: 'RECONCILED',
      paymentDate: new Date(),
      dueDate: null,
      bankAccountId: null,
      cashCoded: false,
      reconciledWithId: null,
    })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/EFFECTED exige bankAccountId/)
  })

  it('🚨 EFFECTED com cashCoded omitido (undefined) é tratado como false → BLOQUEADO', () => {
    const r = validateLifecycleState({
      lifecycle: 'EFFECTED',
      status: 'RECONCILED',
      paymentDate: new Date(),
      dueDate: null,
      bankAccountId: null,
      // cashCoded omitido
      // reconciledWithId omitido
    })
    expect(r.valid).toBe(false)
  })

  it('🚨 EFFECTED + bankAccountId = string vazia → BLOQUEADO (não é banco válido)', () => {
    const r = validateLifecycleState({
      lifecycle: 'EFFECTED',
      status: 'RECONCILED',
      paymentDate: new Date(),
      dueDate: null,
      bankAccountId: '',
      cashCoded: false,
      reconciledWithId: null,
    })
    expect(r.valid).toBe(false)
  })

  it('🚨 EFFECTED + reconciledWithId = string vazia → BLOQUEADO (não é conciliação válida)', () => {
    const r = validateLifecycleState({
      lifecycle: 'EFFECTED',
      status: 'RECONCILED',
      paymentDate: new Date(),
      dueDate: null,
      bankAccountId: null,
      cashCoded: false,
      reconciledWithId: '',
    })
    expect(r.valid).toBe(false)
  })
})

// ============================================================================
// Regressão das regras 1-4 (PAYABLE/RECEIVABLE) — não devem ter quebrado
// ============================================================================
describe('Sprint Trava-Permanente — regressão regras 1-4', () => {
  it('PAYABLE com paymentDate preenchido → inválido (regra 1)', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'PAYABLE',
        status: 'PENDING',
        paymentDate: new Date(),
        dueDate: new Date(),
        bankAccountId: null,
      }).valid,
    ).toBe(false)
  })

  it('PAYABLE sem dueDate → inválido (regra 2)', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'PAYABLE',
        status: 'PENDING',
        paymentDate: null,
        dueDate: null,
        bankAccountId: null,
      }).valid,
    ).toBe(false)
  })

  it('PAYABLE com dueDate + sem paymentDate + bankNull → válido (regra 4)', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'PAYABLE',
        status: 'PENDING',
        paymentDate: null,
        dueDate: new Date(),
        bankAccountId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('RECEIVABLE com dueDate + sem paymentDate + bankNull → válido', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'RECEIVABLE',
        status: 'PENDING',
        paymentDate: null,
        dueDate: new Date(),
        bankAccountId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('EFFECTED com paymentDate null + bank set → válido (regra 3 — competência sem pagamento)', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'EFFECTED',
        status: 'PENDING',
        paymentDate: null,
        dueDate: null,
        bankAccountId: BANK_ID,
      }),
    ).toEqual({ valid: true })
  })
})

// ============================================================================
// (b) Migration CHECK constraint — presença no arquivo
// ============================================================================
describe('Sprint Trava-Permanente — Postgres CHECK constraint', () => {
  const PATH = join(
    __dirname,
    '..',
    'prisma/migrations/20260622000000_effected_needs_bank_or_cash_or_reconcile/migration.sql',
  )
  const sql = readFileSync(PATH, 'utf-8')

  it('nome da constraint = effected_needs_bank_or_cash_or_reconcile', () => {
    expect(sql).toMatch(/effected_needs_bank_or_cash_or_reconcile/)
  })

  it('expressão cobre as 3 alternativas + escape TRANSFER', () => {
    expect(sql).toMatch(/lifecycle != 'EFFECTED'/)
    expect(sql).toMatch(/"bankAccountId" IS NOT NULL/)
    expect(sql).toMatch(/"cashCoded" = true/)
    expect(sql).toMatch(/"reconciledWithId" IS NOT NULL/)
    expect(sql).toMatch(/type = 'TRANSFER'/)
  })
})

// ============================================================================
// (c) Importador Excel — confirm corrigido
// ============================================================================
describe('Sprint Trava-Permanente — Excel confirm seta cashCoded em EFFECTED órfão', () => {
  const PATH = join(
    __dirname,
    '..',
    'app/api/empresas/[id]/contas-pagar/import/[batchId]/confirm/route.ts',
  )
  const code = readFileSync(PATH, 'utf-8')

  it('declara isCashCodedFromOrphanEffected = isPaid', () => {
    expect(code).toMatch(/isCashCodedFromOrphanEffected\s*=\s*isPaid/)
  })

  it('passa cashCoded + cashCodedAt no transaction.create', () => {
    expect(code).toMatch(/cashCoded:\s*isCashCodedFromOrphanEffected/)
    expect(code).toMatch(/cashCodedAt:\s*isCashCodedFromOrphanEffected\s*\?\s*new Date\(\)\s*:\s*null/)
  })

  it('preserva comentário com referência à regra 5', () => {
    expect(code).toMatch(/regra 5/)
    expect(code).toMatch(/effected_needs_bank_or_cash_or_reconcile/)
  })
})

// ============================================================================
// (d) Monitor — função de saúde countOrphanEffected
// ============================================================================
describe('Sprint Trava-Permanente — monitor countOrphanEffected', () => {
  const PATH = join(__dirname, '..', 'lib/lifecycle/orphan-monitor.ts')
  const code = readFileSync(PATH, 'utf-8')

  it('exporta countOrphanEffected e listOrphanEffected', () => {
    expect(code).toMatch(/export async function countOrphanEffected/)
    expect(code).toMatch(/export async function listOrphanEffected/)
  })

  it('filtros corretos: EFFECTED + bankNull + !cashCoded + !reconciled + !TRANSFER', () => {
    expect(code).toMatch(/lifecycle:\s*'EFFECTED'/)
    expect(code).toMatch(/bankAccountId:\s*null/)
    expect(code).toMatch(/cashCoded:\s*false/)
    expect(code).toMatch(/reconciledWithId:\s*null/)
    expect(code).toMatch(/type:\s*\{\s*not:\s*'TRANSFER'/)
  })

  it('scope por companyId via OR (bankAccount/category/supplier) — pega tx sem bank', () => {
    expect(code).toMatch(/bankAccount:\s*\{\s*companyId\s*\}/)
    expect(code).toMatch(/category:\s*\{\s*companyId\s*\}/)
    expect(code).toMatch(/supplier:\s*\{\s*companyId\s*\}/)
  })
})
