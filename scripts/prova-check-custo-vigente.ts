/**
 * ⚠️⚠️ REGRA 13 — CHECK NOVO SE PROVA CONTRA POSTGRES, NUNCA NA SUÍTE.
 *
 * CHECK **não existe no schema Prisma** (mora no SQL da migration), e o `db push` do dev cria
 * a tabela a partir do schema → **no SQLite o INSERT torto PASSA**, e isso não é o CHECK
 * falhando: é ele não existir ali. Então a prova é um script contra o banco real, que tenta o
 * INSERT torto e exige a recusa **pelo NOME da constraint**.
 *
 * ⚠️ Contabiliza a escrita (antes/depois) e usa `$transaction` com rollback forçado — zero
 * escrita líquida. Padrão de `scripts/prova-check-receita-principal.ts`.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

type Caso = { nome: string; constraint: string; sql: (id: string, item: string) => Promise<unknown> }

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const antes = await prisma.stockItemCustoVigente.count()
  const item = await prisma.stockItem.findFirstOrThrow({ where: { companyId: EMPRESA }, select: { id: true } })

  const ins = (companyId: string, itemId: string, custoMedio: string, movimentoId: string | null) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_item_custo_vigente" ("id","companyId","itemId","custoMedio","movimentoId","atualizadoEm")
       VALUES ($1,$2,$3,${custoMedio},$4, CURRENT_TIMESTAMP)`,
      `prova-${Math.round(custoMedio.length * 7 + companyId.length)}-${itemId.slice(0, 6)}-${custoMedio}`,
      companyId, itemId, movimentoId,
    )

  const tortos: Caso[] = [
    { nome: 'companyId VAZIO', constraint: 'chk_custo_vigente_forma', sql: (_i, it) => ins('', it, '0.54', null) },
    { nome: 'companyId SÓ-ESPAÇO', constraint: 'chk_custo_vigente_forma', sql: (_i, it) => ins('   ', it, '0.54', null) },
    { nome: 'itemId VAZIO', constraint: 'chk_custo_vigente_forma', sql: () => ins(EMPRESA, '', '0.54', null) },
    { nome: 'itemId SÓ-ESPAÇO', constraint: 'chk_custo_vigente_forma', sql: () => ins(EMPRESA, '  ', '0.54', null) },
    // ⛔ custo zero/negativo não é memória — é resquício do estado impossível (FANTA UVA)
    { nome: 'custoMedio ZERO', constraint: 'chk_custo_vigente_positivo', sql: (_i, it) => ins(EMPRESA, it, '0', null) },
    { nome: 'custoMedio NEGATIVO', constraint: 'chk_custo_vigente_positivo', sql: (_i, it) => ins(EMPRESA, it, '-2540.13', null) },
  ]

  console.log('\n═══ INSERTs TORTOS (cada um tem que ser recusado PELA CONSTRAINT CERTA) ═══')
  let okTortos = 0
  for (const c of tortos) {
    try {
      await prisma.$transaction(async (tx) => {
        await c.sql(EMPRESA, item.id)
        throw new Error('ROLLBACK')
      })
      console.log(`  ⛔ ${c.nome}: PASSOU (o CHECK não morde!)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('ROLLBACK')) {
        console.log(`  ⛔ ${c.nome}: PASSOU (o CHECK não morde!)`)
      } else if (msg.includes(c.constraint)) {
        console.log(`  ⭐ ${c.nome}: recusado por ${c.constraint}`)
        okTortos++
      } else {
        console.log(`  ⚠️ ${c.nome}: recusado, mas por OUTRA razão → ${msg.slice(0, 120)}`)
      }
    }
  }

  console.log('\n═══ LEGÍTIMOS (têm que ENTRAR) ═══')
  let okBons = 0
  const bons: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: 'custo 0,54 com rastro de movimento', run: async () => {
      const mov = await prisma.stockMovement.findFirst({ where: { companyId: EMPRESA }, select: { id: true } })
      return ins(EMPRESA, item.id, '0.54', mov?.id ?? null)
    } },
    // ⚠️ movimentoId NULL é o caso do BACKFILL: ele replaya a história inteira e não tem um
    //    movimento único pra apontar. O CHECK **não compara** a coluna nullable (REGRA 13).
    { nome: 'movimentoId NULL (o backfill)', run: () => ins(EMPRESA, item.id, '34', null) },
    { nome: 'custo com muitas casas (0,0003 — dose de fermento)', run: () => ins(EMPRESA, item.id, '0.0003', null) },
  ]
  for (const b of bons) {
    try {
      await prisma.$transaction(async () => { await b.run(); throw new Error('ROLLBACK') })
      console.log(`  ⛔ ${b.nome}: ??? (não deveria chegar aqui)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('ROLLBACK')) { console.log(`  ⭐ ${b.nome}: ACEITO`); okBons++ }
      else console.log(`  ⛔ ${b.nome}: RECUSADO → ${msg.slice(0, 140)}`)
    }
  }

  console.log('\n═══ UNIQUE (companyId, itemId) — aprender 2× é UPDATE, nunca 2ª linha ═══')
  let okUnique = false
  try {
    await prisma.$transaction(async () => {
      await ins(EMPRESA, item.id, '0.54', null)
      await ins(EMPRESA, item.id, '0.55', null)
      throw new Error('ROLLBACK')
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('ROLLBACK')) console.log('  ⛔ a 2ª linha PASSOU (o unique não morde!)')
    else { console.log(`  ⭐ a 2ª linha foi recusada → ${msg.match(/23505|unique/i)?.[0] ?? msg.slice(0, 80)}`); okUnique = true }
  }

  /**
   * ⭐⭐ O CONTRAFACTUAL DA REGRA 13, medido NO PRÓPRIO BANCO: a forma INGÊNUA do CHECK de
   * forma (sem `IS NOT NULL` explícito) devolve **NULL** sobre coluna nula — e **CHECK com
   * expressão NULL PASSA** (o furo do `chk_aviso_acao_completa`, 04/10).
   */
  console.log('\n═══ CONTRAFACTUAL (por que o IS NOT NULL explícito importa) ═══')
  const [c1] = await prisma.$queryRawUnsafe<{ ingenuo: boolean | null; nosso: boolean }[]>(
    `SELECT (length(trim(NULL)) > 0) AS ingenuo, (NULL IS NOT NULL AND length(trim(NULL)) > 0) AS nosso`,
  )
  console.log(`  forma INGÊNUA sobre NULL → ${c1.ingenuo === null ? 'NULL → o CHECK PASSARIA ⛔' : c1.ingenuo}`)
  console.log(`  forma COM IS NOT NULL    → ${c1.nosso} → RECUSA ⭐`)
  console.log('  ⚠️ aqui as 3 colunas comparadas são NOT NULL, então o furo não morde — e o')
  console.log('     script MEDE isso em vez de eu afirmar:')
  const cols = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string }[]>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_name = 'stock_item_custo_vigente' ORDER BY ordinal_position`,
  )
  for (const c of cols) console.log(`     ${c.column_name}: is_nullable=${c.is_nullable}`)

  const depois = await prisma.stockItemCustoVigente.count()
  console.log(`\n═══ ESCRITA ═══\n  memórias ${antes} → ${depois} ${antes === depois ? '⭐ ZERO ESCRITA LÍQUIDA' : '⛔ GRAVOU'}`)
  console.log(`\nRESULTADO: tortos recusados ${okTortos}/${tortos.length} · legítimos aceitos ${okBons}/${bons.length} · unique ${okUnique ? 'OK' : 'FALHOU'}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error('⛔', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
