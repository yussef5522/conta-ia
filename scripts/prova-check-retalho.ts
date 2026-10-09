/**
 * ⚠️ REGRA 13 — TODO CHECK NOVO NASCE COM PROVA DE INSERT TORTO CONTRA POSTGRES.
 *
 * ⛔ CHECK **não existe no schema Prisma** (mora no SQL da migration), e o `db push` do dev cria
 * a tabela a partir do schema → no SQLite o INSERT torto PASSA, e isso não é o CHECK falhando:
 * é ele não existir ali. Logo, a prova é script contra Postgres, nunca teste da suíte.
 *
 * ⭐⭐ O CASO QUE MAIS IMPORTA AQUI É O **PESO ZERO**: ele é DIVISOR do bônus
 * (`retalho_kg × 1000 ÷ pesoUnidadeG`). Com zero, o bônus viraria **Infinity** — e um
 * *"o material dava infinito"* **calaria o fiscal pra sempre**, que é o oposto do que o retalho
 * veio fazer. A lib já devolve `null` nesse caso; o CHECK é o que torna a linha impossível.
 *
 * ⭐ ZERO ESCRITA LÍQUIDA: conta as linhas antes e depois e aborta se não voltar ao mesmo.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

type Caso = { nome: string; sql: string; args: unknown[]; esperaConstraint: string }

const CFG =
  `INSERT INTO "stock_ficha_retalho" ("id","companyId","fichaId","aceitaRetalho","pesoUnidadeG") ` +
  `VALUES ($1,$2,$3,$4,$5)`
const ORD =
  `INSERT INTO "stock_ordem_retalho" ("id","companyId","ordemId","kg") VALUES ($1,$2,$3,$4)`

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const antes = {
    cfg: await prisma.stockFichaRetalho.count(),
    ord: await prisma.stockOrdemRetalho.count(),
  }
  console.log(`\nlinhas antes: config ${antes.cfg} · retalho de ordem ${antes.ord}`)

  const tortos: Caso[] = [
    {
      nome: '⭐⭐ PESO ZERO (o divisor do bônus — daria Infinity e calaria o fiscal)',
      sql: CFG, args: ['pr1', EMPRESA, 'ficha-1', true, 0],
      esperaConstraint: 'chk_ficha_retalho_peso',
    },
    {
      nome: 'peso NEGATIVO (bônus negativo APERTARIA o teto em silêncio)',
      sql: CFG, args: ['pr2', EMPRESA, 'ficha-1', true, -200],
      esperaConstraint: 'chk_ficha_retalho_peso',
    },
    {
      nome: 'ficha em branco (config órfã que nenhuma receita lê)',
      sql: CFG, args: ['pr3', EMPRESA, '   ', true, 200],
      esperaConstraint: 'chk_ficha_retalho_ficha',
    },
    {
      nome: '⭐ retalho ZERO (ausência é a resposta "não tem" — linha de 0 é fato sem consequência)',
      sql: ORD, args: ['pr4', EMPRESA, 'ordem-1', 0],
      esperaConstraint: 'chk_ordem_retalho_kg',
    },
    {
      nome: 'retalho NEGATIVO',
      sql: ORD, args: ['pr5', EMPRESA, 'ordem-1', -9.2],
      esperaConstraint: 'chk_ordem_retalho_kg',
    },
    {
      nome: 'ordem em branco (retalho que não pertence a lote nenhum)',
      sql: ORD, args: ['pr6', EMPRESA, '  ', 9.2],
      esperaConstraint: 'chk_ordem_retalho_ordem',
    },
  ]

  console.log('\n═══════ OS TORTOS TÊM QUE SER RECUSADOS ═══════')
  let okTortos = 0
  for (const c of tortos) {
    try {
      await prisma.$executeRawUnsafe(c.sql, ...c.args)
      console.log(`  ⛔⛔ PASSOU (DEFEITO!): ${c.nome}`)
      await prisma.$executeRawUnsafe(`DELETE FROM "stock_ficha_retalho" WHERE "id" = $1`, c.args[0])
      await prisma.$executeRawUnsafe(`DELETE FROM "stock_ordem_retalho" WHERE "id" = $1`, c.args[0])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const pelaCerta = msg.includes(c.esperaConstraint)
      console.log(`  ${pelaCerta ? '✓' : '⚠️'} ${c.nome} → recusado por ${pelaCerta ? c.esperaConstraint : `OUTRA: ${msg.slice(0, 110)}`}`)
      if (pelaCerta) okTortos++
    }
  }

  const legitimos: { nome: string; sql: string; args: unknown[] }[] = [
    {
      nome: '⭐ a config real: a metade pesa 200 g (declaração do dono)',
      sql: CFG, args: ['pr-ok-1', EMPRESA, 'ficha-ok', true, 200],
    },
    {
      nome: '⚠️ config DESLIGADA com o peso guardado (o interruptor sem apagar a declaração)',
      sql: CFG, args: ['pr-ok-2', EMPRESA, 'ficha-ok-2', false, 200],
    },
    {
      nome: '⭐ o caso real: 9,2 kg de retalho numa ordem',
      sql: ORD, args: ['pr-ok-3', EMPRESA, 'ordem-ok', 9.2],
    },
    {
      nome: '⚠️ retalho FRACIONADO de 0,25 kg (a balança mede grama)',
      sql: ORD, args: ['pr-ok-4', EMPRESA, 'ordem-ok-2', 0.25],
    },
  ]

  console.log('\n═══════ OS LEGÍTIMOS TÊM QUE ENTRAR (e saem depois) ═══════')
  let okLegit = 0
  for (const c of legitimos) {
    try {
      await prisma.$executeRawUnsafe(c.sql, ...c.args)
      console.log(`  ✓ ${c.nome} → ENTROU`)
      okLegit++
    } catch (e) {
      console.log(`  ⛔⛔ RECUSADO (DEFEITO!): ${c.nome} — ${(e instanceof Error ? e.message : '').slice(0, 140)}`)
    }
  }

  console.log('\n═══════ UMA CONFIG POR FICHA · UM RETALHO POR ORDEM ═══════')
  for (const [rot, sql, args] of [
    ['2ª config pra a MESMA ficha', CFG, ['pr-dup-1', EMPRESA, 'ficha-ok', true, 300]],
    ['2º retalho pra a MESMA ordem', ORD, ['pr-dup-2', EMPRESA, 'ordem-ok', 1]],
  ] as [string, string, unknown[]][]) {
    try {
      await prisma.$executeRawUnsafe(sql, ...args)
      console.log(`  ⛔⛔ ${rot}: PASSOU (DEFEITO!)`)
      await prisma.$executeRawUnsafe(`DELETE FROM "stock_ficha_retalho" WHERE "id" = $1`, args[0])
      await prisma.$executeRawUnsafe(`DELETE FROM "stock_ordem_retalho" WHERE "id" = $1`, args[0])
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      console.log(`  ✓ ${rot}: RECUSADO (${m.includes('23505') || m.includes('nique') ? '23505, chave única' : m.slice(0, 70)})`)
    }
  }

  console.log('\n═══════ CONTRAFACTUAL — a forma INGÊNUA do CHECK, medida no banco ═══════')
  const [t] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean | null }[]>(
    `SELECT (0 >= 0) AS ingenua, (0 > 0) AS nossa`,
  )
  console.log(`  a forma INGÊNUA (peso >= 0) sobre ZERO: ${t.ingenua} → o CHECK PASSARIA`)
  console.log(`  a NOSSA (peso > 0) sobre ZERO:          ${t.nossa} → RECUSA`)
  const [d] = await prisma.$queryRawUnsafe<{ bonus: string }[]>(
    `SELECT (9.2 * 1000 / NULLIF(0,0))::text AS bonus`,
  )
  console.log(`  e o bônus com peso zero seria: ${d.bonus ?? 'NULL/indefinido'} — "o material dava infinito"`)

  console.log('\n═══════ LIMPEZA — zero escrita líquida ═══════')
  await prisma.$executeRawUnsafe(`DELETE FROM "stock_ficha_retalho" WHERE "id" LIKE 'pr%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "stock_ordem_retalho" WHERE "id" LIKE 'pr%'`)
  const depois = {
    cfg: await prisma.stockFichaRetalho.count(),
    ord: await prisma.stockOrdemRetalho.count(),
  }
  console.log(`linhas depois: config ${depois.cfg} · retalho de ordem ${depois.ord}`)

  const ok = okTortos === tortos.length && okLegit === legitimos.length
    && depois.cfg === antes.cfg && depois.ord === antes.ord
  console.log(
    ok
      ? `\n⭐ PROVA OK — ${okTortos}/${tortos.length} tortos recusados · ${okLegit}/${legitimos.length} legítimos aceitos · escrita líquida 0`
      : `\n⛔ PROVA FALHOU — tortos ${okTortos}/${tortos.length} · legítimos ${okLegit}/${legitimos.length} · linhas ${JSON.stringify(antes)}→${JSON.stringify(depois)}`,
  )
  await prisma.$disconnect()
  if (!ok) process.exit(1)
}

main().catch((e) => { console.error('[prova] erro:', e instanceof Error ? e.message : e); process.exit(1) })
