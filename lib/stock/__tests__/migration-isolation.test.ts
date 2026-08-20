// ESTOQUE FASE 0 — GUARD da regra dura (seção 0): toda migration do estoque SÓ CRIA.
// Nenhuma toca tabela existente (zero ALTER/DROP). Roda no CI; se alguém adicionar um
// ALTER numa migration stock_, quebra aqui antes do deploy. O artefato É o arquivo .sql.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

const MIGR_DIR = join(process.cwd(), 'prisma', 'migrations')

// Migrations do módulo estoque (prefixo por convenção: contêm "stock" no nome).
function stockMigrations(): string[] {
  if (!existsSync(MIGR_DIR)) return []
  return readdirSync(MIGR_DIR)
    .filter((d) => /stock/i.test(d))
    .map((d) => join(MIGR_DIR, d, 'migration.sql'))
    .filter((f) => existsSync(f))
}

describe('ISOLAMENTO — migrations do estoque SÓ CRIAM (regra dura)', () => {
  const files = stockMigrations()

  it('há ao menos 1 migration de estoque', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s não tem ALTER/DROP em tabela existente', (file) => {
    const sql = readFileSync(file, 'utf-8')
    // remove comentários pra não falsar por texto explicativo
    const semComentario = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    expect(semComentario).not.toMatch(/\bALTER\s+TABLE\b/i)
    expect(semComentario).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i)
    // toda instrução de tabela é sobre stock_ (nunca uma tabela fechada)
    const tabelas = [...semComentario.matchAll(/CREATE\s+TABLE\s+"([^"]+)"/gi)].map((m) => m[1])
    for (const t of tabelas) expect(t).toMatch(/^stock_/)
  })
})
