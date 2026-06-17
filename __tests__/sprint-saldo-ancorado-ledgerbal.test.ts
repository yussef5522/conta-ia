// Sprint Saldo-Ancorado-LEDGERBAL (17/06/2026) — testes.
//
// Cobre:
//   1) Schema migration aditiva
//   2) Lib recalcularSaldoConta — modo LEDGERBAL_ANCHOR vs SUM_TODAS
//   3) Importer OFX persiste ledgerBal + chama recalcular
//   4) Sinais via prepareBalanceTransactions (regressão CREDIT/DEBIT/TRANSFER)

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prepareBalanceTransactions } from '@/lib/balance/prepare'

const D = (s: string) => new Date(s + 'T12:00:00.000Z')

// ============================================================================
// 1) Schema + migration
// ============================================================================
describe('Sprint Saldo-Ancorado — schema + migration', () => {
  it('schema.prisma tem ledgerBal Float? e ledgerBalDate DateTime? em bank_accounts', () => {
    const schema = readFileSync(join(__dirname, '..', 'prisma/schema.prisma'), 'utf-8')
    expect(schema).toMatch(/ledgerBal\s+Float\?/)
    expect(schema).toMatch(/ledgerBalDate\s+DateTime\?/)
  })

  it('migration adiciona ambas colunas em ALTER TABLE bank_accounts', () => {
    const PATH = join(
      __dirname,
      '..',
      'prisma/migrations/20260623000000_bank_account_ledgerbal/migration.sql',
    )
    const sql = readFileSync(PATH, 'utf-8')
    expect(sql).toMatch(/ALTER TABLE "bank_accounts" ADD COLUMN "ledgerBal" DOUBLE PRECISION/)
    expect(sql).toMatch(/ALTER TABLE "bank_accounts" ADD COLUMN "ledgerBalDate" TIMESTAMP/)
  })
})

// ============================================================================
// 2) Lib recalcularSaldoConta — mock prisma
// ============================================================================
describe('Sprint Saldo-Ancorado — recalcularSaldoConta (mock prisma)', () => {
  function makePrismaMock(conta: any, txs: any[]) {
    return {
      bankAccount: {
        findUnique: vi.fn().mockResolvedValue(conta),
        update: vi.fn().mockResolvedValue({ ...conta }),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue(txs),
      },
    } as any
  }

  it('SEM ledgerBalDate → modo SUM_TODAS (sum signed de TODAS as tx)', async () => {
    const { recalcularSaldoConta } = await import('@/lib/balance/recalcular')
    const conta = {
      id: 'ba-1',
      name: 'caixa cofre',
      balance: 1234.56, // valor errado/drift no campo
      ledgerBal: null,
      ledgerBalDate: null,
    }
    const txs = [
      { id: 't1', date: D('2026-06-01'), createdAt: D('2026-06-01'), type: 'CREDIT', amount: 500, bankAccountId: 'ba-1', transferGroupId: null, transferDirection: null },
      { id: 't2', date: D('2026-06-02'), createdAt: D('2026-06-02'), type: 'DEBIT',  amount: 200, bankAccountId: 'ba-1', transferGroupId: null, transferDirection: null },
    ]
    const prisma = makePrismaMock(conta, txs)
    const r = await recalcularSaldoConta(prisma, 'ba-1')

    expect(r.modo).toBe('SUM_TODAS')
    expect(r.txCount).toBe(2)
    expect(r.somaTxConsiderada).toBe(300) // 500 - 200
    expect(r.saldoDepois).toBe(300)
    expect(r.saldoAntes).toBe(1234.56)
    expect(r.delta).toBeCloseTo(-934.56, 2)
    expect(prisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 'ba-1' },
      data: { balance: 300 },
    })
  })

  it('COM ledgerBalDate → modo LEDGERBAL_ANCHOR (só tx pós-data)', async () => {
    const { recalcularSaldoConta } = await import('@/lib/balance/recalcular')
    const conta = {
      id: 'ba-2',
      name: 'banrisul',
      balance: -26283.46, // valor errado/drift
      ledgerBal: -8030.99, // LEDGERBAL real do extrato
      ledgerBalDate: D('2026-06-15'),
    }
    // Tx pós-ledgerBalDate (15/06):
    const txs = [
      { id: 't1', date: D('2026-06-16'), createdAt: D('2026-06-16T01:00:00'), type: 'DEBIT', amount: 100, bankAccountId: 'ba-2', transferGroupId: null, transferDirection: null },
      { id: 't2', date: D('2026-06-17'), createdAt: D('2026-06-17T01:00:00'), type: 'CREDIT', amount: 50, bankAccountId: 'ba-2', transferGroupId: null, transferDirection: null },
    ]
    const prisma = makePrismaMock(conta, txs)
    const r = await recalcularSaldoConta(prisma, 'ba-2')

    expect(r.modo).toBe('LEDGERBAL_ANCHOR')
    expect(r.ledgerBal).toBe(-8030.99)
    expect(r.somaTxConsiderada).toBe(-50) // -100 + 50
    // -8030.99 + (-50) = -8080.99
    expect(r.saldoDepois).toBeCloseTo(-8080.99, 2)
    expect(r.delta).toBeCloseTo(-8080.99 - -26283.46, 2)
  })

  it('TRANSFER OUT/IN respeitam transferDirection (não dobra contagem)', async () => {
    const { recalcularSaldoConta } = await import('@/lib/balance/recalcular')
    const conta = {
      id: 'ba-stone',
      name: 'stone',
      balance: 50196.58,
      ledgerBal: 838.30,
      ledgerBalDate: D('2026-06-16'),
    }
    const txs = [
      // TRANSFER IN (recebeu) pós-data
      { id: 't-in', date: D('2026-06-17'), createdAt: D('2026-06-17T01:00:00'), type: 'TRANSFER', amount: 1000, bankAccountId: 'ba-stone', transferGroupId: 'g1', transferDirection: 'IN' },
      // TRANSFER OUT (saiu) pós-data
      { id: 't-out', date: D('2026-06-17'), createdAt: D('2026-06-17T01:01:00'), type: 'TRANSFER', amount: 300, bankAccountId: 'ba-stone', transferGroupId: 'g2', transferDirection: 'OUT' },
    ]
    const prisma = makePrismaMock(conta, txs)
    const r = await recalcularSaldoConta(prisma, 'ba-stone')

    expect(r.somaTxConsiderada).toBe(700) // +1000 - 300
    expect(r.saldoDepois).toBeCloseTo(838.30 + 700, 2)
  })

  it('rejeita bankAccountId vazio (multi-tenant)', async () => {
    const { recalcularSaldoConta } = await import('@/lib/balance/recalcular')
    const prisma = makePrismaMock({}, [])
    await expect(recalcularSaldoConta(prisma, '')).rejects.toThrow(
      /bankAccountId obrigatório/,
    )
  })
})

// ============================================================================
// 3) prepareBalanceTransactions — regressão (Sprint 0.5 Dia 3) preservada
// ============================================================================
describe('Sprint Saldo-Ancorado — regressão prepareBalanceTransactions', () => {
  it('CREDIT → +amount; DEBIT → -amount', () => {
    const r = prepareBalanceTransactions(
      [
        { id: 'c', date: D('2026-06-01'), createdAt: D('2026-06-01'), type: 'CREDIT', amount: 100, bankAccountId: 'ba', transferGroupId: null },
        { id: 'd', date: D('2026-06-02'), createdAt: D('2026-06-02'), type: 'DEBIT', amount: 30, bankAccountId: 'ba', transferGroupId: null },
      ],
      'ba',
    )
    expect(r.map((x) => x.signedAmount)).toEqual([100, -30])
  })

  it('TRANSFER com transferDirection EXPLÍCITA (Fase 2) é prioritário', () => {
    const r = prepareBalanceTransactions(
      [
        { id: 'tA', date: D('2026-06-01'), createdAt: D('2026-06-01'), type: 'TRANSFER', amount: 500, bankAccountId: 'ba', transferGroupId: 'g', transferDirection: 'OUT' },
        { id: 'tB', date: D('2026-06-01'), createdAt: D('2026-06-01'), type: 'TRANSFER', amount: 500, bankAccountId: 'bb', transferGroupId: 'g', transferDirection: 'IN' },
      ],
      'ba',
    )
    expect(r).toHaveLength(1)
    expect(r[0].signedAmount).toBe(-500) // saiu da ba
  })
})

// ============================================================================
// 4) Importer OFX integração
// ============================================================================
describe('Sprint Saldo-Ancorado — importer OFX persistência + recalcular', () => {
  const PATH = join(
    __dirname,
    '..',
    'app/api/contas-bancarias/[id]/importar-ofx/route.ts',
  )
  const code = readFileSync(PATH, 'utf-8')

  it('NÃO usa mais "balance: { increment: ajusteSaldo }"', () => {
    expect(code).not.toMatch(/balance:\s*\{\s*increment:\s*ajusteSaldo/)
  })

  it('Persiste ledgerBal + ledgerBalDate quando LEDGERBAL veio do arquivo', () => {
    expect(code).toMatch(/ledgerBal:\s*ledgerBalance\.amount/)
    expect(code).toMatch(/ledgerBalDate:\s*ledgerBalance\.asOfDate/)
  })

  it('Importa recalcularSaldoConta dinâmico após createMany', () => {
    expect(code).toMatch(/import\(['"]@\/lib\/balance\/recalcular['"]\)/)
    expect(code).toMatch(/recalcularSaldoConta\(prisma,\s*contaId\)/)
  })

  it('Falha silenciosa do recalcular não mata o import', () => {
    expect(code).toMatch(/\[importar-ofx\] recalcularSaldo falhou/)
  })
})
