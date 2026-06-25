// Sprint Cartao PJ FIX — valida que a migration ESTENDE a constraint
// effected_needs_bank_or_cash_or_reconcile pra aceitar businessCreditCardId.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  'prisma/migrations/20260624010000_cartao_pj_effected_constraint/migration.sql',
)

describe('Sprint Cartao PJ FIX — migration effected_needs_bank_or_cash_or_reconcile', () => {
  it('migration file existe', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
  })

  it('faz DROP CONSTRAINT IF EXISTS antes de recriar', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8')
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS "effected_needs_bank_or_cash_or_reconcile"/)
  })

  it('recria a constraint mantendo as 4 alternativas originais', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8')
    // lifecycle <> EFFECTED
    expect(sql).toMatch(/lifecycle <> 'EFFECTED'/)
    // bankAccountId IS NOT NULL
    expect(sql).toMatch(/"bankAccountId" IS NOT NULL/)
    // cashCoded = true
    expect(sql).toMatch(/"cashCoded" = true/)
    // reconciledWithId IS NOT NULL
    expect(sql).toMatch(/"reconciledWithId" IS NOT NULL/)
    // type = TRANSFER
    expect(sql).toMatch(/type = 'TRANSFER'/)
  })

  it('ADICIONA businessCreditCardId IS NOT NULL como 5a alternativa', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8')
    expect(sql).toMatch(/"businessCreditCardId" IS NOT NULL/)
  })
})

// ============================================================================
// Regressao: 2 linhas IGUAIS na MESMA fatura (caso real Netflix Banrisul:
// 2 cobrancas R$ 85,70 mesma data, mesma descricao). Mesmo contentHash —
// mas como nao ha @@unique em (businessCreditCardId, contentHash), ambas
// entram. So o filtro de DEDUP cross-import as bloqueia.
// ============================================================================
describe('2 linhas iguais na mesma fatura', () => {
  it('schema NAO tem @@unique em (businessCreditCardId, contentHash)', () => {
    // Lemos o schema.prisma e confirmamos que nao existe unique em ambos
    const schemaPath = join(__dirname, '..', '..', 'prisma/schema.prisma')
    const schema = readFileSync(schemaPath, 'utf-8')
    // Garantia: nao tem @@unique([businessCreditCardId, contentHash])
    expect(schema).not.toMatch(/@@unique\(\[businessCreditCardId,\s*contentHash\]\)/)
    expect(schema).not.toMatch(/@@unique\(\[contentHash,\s*businessCreditCardId\]\)/)
  })
})
