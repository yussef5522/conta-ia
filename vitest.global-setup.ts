// ⭐ GLOBAL SETUP — roda UMA vez, antes e depois da suíte inteira (01/09/2026).
//
// ⚠️ Existe por um motivo só: a suíte deixava lixo no `dev.db` (663 empresas acumuladas
// até 01/09). Ele fotografa as empresas ANTES e remove, no fim, o que nasceu durante a
// rodada. Ver `lib/testing/limpar-residuo.ts` pro porquê isso vale mais que arrumação.
//
// ⚠️ NÃO substitui o `afterEach` de cada teste: limpar no fim da rodada não isola testes
// que rodam em PARALELO contra o mesmo banco. Isto é a rede de baixo — pega o que escapou
// (teste interrompido, `afterEach` que esqueceu uma tabela, crash no meio).

import { PrismaClient } from '@prisma/client'
import { fotografarEmpresas, limparResiduo } from './lib/testing/limpar-residuo'
import { instalarChecksNoSqlite } from './lib/testing/checks-do-postgres'

let antes: Set<string> = new Set()

export async function setup() {
  const db = new PrismaClient()
  try {
    antes = await fotografarEmpresas(db)
  } catch { /* sem banco disponível: o guard de banco já barra o que importa */ }
  /**
   * ⭐⭐ (13/11) AS CHECKs DE LISTA DO POSTGRES VIRAM TRIGGER NO SQLITE DE TESTE — sem isto a suíte
   * aceitava gravar o que prod recusa (o `ENCERRADA_ADMINISTRATIVAMENTE` passou verde e prod deu 23514).
   * ⛔ Falha aqui DERRUBA a rodada: rodar sem as CHECKs é voltar ao verde falso.
   */
  const ehSqlite = await db.$queryRawUnsafe('SELECT sqlite_version()').then(() => true, () => false)
  if (ehSqlite) {
    const n = await instalarChecksNoSqlite(db)
    if (n === 0) throw new Error('nenhuma CHECK do Postgres instalada no banco de teste — o verde falso voltaria')
  }
  await db.$disconnect().catch(() => {})
}

export async function teardown() {
  if (antes.size === 0) return
  const db = new PrismaClient()
  try {
    const r = await limparResiduo(db, antes)
    if (r.empresasRemovidas > 0 || r.orfasRemovidas > 0) {
      const orf = r.orfasRemovidas > 0 ? ` · ${r.orfasRemovidas} linhas ÓRFÃS (sem empresa)` : ''
      console.log(`\n🧹 resíduo da suíte removido: ${r.empresasRemovidas} empresas · ${r.linhasRemovidas} linhas${orf}`)
    }
  } catch { /* falha macia: limpeza nunca derruba o resultado dos testes */ }
  await db.$disconnect().catch(() => {})
}
