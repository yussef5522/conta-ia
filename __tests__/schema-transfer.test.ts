import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'

// Sprint 0.5 Dia 1 — valida que o schema Prisma expõe transferGroupId
// em Transaction conforme planejado. Testes contra DMMF (sem DB).
const transactionModel = Prisma.dmmf.datamodel.models.find(
  (m) => m.name === 'Transaction'
)!

describe('Transaction.transferGroupId (Sprint 0.5)', () => {
  it('campo existe no modelo Transaction', () => {
    const field = transactionModel.fields.find((f) => f.name === 'transferGroupId')
    expect(field).toBeDefined()
  })

  it('é String opcional (nullable)', () => {
    const field = transactionModel.fields.find((f) => f.name === 'transferGroupId')!
    expect(field.type).toBe('String')
    expect(field.isRequired).toBe(false)
  })

  it('não tem default (null pra transações comuns)', () => {
    const field = transactionModel.fields.find((f) => f.name === 'transferGroupId')!
    expect(field.hasDefaultValue).toBe(false)
  })

  it('migration Postgres cria índice em transferGroupId', () => {
    const migrationPath = path.join(
      __dirname,
      '..',
      'prisma',
      'migrations',
      '20260511000000_sprint_0_5_transfers_and_negative_balance',
      'migration.sql'
    )
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/CREATE INDEX[^\n]*"transferGroupId"/)
    expect(sql).toMatch(/ALTER TABLE "transactions" ADD COLUMN "transferGroupId" TEXT/)
  })
})
