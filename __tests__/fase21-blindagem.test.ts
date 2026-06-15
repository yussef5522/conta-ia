// Fase 2.1 — blindagem final (testes de presença).
// Validação que o filtro DRE + as 3 constraints SQL estão no código.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DRE_ROUTE = join(__dirname, '..', 'app/api/empresas/[id]/dre/route.ts')
const MIGRATION_SQL = join(
  __dirname,
  '..',
  'prisma/migrations/20260614230000_add_transfer_direction_constraints/migration.sql',
)

describe('Fase 2.1 — DRE filtra status=IGNORED', () => {
  it('route.ts contém status: { not: \'IGNORED\' } no where do findMany', () => {
    const code = readFileSync(DRE_ROUTE, 'utf-8')
    // Aceita variações de espaço/aspas
    expect(code).toMatch(/status:\s*\{\s*not:\s*['"]IGNORED['"]\s*\}/)
  })

  it('comentário cita coerência com calculate-rba (precedente RBA)', () => {
    const code = readFileSync(DRE_ROUTE, 'utf-8')
    expect(code).toMatch(/calculate-rba/i)
  })

  it('comentário cita semântica do user ("tirar da fila contábil") + Cacula 0 IGNORED', () => {
    const code = readFileSync(DRE_ROUTE, 'utf-8')
    expect(code).toMatch(/IGNORADAS|IGNORED/i)
    expect(code).toMatch(/prospectiva|0 tx IGNORED|zero impacto retroativo/i)
  })
})

describe('Fase 2.1 — migration cria UNIQUE + 2 CHECKs', () => {
  it('UNIQUE INDEX (transferGroupId, transferDirection) WHERE NOT NULL', () => {
    const sql = readFileSync(MIGRATION_SQL, 'utf-8')
    expect(sql).toMatch(/CREATE UNIQUE INDEX/i)
    expect(sql).toMatch(/"transferGroupId"\s*,\s*"transferDirection"/i)
    expect(sql).toMatch(/WHERE\s+"transferDirection"\s+IS NOT NULL/i)
  })

  it('CHECK transfer_has_direction (TRANSFER ⇒ direção válida)', () => {
    const sql = readFileSync(MIGRATION_SQL, 'utf-8')
    expect(sql).toMatch(/CONSTRAINT "transfer_has_direction"\s+CHECK/i)
    expect(sql).toMatch(/type\s*!=\s*'TRANSFER'\s+OR\s+"transferDirection"\s+IN\s*\(\s*'OUT'\s*,\s*'IN'\s*\)/i)
  })

  it('CHECK direction_requires_group (direção ⇒ grupo)', () => {
    const sql = readFileSync(MIGRATION_SQL, 'utf-8')
    expect(sql).toMatch(/CONSTRAINT "direction_requires_group"\s+CHECK/i)
    expect(sql).toMatch(/"transferDirection"\s+IS NULL\s+OR\s+"transferGroupId"\s+IS NOT NULL/i)
  })

  it('migração é ADITIVA (só CREATE INDEX e ALTER TABLE ADD CONSTRAINT; sem DROP/UPDATE)', () => {
    const sql = readFileSync(MIGRATION_SQL, 'utf-8')
    expect(sql).not.toMatch(/\bDROP\b/i)
    expect(sql).not.toMatch(/\bUPDATE\b/i)
    expect(sql).not.toMatch(/\bDELETE\b/i)
  })
})
