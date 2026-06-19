// Sprint Reconcile Transfer Identity — testes da função pura/integração

import { describe, it, expect, vi } from 'vitest'
import { reconcileTransferPlaceholders } from '../../lib/import-identity/reconcile-placeholder'
import type { OFXTransaction } from '../../lib/ofx/parser'

function mkOFX(p: Partial<OFXTransaction> & { fitid: string; amount: number; datePosted: Date; memo: string }): OFXTransaction {
  return {
    fitid: p.fitid,
    amount: p.amount,
    datePosted: p.datePosted,
    type: p.type ?? 'CREDIT',
    memo: p.memo,
  } as OFXTransaction
}

function mkPrismaMock(opts: {
  matchesByAmountDate?: Array<{ id: string; date: Date; transferDirection: 'IN' | 'OUT' | null; transferGroupId: string }>
  existingLedger?: { transactionId: string; id: string } | null
}) {
  const updates: any[] = []
  const creates: any[] = []
  const findManyCalls: any[] = []
  return {
    updates,
    creates,
    findManyCalls,
    prisma: {
      transaction: {
        findMany: vi.fn(async (args: any) => {
          findManyCalls.push(args)
          return opts.matchesByAmountDate ?? []
        }),
        update: vi.fn(async (args: any) => {
          updates.push({ kind: 'transaction', ...args })
          return { id: args.where.id }
        }),
      },
      importedIdentity: {
        findFirst: vi.fn(async () => opts.existingLedger ?? null),
        update: vi.fn(async (args: any) => {
          updates.push({ kind: 'importedIdentity', ...args })
          return { id: args.where.id }
        }),
        create: vi.fn(async (args: any) => {
          creates.push({ kind: 'importedIdentity', ...args })
          return { id: 'created-ledger' }
        }),
      },
      $transaction: vi.fn(async (fn: any) => fn({
        transaction: {
          update: vi.fn(async (args: any) => {
            updates.push({ kind: 'transaction', ...args })
            return { id: args.where.id }
          }),
        },
        importedIdentity: {
          findFirst: vi.fn(async () => opts.existingLedger ?? null),
          update: vi.fn(async (args: any) => {
            updates.push({ kind: 'importedIdentity', ...args })
            return { id: args.where.id }
          }),
          create: vi.fn(async (args: any) => {
            creates.push({ kind: 'importedIdentity', ...args })
            return { id: 'created-ledger' }
          }),
        },
      })),
    } as any,
  }
}

describe('reconcileTransferPlaceholders — cenários reais', () => {
  const date = new Date('2026-06-08T12:00:00Z')

  it('match único IN -> reconcilia + UPDATE Transaction com nova identidade', async () => {
    const ofx = mkOFX({
      fitid: '4cc5c61a-e1b5-4846-bbba-b3d6e66b8faf',
      amount: 8000,
      datePosted: date,
      memo: 'Yussef Abu Zahry Musa - Transferencia | Pix',
    })
    const m = mkPrismaMock({
      matchesByAmountDate: [
        { id: 'placeholder-1', date, transferDirection: 'IN', transferGroupId: 'g1' },
      ],
      existingLedger: { transactionId: 'placeholder-1', id: 'led-1' },
    })
    const res = await reconcileTransferPlaceholders(m.prisma, [ofx], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'batch-1',
    })

    expect(res.reconciled).toHaveLength(1)
    expect(res.reconciled[0].transactionId).toBe('placeholder-1')
    expect(res.remaining).toHaveLength(0)
    // Verifica que Transaction foi atualizada com memo, externalId, fitidKey, contentHash
    const txUpd = m.updates.find((u) => u.kind === 'transaction' && u.where?.id === 'placeholder-1')
    expect(txUpd).toBeDefined()
    expect(txUpd.data.description).toBe('Yussef Abu Zahry Musa - Transferencia | Pix')
    expect(txUpd.data.externalId).toBe('4cc5c61a-e1b5-4846-bbba-b3d6e66b8faf')
    expect(txUpd.data.fitidKey).toMatch(/^[0-9a-f]{64}$/) // UUID confiável -> fitidKey populado
    expect(txUpd.data.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('SEM placeholder compatível -> tx vai pra remaining', async () => {
    const ofx = mkOFX({
      fitid: '4cc5c61a-e1b5-4846-bbba-b3d6e66b8faf',
      amount: 8000,
      datePosted: date,
      memo: 'YUSSEF...',
    })
    const m = mkPrismaMock({ matchesByAmountDate: [] })
    const res = await reconcileTransferPlaceholders(m.prisma, [ofx], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'batch-1',
    })
    expect(res.reconciled).toHaveLength(0)
    expect(res.remaining).toHaveLength(1)
    expect(m.updates).toHaveLength(0)
  })

  it('MÚLTIPLOS placeholders compatíveis (ambíguo) -> NÃO reconcilia', async () => {
    const ofx = mkOFX({
      fitid: 'X',
      amount: 1000,
      datePosted: date,
      memo: 'PIX',
    })
    const m = mkPrismaMock({
      matchesByAmountDate: [
        { id: 'p1', date, transferDirection: 'IN', transferGroupId: 'g1' },
        { id: 'p2', date, transferDirection: 'IN', transferGroupId: 'g2' },
      ],
    })
    const res = await reconcileTransferPlaceholders(m.prisma, [ofx], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'batch-1',
    })
    expect(res.reconciled).toHaveLength(0)
    expect(res.remaining).toHaveLength(1)
  })

  it('placeholder com transferDirection=OUT -> NÃO reconcilia (OFX é entrada)', async () => {
    const ofx = mkOFX({
      fitid: 'X',
      amount: 500,
      datePosted: date,
      memo: 'PIX',
    })
    const m = mkPrismaMock({
      matchesByAmountDate: [
        { id: 'p1', date, transferDirection: 'OUT', transferGroupId: 'g1' },
      ],
    })
    const res = await reconcileTransferPlaceholders(m.prisma, [ofx], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'batch-1',
    })
    expect(res.reconciled).toHaveLength(0)
    expect(res.remaining).toHaveLength(1)
  })

  it('placeholder com transferDirection=null aceita (compat tx antigas)', async () => {
    const ofx = mkOFX({
      fitid: 'XYZ-ABC-1234567890123456',
      amount: 500,
      datePosted: date,
      memo: 'PIX',
    })
    const m = mkPrismaMock({
      matchesByAmountDate: [
        { id: 'p1', date, transferDirection: null, transferGroupId: 'g1' },
      ],
    })
    const res = await reconcileTransferPlaceholders(m.prisma, [ofx], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'batch-1',
    })
    expect(res.reconciled).toHaveLength(1)
  })

  it('cria entry ImportedIdentity quando não existe', async () => {
    const ofx = mkOFX({
      fitid: '4cc5c61a-e1b5-4846-bbba-b3d6e66b8faf',
      amount: 7400,
      datePosted: date,
      memo: 'YUSSEF...',
    })
    const m = mkPrismaMock({
      matchesByAmountDate: [
        { id: 'p1', date, transferDirection: 'IN', transferGroupId: 'g1' },
      ],
      existingLedger: null,
    })
    const res = await reconcileTransferPlaceholders(m.prisma, [ofx], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'batch-1',
    })
    expect(res.reconciled).toHaveLength(1)
    expect(m.creates.find((c) => c.kind === 'importedIdentity')).toBeDefined()
  })
})

describe('reconcileTransferPlaceholders — guards de segurança (não vira false-positive)', () => {
  const date = new Date('2026-06-08T12:00:00Z')

  it('query exclui externalId NOT NULL — tx já reconciliadas não viram candidatas', async () => {
    const ofx = mkOFX({
      fitid: 'X',
      amount: 100,
      datePosted: date,
      memo: 'PIX',
    })
    const m = mkPrismaMock({ matchesByAmountDate: [] })
    await reconcileTransferPlaceholders(m.prisma, [ofx], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'b1',
    })
    const call = m.findManyCalls[0]
    expect(call.where.externalId).toBeNull()
    expect(call.where.type).toBe('TRANSFER')
    expect(call.where.transferGroupId).toEqual({ not: null })
  })

  it('mesma incoming não consome o mesmo placeholder 2x', async () => {
    // 2 OFX tx mesmo valor/data, mas só 1 placeholder existe -> só 1 reconcilia
    const tx1 = mkOFX({ fitid: 'A-aaaa-bbbb-cccc-dddddddddddd', amount: 100, datePosted: date, memo: 'X' })
    const tx2 = mkOFX({ fitid: 'B-aaaa-bbbb-cccc-eeeeeeeeeeee', amount: 100, datePosted: date, memo: 'X' })
    // 1ª chamada retorna placeholder; 2ª deve respeitar usedIds e retornar vazio
    let firstCall = true
    const m = mkPrismaMock({})
    m.prisma.transaction.findMany = vi.fn(async (args: any) => {
      m.findManyCalls.push(args)
      if (firstCall) {
        firstCall = false
        return [{ id: 'p1', date, transferDirection: 'IN', transferGroupId: 'g1' }]
      }
      // 2ª chamada deve ter notIn=['p1']
      return []
    })
    const res = await reconcileTransferPlaceholders(m.prisma, [tx1, tx2], {
      bankAccountId: 'STONE',
      companyId: 'CACULA',
      importBatchId: 'b1',
    })
    expect(res.reconciled).toHaveLength(1)
    expect(res.remaining).toHaveLength(1)
    // 2ª findMany incluiu notIn com p1
    expect(m.findManyCalls[1].where.id.notIn).toContain('p1')
  })
})
