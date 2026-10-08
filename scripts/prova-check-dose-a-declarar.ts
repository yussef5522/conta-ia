/**
 * ⚠️ REGRA 13 — TODO CHECK NOVO NASCE COM PROVA DE INSERT TORTO CONTRA POSTGRES.
 *
 * ⛔ CHECK **não existe no schema Prisma** (mora no SQL da migration), e o `db push` do dev
 * cria a tabela a partir do schema → no SQLite o INSERT torto PASSA, e isso não é o CHECK
 * falhando: é ele não existir ali. Logo, a prova é script contra Postgres, nunca teste da
 * suíte.
 *
 * ⭐ ZERO ESCRITA LÍQUIDA: conta as linhas antes e depois e aborta se não voltar ao mesmo.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

type Caso = { nome: string; sql: string; args: unknown[]; esperaConstraint: string }

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const antes = await prisma.stockDoseADeclarar.count()
  console.log(`\nlinhas antes: ${antes}`)

  const ins = (id: string, ficha: string, item: string, motivo: string) => ({
    sql: `INSERT INTO "stock_dose_a_declarar" ("id","companyId","fichaId","itemId","motivo") VALUES ($1,$2,$3,$4,$5)`,
    args: [id, EMPRESA, ficha, item, motivo],
  })

  const tortos: Caso[] = [
    { nome: 'fichaId vazio', ...ins('p1', '', 'item-x', 'motivo ok'), esperaConstraint: 'chk_dose_declarar_ficha' },
    { nome: 'fichaId só espaço', ...ins('p2', '   ', 'item-x', 'motivo ok'), esperaConstraint: 'chk_dose_declarar_ficha' },
    { nome: 'itemId vazio', ...ins('p3', 'ficha-x', '', 'motivo ok'), esperaConstraint: 'chk_dose_declarar_item' },
    { nome: 'motivo vazio', ...ins('p4', 'ficha-x', 'item-x', ''), esperaConstraint: 'chk_dose_declarar_motivo' },
    { nome: 'motivo só espaço', ...ins('p5', 'ficha-x', 'item-x', '  '), esperaConstraint: 'chk_dose_declarar_motivo' },
  ]

  console.log('\n═══════ INSERTS TORTOS — o banco tem que RECUSAR ═══════')
  let recusados = 0
  for (const c of tortos) {
    try {
      await prisma.$executeRawUnsafe(c.sql, ...(c.args as string[]))
      console.log(`  ⛔⛔ ${c.nome} → PASSOU (o CHECK ${c.esperaConstraint} NÃO morde)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const ok = msg.includes(c.esperaConstraint)
      console.log(`  ${ok ? '✓' : '⚠️'} ${c.nome} → recusado${ok ? ` por ${c.esperaConstraint}` : ` mas por OUTRA razão: ${msg.slice(0, 120)}`}`)
      if (ok) recusados++
    }
  }

  console.log('\n═══════ O LEGÍTIMO TEM QUE ENTRAR (e sai depois) ═══════')
  let legitimoOk = false
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "stock_dose_a_declarar" ("id","companyId","fichaId","itemId","motivo") VALUES ($1,$2,$3,$4,$5)`,
      'prova-legitima',
      EMPRESA,
      'ficha-prova',
      'item-prova',
      'a dose é do dono',
    )
    legitimoOk = true
    console.log('  ✓ linha legítima ENTROU')
  } catch (e) {
    console.log(`  ⛔ linha legítima recusada: ${e instanceof Error ? e.message : e}`)
  }

  console.log('\n═══════ A MESMA PENDÊNCIA 2× É IMPOSSÍVEL ═══════')
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "stock_dose_a_declarar" ("id","companyId","fichaId","itemId","motivo") VALUES ($1,$2,$3,$4,$5)`,
      'prova-dup',
      EMPRESA,
      'ficha-prova',
      'item-prova',
      'a dose é do dono',
    )
    console.log('  ⛔⛔ a 2ª PASSOU — o índice único NÃO morde')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ✓ recusada (${msg.includes('stock_dose_a_declarar_key') || msg.includes('23505') ? 'índice único' : msg.slice(0, 100)})`)
  }

  // limpeza: a prova NÃO deixa linha
  if (legitimoOk) {
    await prisma.$executeRawUnsafe(`DELETE FROM "stock_dose_a_declarar" WHERE "id" = 'prova-legitima'`)
  }
  const depois = await prisma.stockDoseADeclarar.count()
  console.log(`\nlinhas depois: ${depois} ${depois === antes ? '⭐ ZERO ESCRITA LÍQUIDA' : '⛔ SOBROU LINHA'}`)
  console.log(`CHECKs que morderam: ${recusados} de ${tortos.length}\n`)
  if (depois !== antes) process.exit(1)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
