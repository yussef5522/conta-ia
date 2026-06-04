// Sprint A-effected — testes do reconcileTransactions + undoReconciliation.
//
// Cobre:
//   - CLASSIC: PAYABLE → EFFECTED + link (preserva comportamento Sprint 4.0.2)
//   - ORPHAN: EFFECTED + sem link → cria link + backfill cooperativo OFX
//   - Validações: valor exato, janela 5d, direção, multi-tenant
//   - Undo CLASSIC restaura lifecycle/dates
//   - Undo ORPHAN restaura categoryId/supplierId do OFX via audit metadata

import { describe, it, expect, beforeEach, vi } from 'vitest'

const findUniqueMock = vi.fn()
const updateMock = vi.fn()
const findFirstMock = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    auditLog: { findFirst: (...args: unknown[]) => findFirstMock(...args) },
    $transaction: async (fn: (trx: unknown) => unknown) =>
      fn({
        transaction: {
          update: (...args: unknown[]) => updateMock(...args),
        },
      }),
  },
}))

const logAuditMock = vi.fn()
vi.mock('@/lib/audit', () => ({ logAudit: (...args: unknown[]) => logAuditMock(...args) }))

import {
  reconcileTransactions,
  undoReconciliation,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

const FAKE_COMPANY = 'cmp-cacula'
const FAKE_BANK = 'ba-banrisul'

const fakeCtx = {
  company: { id: FAKE_COMPANY },
  requirePermission: vi.fn(),
} as unknown as Parameters<typeof reconcileTransactions>[1]

const baseOFX = {
  id: 'ofx-nestle',
  lifecycle: 'EFFECTED',
  reconciledWithId: null,
  bankAccountId: FAKE_BANK,
  bankAccount: { companyId: FAKE_COMPANY },
  description: 'NESTLE BRASIL LTDA - Pagamento',
  amount: 105.86,
  type: 'DEBIT',
  date: utc(2026, 5, 3),
  categoryId: null,
  supplierId: null,
}

const baseCandidatePayable = {
  id: 'pay-nestle',
  lifecycle: 'PAYABLE',
  reconciledWithId: null,
  bankAccountId: null,
  bankAccount: null,
  supplier: { companyId: FAKE_COMPANY },
  customer: null,
  category: null,
  description: 'Nestle Brasil Ltda',
  amount: 105.86,
  type: 'DEBIT',
  date: utc(2026, 5, 3),
  dueDate: utc(2026, 5, 3),
  paymentDate: null,
  status: 'PENDING',
  origin: 'IMPORT_EXCEL',
  categoryId: 'cat-alimentacao',
  supplierId: 'sup-nestle',
}

const baseCandidateOrphan = {
  ...baseCandidatePayable,
  id: 'orphan-nestle',
  lifecycle: 'EFFECTED',
  paymentDate: utc(2026, 5, 3),
  status: 'RECONCILED', // estado inconsistente histórico
}

function mockBothFinds(ofx: typeof baseOFX, candidate: typeof baseCandidatePayable) {
  findUniqueMock.mockReset()
  findUniqueMock.mockResolvedValueOnce(ofx)
  findUniqueMock.mockResolvedValueOnce(candidate)
}

beforeEach(() => {
  findUniqueMock.mockReset()
  updateMock.mockReset()
  findFirstMock.mockReset()
  logAuditMock.mockReset()
  ;(fakeCtx as { requirePermission: ReturnType<typeof vi.fn> }).requirePermission.mockReset()
  updateMock.mockImplementation(({ data, where }: { data: Record<string, unknown>; where: { id: string } }) =>
    Promise.resolve({ id: where.id, ...data }),
  )
})

// ============================================================================
// CLASSIC MODE — Sprint 4.0.2 (regressão)
// ============================================================================
describe('reconcileTransactions — CLASSIC (PAYABLE → EFFECTED)', () => {
  it('PAYABLE pendente vira EFFECTED + link + paymentDate=OFX.date', async () => {
    mockBothFinds(baseOFX, baseCandidatePayable)

    await reconcileTransactions(
      { ofxTransactionId: 'ofx-nestle', candidateId: 'pay-nestle' },
      fakeCtx,
    )

    // Update no candidato com lifecycle=EFFECTED, paymentDate=OFX.date, link
    const candidateCall = updateMock.mock.calls.find(
      (c) => c[0].where.id === 'pay-nestle',
    )
    expect(candidateCall![0].data).toMatchObject({
      lifecycle: 'EFFECTED',
      paymentDate: baseOFX.date,
      date: baseOFX.date,
      bankAccountId: FAKE_BANK,
      reconciledWithId: 'ofx-nestle',
      status: 'RECONCILED',
    })

    // Audit com mode=CLASSIC
    expect(logAuditMock).toHaveBeenCalled()
    const auditEntry = logAuditMock.mock.calls[0][1]
    expect(auditEntry.metadata.mode).toBe('CLASSIC')
  })
})

// ============================================================================
// ORPHAN MODE — Sprint A-effected (NOVO)
// ============================================================================
describe('reconcileTransactions — ORPHAN (EFFECTED órfão → link + cooperativo)', () => {
  it('EFFECTED órfão Excel: cria SÓ link + status=RECONCILED', async () => {
    mockBothFinds(baseOFX, baseCandidateOrphan)

    await reconcileTransactions(
      { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
      fakeCtx,
    )

    const candidateCall = updateMock.mock.calls.find(
      (c) => c[0].where.id === 'orphan-nestle',
    )
    expect(candidateCall![0].data).toMatchObject({
      reconciledWithId: 'ofx-nestle',
      status: 'RECONCILED',
    })
    // Crítico: NÃO toca em lifecycle, paymentDate, date, bankAccountId
    expect(candidateCall![0].data).not.toHaveProperty('lifecycle')
    expect(candidateCall![0].data).not.toHaveProperty('paymentDate')
    expect(candidateCall![0].data).not.toHaveProperty('date')
    expect(candidateCall![0].data).not.toHaveProperty('bankAccountId')
  })

  it('OFX sem categoryId/supplierId → BACKFILL cooperativo da Excel', async () => {
    mockBothFinds(baseOFX, baseCandidateOrphan) // OFX null cat/sup; Excel com ambos

    await reconcileTransactions(
      { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
      fakeCtx,
    )

    const ofxCall = updateMock.mock.calls.find((c) => c[0].where.id === 'ofx-nestle')
    expect(ofxCall).toBeDefined()
    expect(ofxCall![0].data).toEqual({
      categoryId: 'cat-alimentacao',
      supplierId: 'sup-nestle',
    })
  })

  it('OFX JÁ TEM categoryId → NÃO sobrescreve (OFX é fonte de verdade)', async () => {
    const ofxComCategoria = { ...baseOFX, categoryId: 'cat-existente' }
    mockBothFinds(ofxComCategoria, baseCandidateOrphan)

    await reconcileTransactions(
      { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
      fakeCtx,
    )

    const ofxCall = updateMock.mock.calls.find((c) => c[0].where.id === 'ofx-nestle')
    // Só backfilla supplier (categoria já existe no OFX)
    if (ofxCall) {
      expect(ofxCall[0].data).not.toHaveProperty('categoryId')
      expect(ofxCall[0].data).toEqual({ supplierId: 'sup-nestle' })
    }
  })

  it('OFX JÁ TEM ambos → SEM update no OFX (zero side-effect)', async () => {
    const ofxCompleto = { ...baseOFX, categoryId: 'cat-x', supplierId: 'sup-x' }
    mockBothFinds(ofxCompleto, baseCandidateOrphan)

    await reconcileTransactions(
      { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
      fakeCtx,
    )

    const ofxCall = updateMock.mock.calls.find((c) => c[0].where.id === 'ofx-nestle')
    expect(ofxCall).toBeUndefined() // Nenhum update no OFX
  })

  it('audit metadata salva ofxBefore + ofxBackfilled + candidateStatusBefore (pra undo)', async () => {
    mockBothFinds(baseOFX, baseCandidateOrphan)

    await reconcileTransactions(
      { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
      fakeCtx,
    )

    const auditEntry = logAuditMock.mock.calls[0][1]
    expect(auditEntry.metadata).toMatchObject({
      mode: 'EFFECTED_ORPHAN',
      ofxTransactionId: 'ofx-nestle',
      ofxBefore: { categoryId: null, supplierId: null },
      ofxBackfilled: { categoryId: 'cat-alimentacao', supplierId: 'sup-nestle' },
      candidateStatusBefore: 'RECONCILED',
    })
  })

  it('rejeita ORPHAN com origin=OFX (nunca OFX-vs-OFX)', async () => {
    const ofxAsOrphan = { ...baseCandidateOrphan, origin: 'OFX' }
    mockBothFinds(baseOFX, ofxAsOrphan)

    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
        fakeCtx,
      ),
    ).rejects.toThrow(ReconciliationError)
  })

  it('rejeita ORPHAN com direção divergente (OFX DEBIT vs Excel CREDIT)', async () => {
    const orphanCREDIT = { ...baseCandidateOrphan, type: 'CREDIT' }
    mockBothFinds(baseOFX, orphanCREDIT) // OFX DEBIT vs candidato CREDIT

    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
        fakeCtx,
      ),
    ).rejects.toThrow(/Direção divergente/)
  })
})

// ============================================================================
// Pré-validações cumulativas (Sprint A-effected)
// ============================================================================
describe('reconcileTransactions — pré-validações de defesa em profundidade', () => {
  it('rejeita valor divergente ≥ R$ 0,01', async () => {
    const orphanDiff = { ...baseCandidateOrphan, amount: 110 } // diff 4,14
    mockBothFinds(baseOFX, orphanDiff)

    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
        fakeCtx,
      ),
    ).rejects.toThrow(/Valor divergente/)
  })

  it('aceita valor com diff < R$ 0,01 (arredondamento)', async () => {
    const orphanQuaseExato = { ...baseCandidateOrphan, amount: 105.865 }
    mockBothFinds(baseOFX, orphanQuaseExato)

    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
        fakeCtx,
      ),
    ).resolves.toBeDefined()
  })

  it('rejeita datas > 5 dias', async () => {
    const orphanLonge = { ...baseCandidateOrphan, paymentDate: utc(2026, 5, 15) } // 12 dias depois
    mockBothFinds(baseOFX, orphanLonge)

    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
        fakeCtx,
      ),
    ).rejects.toThrow(/Datas distantes/)
  })

  it('aceita ±5 dias exatos', async () => {
    const orphanLimite = { ...baseCandidateOrphan, paymentDate: utc(2026, 5, 8) } // +5d
    mockBothFinds(baseOFX, orphanLimite)
    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
        fakeCtx,
      ),
    ).resolves.toBeDefined()
  })

  it('force=true pula as pré-validações (uso interno em backfill)', async () => {
    const orphanLonge = { ...baseCandidateOrphan, paymentDate: utc(2026, 6, 1) } // +29d
    mockBothFinds(baseOFX, orphanLonge)
    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle', force: true },
        fakeCtx,
      ),
    ).resolves.toBeDefined()
  })
})

// ============================================================================
// Multi-tenant
// ============================================================================
describe('reconcileTransactions — multi-tenant guard', () => {
  it('rejeita OFX e candidato de empresas diferentes', async () => {
    const ofxOutraEmpresa = {
      ...baseOFX,
      bankAccount: { companyId: 'cmp-OUTRA' },
    }
    mockBothFinds(ofxOutraEmpresa, baseCandidateOrphan)

    await expect(
      reconcileTransactions(
        { ofxTransactionId: 'ofx-nestle', candidateId: 'orphan-nestle' },
        fakeCtx,
      ),
    ).rejects.toThrow(/empresas diferentes/)
  })
})

// ============================================================================
// UNDO — restaura estado anterior
// ============================================================================
describe('undoReconciliation — CLASSIC undo', () => {
  it('restaura lifecycle PAYABLE + paymentDate=null + sem link', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseCandidatePayable,
      lifecycle: 'EFFECTED', // estado conciliado
      reconciledWithId: 'ofx-nestle',
      paymentDate: utc(2026, 5, 3),
      bankAccountId: FAKE_BANK,
      bankAccount: { companyId: FAKE_COMPANY },
    })
    findFirstMock.mockResolvedValue({
      fieldsChanged: JSON.stringify({
        lifecycle: { before: 'PAYABLE', after: 'EFFECTED' },
      }),
      metadata: JSON.stringify({ mode: 'CLASSIC' }),
    })

    await undoReconciliation('pay-nestle', fakeCtx)

    const restore = updateMock.mock.calls.find((c) => c[0].where.id === 'pay-nestle')
    expect(restore![0].data).toMatchObject({
      lifecycle: 'PAYABLE',
      paymentDate: null,
      bankAccountId: null,
      reconciledWithId: null,
      status: 'PENDING',
    })
  })
})

describe('undoReconciliation — ORPHAN undo (Sprint A-effected)', () => {
  it('limpa link + restaura status + restaura OFX cat/sup do audit', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseCandidateOrphan,
      reconciledWithId: 'ofx-nestle',
      bankAccount: null,
      supplier: { companyId: FAKE_COMPANY },
      customer: null,
      category: null,
    })
    findFirstMock.mockResolvedValue({
      fieldsChanged: JSON.stringify({
        reconciledWithId: { before: null, after: 'ofx-nestle' },
        status: { before: 'RECONCILED', after: 'RECONCILED' },
      }),
      metadata: JSON.stringify({
        mode: 'EFFECTED_ORPHAN',
        ofxTransactionId: 'ofx-nestle',
        ofxBefore: { categoryId: null, supplierId: null },
        ofxBackfilled: { categoryId: 'cat-alimentacao', supplierId: 'sup-nestle' },
        candidateStatusBefore: 'PENDING',
      }),
    })

    await undoReconciliation('orphan-nestle', fakeCtx)

    // Excel: limpa link + status volta pra PENDING
    const excelCall = updateMock.mock.calls.find((c) => c[0].where.id === 'orphan-nestle')
    expect(excelCall![0].data).toEqual({
      reconciledWithId: null,
      status: 'PENDING',
    })
    // OFX: restaura categoryId/supplierId pro NULL anterior
    const ofxCall = updateMock.mock.calls.find((c) => c[0].where.id === 'ofx-nestle')
    expect(ofxCall![0].data).toEqual({
      categoryId: null,
      supplierId: null,
    })
  })

  it('ORPHAN undo SEM backfill prévio → NÃO mexe no OFX', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseCandidateOrphan,
      reconciledWithId: 'ofx-nestle',
      bankAccount: null,
      supplier: { companyId: FAKE_COMPANY },
      customer: null,
      category: null,
    })
    findFirstMock.mockResolvedValue({
      fieldsChanged: JSON.stringify({}),
      metadata: JSON.stringify({
        mode: 'EFFECTED_ORPHAN',
        ofxTransactionId: 'ofx-nestle',
        ofxBefore: { categoryId: 'x', supplierId: 'y' },
        ofxBackfilled: {}, // vazio
        candidateStatusBefore: 'RECONCILED',
      }),
    })

    await undoReconciliation('orphan-nestle', fakeCtx)

    const ofxCall = updateMock.mock.calls.find((c) => c[0].where.id === 'ofx-nestle')
    expect(ofxCall).toBeUndefined()
  })

  it('rejeita undo se não há audit log', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseCandidateOrphan,
      reconciledWithId: 'ofx-x',
      bankAccount: null,
      supplier: { companyId: FAKE_COMPANY },
      customer: null,
      category: null,
    })
    findFirstMock.mockResolvedValue(null)

    await expect(undoReconciliation('orphan-nestle', fakeCtx)).rejects.toThrow(
      /audit log da conciliação não encontrado/,
    )
  })

  it('rejeita undo se tx não está conciliada', async () => {
    findUniqueMock.mockResolvedValueOnce({
      ...baseCandidateOrphan,
      reconciledWithId: null,
      bankAccount: null,
      supplier: { companyId: FAKE_COMPANY },
      customer: null,
      category: null,
    })

    await expect(undoReconciliation('orphan-nestle', fakeCtx)).rejects.toThrow(
      /não está conciliada/,
    )
  })
})
