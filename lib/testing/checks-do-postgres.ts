// ⭐⭐ AS CHECKs DO POSTGRES NO BANCO DE TESTE (13/11/2026).
//
// ⛔ O VERDE FALSO QUE ISTO MATA: a suíte roda no SQLite de dev (`prisma db push` do schema), e as
// CHECKs vivem nas migrations SQL do Postgres — então o teste aceitava gravar o que prod recusa.
// Caso real (13/11): `stock_etapa_encerrada.motivo = 'ENCERRADA_ADMINISTRATIVAMENTE'` passou verde
// na suíte e foi recusado em prod por `chk_etapa_encerrada_motivo` (23514).
//
// ⭐ O que entra: as CHECKs de LISTA (`"coluna" IN ('A','B')`) lidas das próprias migrations, em
// ordem (a última definição vale; `DROP CONSTRAINT` remove). Viram TRIGGERs no SQLite com a MESMA
// semântica do Postgres: NULL passa (CHECK com expressão NULL é aceita — REGRA 13).
// ⚠️ CHECK de expressão (length/trim, coerência entre colunas) NÃO é traduzida aqui: SQL do Postgres
// não roda no SQLite. Essas seguem exigindo a prova de INSERT torto contra Postgres (REGRA 13).

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface CheckDeLista { tabela: string; nome: string; coluna: string; valores: string[] }

const semComentario = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
const RE_CHECK = /CONSTRAINT\s+"([A-Za-z0-9_]+)"\s+CHECK\s*\(\s*"([A-Za-z0-9_]+)"\s+IN\s*\(([^)]*)\)\s*\)/g

export function checksDeListaDasMigrations(dir = join(process.cwd(), 'prisma/migrations')): CheckDeLista[] {
  const vivas = new Map<string, CheckDeLista>()
  const pastas = readdirSync(dir).filter((p) => existsSync(join(dir, p, 'migration.sql'))).sort()
  for (const p of pastas) {
    const sql = semComentario(readFileSync(join(dir, p, 'migration.sql'), 'utf8'))
    for (const instrucao of sql.split(';')) {
      const tabela = instrucao.match(/(?:CREATE TABLE(?: IF NOT EXISTS)?|ALTER TABLE)\s+"([A-Za-z0-9_]+)"/)?.[1]
      if (!tabela) continue
      for (const d of instrucao.matchAll(/DROP CONSTRAINT(?: IF EXISTS)?\s+"([A-Za-z0-9_]+)"/g)) vivas.delete(d[1])
      for (const m of instrucao.matchAll(RE_CHECK)) {
        const valores = [...m[3].matchAll(/'((?:[^']|'')*)'/g)].map((v) => v[1].replace(/''/g, "'"))
        if (valores.length) vivas.set(m[1], { tabela, nome: m[1], coluna: m[2], valores })
      }
    }
  }
  return [...vivas.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}

type Executor = { $executeRawUnsafe: (sql: string) => Promise<unknown>; $queryRawUnsafe: <T = unknown>(sql: string) => Promise<T> }

/** instala as CHECKs de lista como TRIGGER no SQLite de teste; devolve quantas instalou */
export async function instalarChecksNoSqlite(db: Executor, checks = checksDeListaDasMigrations()): Promise<number> {
  const tabelas = new Set((await db.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM sqlite_master WHERE type='table'`)).map((t) => t.name))
  let n = 0
  for (const c of checks) {
    if (!tabelas.has(c.tabela)) continue
    const lista = c.valores.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
    const quando = `NEW."${c.coluna}" IS NOT NULL AND NEW."${c.coluna}" NOT IN (${lista})`
    const erro = `SELECT RAISE(ABORT, 'violates check constraint "${c.nome}"')`
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${c.nome}__ins"`)
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${c.nome}__upd"`)
    await db.$executeRawUnsafe(`CREATE TRIGGER "${c.nome}__ins" BEFORE INSERT ON "${c.tabela}" WHEN ${quando} BEGIN ${erro}; END`)
    await db.$executeRawUnsafe(`CREATE TRIGGER "${c.nome}__upd" BEFORE UPDATE OF "${c.coluna}" ON "${c.tabela}" WHEN ${quando} BEGIN ${erro}; END`)
    n++
  }
  return n
}
