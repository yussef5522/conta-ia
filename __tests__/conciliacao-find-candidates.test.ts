// Sprint Conciliacao-Strict (30/06/2026) — testes do find-candidates ESTRITO.
//
// Regra (Yussef + QuickBooks/Xero): só Conta a Pagar/Receber EM ABERTO pareia
// com linha do extrato. Nunca despesas já efetivadas (caixa loja), nunca de
// outra conta, nunca órfãs Excel.
//
// RAMO 2 (Sprint A 03/06) REMOVIDO. Os testes valida estrutura nova:
//   lifecycle = targetLifecycle (PAYABLE ou RECEIVABLE)
//   status = 'PENDING'
//   type = ofx.type
//   reconciledWithId = null
//   paymentDate = null (defesa em profundidade)
//   amount/dueDate na janela
//   AND[companyScope, sameAccountOrNull]
// + 6 cenários funcionais.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const findManyMock = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: { transaction: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}))

import { findReconciliationCandidates, resolveTargetDate } from '@/lib/conciliacao/find-candidates'
import type { OFXTransaction } from '@/lib/conciliacao/match'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))

const baseDebitOFX: OFXTransaction = {
  id: 'ofx-aluguel',
  description: 'PAGAMENTO ALUGUEL',
  amount: 5000,
  type: 'DEBIT',
  date: utc(2026, 5, 5),
  supplierId: null,
  bankAccountId: 'ba-banrisul',
}

const baseCreditOFX: OFXTransaction = {
  ...baseDebitOFX,
  id: 'ofx-cliente',
  description: 'PIX RECEBIDO CLIENTE X',
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

  it('fallback paymentDate quando dueDate=null (defensivo)', () => {
    const r = resolveTargetDate({
      id: 'x', lifecycle: 'PAYABLE', description: 'x', amount: 1,
      dueDate: null,
      paymentDate: utc(2026, 5, 10),
      date: utc(2026, 5, 20),
      supplierId: null, customerId: null, categoryId: null,
    })
    expect(r.toISOString()).toBe(utc(2026, 5, 10).toISOString())
  })

  it('fallback date quando dueDate=null e paymentDate=null', () => {
    const r = resolveTargetDate({
      id: 'x', lifecycle: 'PAYABLE', description: 'x', amount: 1,
      dueDate: null,
      paymentDate: null,
      date: utc(2026, 5, 20),
      supplierId: null, customerId: null, categoryId: null,
    })
    expect(r.toISOString()).toBe(utc(2026, 5, 20).toISOString())
  })
})

describe('estrutura da query estrita', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('OFX DEBIT → busca SÓ PAYABLE pendente (RAMO 2 removido)', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'company-1')
    expect(findManyMock).toHaveBeenCalledOnce()
    const where = findManyMock.mock.calls[0][0].where
    expect(where.lifecycle).toBe('PAYABLE')
    expect(where.status).toBe('PENDING')
    expect(where.type).toBe('DEBIT')
    expect(where.reconciledWithId).toBe(null)
    // 🚨 paymentDate=null garante "em aberto" — defesa em profundidade
    expect(where.paymentDate).toBe(null)
  })

  it('OFX CREDIT → busca SÓ RECEIVABLE pendente', async () => {
    await findReconciliationCandidates(baseCreditOFX, 'company-1')
    const where = findManyMock.mock.calls[0][0].where
    expect(where.lifecycle).toBe('RECEIVABLE')
    expect(where.type).toBe('CREDIT')
  })

  it('NÃO existe mais OR de "ramos" no where', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'company-1')
    const where = findManyMock.mock.calls[0][0].where
    // Nenhum where.OR — RAMO 2 removido. AND tem só [companyScope, sameAccount].
    expect(where.OR).toBeUndefined()
    expect(Array.isArray(where.AND)).toBe(true)
    expect(where.AND).toHaveLength(2)
  })

  it('amount na janela ±20%', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c')
    const w = findManyMock.mock.calls[0][0].where
    expect(w.amount.gte).toBeCloseTo(5000 * 0.8)
    expect(w.amount.lte).toBeCloseTo(5000 * 1.2)
  })

  it('dueDate na janela ±15d em torno de ofx.date', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c')
    const w = findManyMock.mock.calls[0][0].where
    const expectedMin = new Date(baseDebitOFX.date.getTime() - 15 * 86400000)
    const expectedMax = new Date(baseDebitOFX.date.getTime() + 15 * 86400000)
    expect(w.dueDate.gte.toISOString()).toBe(expectedMin.toISOString())
    expect(w.dueDate.lte.toISOString()).toBe(expectedMax.toISOString())
  })
})

describe('filtro de conta (sameAccountOrNull)', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('AND[1] aceita PAYABLE sem banco (null) OR mesma conta do extrato', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c')
    const sameAccount = findManyMock.mock.calls[0][0].where.AND[1]
    expect(sameAccount.OR).toEqual([
      { bankAccountId: null },
      { bankAccountId: 'ba-banrisul' },
    ])
  })

  it('NUNCA aceita PAYABLE de outra conta (não inclui outras bankAccountIds no OR)', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c')
    const sameAccount = findManyMock.mock.calls[0][0].where.AND[1]
    const accountIds = sameAccount.OR.map((o: { bankAccountId: string | null }) => o.bankAccountId)
    expect(accountIds).toContain('ba-banrisul')
    expect(accountIds).toContain(null)
    expect(accountIds).toHaveLength(2)
  })
})

describe('multi-tenant (companyScope)', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('AND[0] aplica scope via OR de 4 relações', async () => {
    await findReconciliationCandidates(baseDebitOFX, 'c-1')
    const scope = findManyMock.mock.calls[0][0].where.AND[0]
    expect(scope.OR).toHaveLength(4)
    expect(scope.OR[0]).toEqual({ bankAccount: { companyId: 'c-1' } })
    expect(scope.OR[1]).toEqual({ supplier: { companyId: 'c-1' } })
    expect(scope.OR[2]).toEqual({ customer: { companyId: 'c-1' } })
    expect(scope.OR[3]).toEqual({ category: { companyId: 'c-1' } })
  })
})

describe('6 cenários funcionais (Yussef + QuickBooks/Xero)', () => {
  beforeEach(() => {
    findManyMock.mockReset()
  })

  it('1. PAYABLE pendente DEBIT na mesma conta → aparece como candidato', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'payable-aluguel',
        lifecycle: 'PAYABLE',
        description: 'Aluguel Maio',
        amount: 5000,
        dueDate: utc(2026, 5, 5),
        paymentDate: null,
        date: utc(2026, 5, 5),
        supplierId: 'sup-imobiliaria',
        customerId: null,
        categoryId: 'cat-aluguel',
      },
    ])
    const r = await findReconciliationCandidates(baseDebitOFX, 'c-1')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('payable-aluguel')
    expect(r[0].lifecycle).toBe('PAYABLE')
    expect(r[0].categoryId).toBe('cat-aluguel')
  })

  it('2. RECEIVABLE pendente CREDIT na mesma conta → aparece', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'recv-cliente',
        lifecycle: 'RECEIVABLE',
        description: 'NF 123 Cliente',
        amount: 500,
        dueDate: utc(2026, 5, 5),
        paymentDate: null,
        date: utc(2026, 5, 5),
        supplierId: null,
        customerId: 'cli-x',
        categoryId: 'cat-receitas',
      },
    ])
    const r = await findReconciliationCandidates(baseCreditOFX, 'c-1')
    expect(r).toHaveLength(1)
    expect(r[0].lifecycle).toBe('RECEIVABLE')
  })

  it('3. PAYABLE já paga (paymentDate set) → NÃO aparece (filtro paymentDate=null)', async () => {
    // Query mockada retorna VAZIO pq Prisma vai filtrar pelo where do find.
    // O teste estrutural confirma que a query ENVIA paymentDate=null.
    findManyMock.mockResolvedValue([])
    await findReconciliationCandidates(baseDebitOFX, 'c-1')
    expect(findManyMock.mock.calls[0][0].where.paymentDate).toBe(null)
  })

  it('4. PAYABLE de OUTRA conta → NÃO aparece (filtro sameAccountOrNull)', async () => {
    findManyMock.mockResolvedValue([])
    await findReconciliationCandidates(baseDebitOFX, 'c-1')
    // Confirma que o filtro de conta NÃO inclui outra conta — só null + Banrisul.
    const accounts = findManyMock.mock.calls[0][0].where.AND[1].OR
    expect(accounts).not.toContainEqual({ bankAccountId: 'ba-stone' })
    expect(accounts).not.toContainEqual({ bankAccountId: 'ba-sicredi' })
  })

  it('5. EFFECTED MANUAL caixa loja (despesa em dinheiro) → NÃO aparece (RAMO 2 removido)', async () => {
    findManyMock.mockResolvedValue([])
    await findReconciliationCandidates(baseDebitOFX, 'c-1')
    // Filtro lifecycle=PAYABLE não casa com EFFECTED. RAMO 2 não existe.
    expect(findManyMock.mock.calls[0][0].where.lifecycle).toBe('PAYABLE')
    expect(findManyMock.mock.calls[0][0].where.lifecycle).not.toBe('EFFECTED')
  })

  it('6. Excel órfã (origin=IMPORT_EXCEL EFFECTED sem conta) → NÃO aparece', async () => {
    findManyMock.mockResolvedValue([])
    await findReconciliationCandidates(baseDebitOFX, 'c-1')
    // Query nova NÃO tem `origin: { in: [...] }` (RAMO 2 removido).
    expect(findManyMock.mock.calls[0][0].where.origin).toBeUndefined()
  })
})

describe('Cacula em 30/06 — 0 PAYABLE/RECEIVABLE em aberto', () => {
  beforeEach(() => {
    findManyMock.mockReset()
    findManyMock.mockResolvedValue([])
  })

  it('conciliação Stone retorna lado direito VAZIO (correto pra estado atual)', async () => {
    const stoneOFX: OFXTransaction = {
      id: 'ofx-pix-jenifer',
      description: 'PIX PAGO Jenifer dos Santos',
      amount: 150,
      type: 'DEBIT',
      date: utc(2026, 5, 26),
      supplierId: null,
      bankAccountId: 'ba-stone',
    }
    const r = await findReconciliationCandidates(stoneOFX, 'cacula')
    expect(r).toEqual([])
  })

  it('conciliação NÃO oferece despesas caixa loja como candidato (RAMO 2 removido)', async () => {
    const banrisulOFX: OFXTransaction = {
      id: 'ofx-debito',
      description: 'DEBITO BANRISUL',
      amount: 100,
      type: 'DEBIT',
      date: utc(2026, 5, 26),
      supplierId: null,
      bankAccountId: 'ba-banrisul',
    }
    await findReconciliationCandidates(banrisulOFX, 'cacula')
    // SQL gerada SÓ casa PAYABLE — caixa loja MANUAL EFFECTED não bate.
    const w = findManyMock.mock.calls[0][0].where
    expect(w.lifecycle).toBe('PAYABLE')
    expect(w.status).toBe('PENDING')
    // Filtro de conta: PAYABLE pra Banrisul ou sem banco; nunca caixa loja
    expect(w.AND[1].OR).toEqual([
      { bankAccountId: null },
      { bankAccountId: 'ba-banrisul' },
    ])
  })
})
