/**
 * ⛔⛔⛔ REGRA 13 — A PROVA DOS CHECKS NOVOS CONTRA POSTGRES (07/10/2026).
 *
 * **Por que um SCRIPT e não um teste da suíte:** CHECK **não existe no schema Prisma** (ele
 * mora no SQL da migration), e o `db push` do dev cria a tabela a partir do schema → **no
 * SQLite o INSERT torto PASSA**, e isso não é o CHECK falhando, é ele não existir ali. Foi
 * exatamente assim que o `chk_aviso_acao_completa` nasceu furado em 04/10.
 *
 * ⛔ **ZERO ESCRITA:** tudo roda dentro de uma `$transaction` com rollback forçado, e o script
 * confere a contagem antes e depois.
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const CO = 'cmq17yapb00gnrndlh33sctbo'

interface Caso {
  nome: string
  sql: string
  /** `null` = tem que ACEITAR; string = tem que ser recusado POR ESTA constraint */
  recusaPor: string | null
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`\n⭐ empresa: ${nome}`)

  const antes = {
    categorias: await prisma.custoFixoCategoria.count(),
    chips: await prisma.custoFixoChips.count(),
  }
  console.log(`\nANTES → marcações ${antes.categorias} · chips ${antes.chips}`)

  /**
   * ⚠️⚠️ **CATEGORIAS DISTINTAS PRA CADA CASO LEGÍTIMO, e isso me mordeu na 1ª rodada:** os
   * três legítimos usavam a MESMA `(companyId, categoryId)` e o `@@unique` recusou o 2º e o
   * 3º — o script reportou *"RECUSOU E NÃO DEVIA"* sobre um CHECK que estava certo. **Prova
   * mal montada acusa o código inocente.**
   */
  const cats = await prisma.category.findMany({
    where: { companyId: CO, type: 'EXPENSE' },
    select: { id: true, name: true },
    take: 6,
    orderBy: { name: 'asc' },
  })
  if (cats.length < 6) throw new Error('preciso de 6 categorias de despesa pra montar a prova')
  const cat = cats[0]
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } })
  const rnd = (n: number) => `provav2_${n}`

  const casos: Caso[] = [
    // ─────────── chk_custo_fixo_prateleira_forma ───────────
    {
      nome: 'prateleira em MINÚSCULA ("banco")',
      sql: `INSERT INTO "custo_fixo_categoria" ("id","companyId","categoryId","marcadoEm","prateleira")
            VALUES ('${rnd(1)}','${CO}','${cat.id}',now(),'banco')`,
      recusaPor: 'chk_custo_fixo_prateleira_forma',
    },
    {
      nome: 'prateleira VAZIA ("   ")',
      sql: `INSERT INTO "custo_fixo_categoria" ("id","companyId","categoryId","marcadoEm","prateleira")
            VALUES ('${rnd(2)}','${CO}','${cat.id}',now(),'   ')`,
      recusaPor: 'chk_custo_fixo_prateleira_forma',
    },
    // ─────────── chk_custo_fixo_prateleira_rastro (a REGRA 13) ───────────
    {
      nome: 'rastro PELA METADE: quem mudou sem QUANDO',
      sql: `INSERT INTO "custo_fixo_categoria"
              ("id","companyId","categoryId","marcadoEm","prateleira","prateleiraDefinidaPorId")
            VALUES ('${rnd(3)}','${CO}','${cat.id}',now(),'BANCO','${user.id}')`,
      recusaPor: 'chk_custo_fixo_prateleira_rastro',
    },
    {
      nome: 'rastro PELA METADE: quando sem QUEM',
      sql: `INSERT INTO "custo_fixo_categoria"
              ("id","companyId","categoryId","marcadoEm","prateleira","prateleiraDefinidaEm")
            VALUES ('${rnd(4)}','${CO}','${cat.id}',now(),'BANCO',now())`,
      recusaPor: 'chk_custo_fixo_prateleira_rastro',
    },
    {
      nome: 'rastro com QUEM em branco (o caso que a forma ingênua deixaria passar)',
      sql: `INSERT INTO "custo_fixo_categoria"
              ("id","companyId","categoryId","marcadoEm","prateleira","prateleiraDefinidaPorId","prateleiraDefinidaEm")
            VALUES ('${rnd(5)}','${CO}','${cat.id}',now(),'BANCO','  ',now())`,
      recusaPor: 'chk_custo_fixo_prateleira_rastro',
    },
    // ─────────── os LEGÍTIMOS têm que PASSAR ───────────
    {
      nome: 'LEGÍTIMO: BANCO com rastro completo',
      sql: `INSERT INTO "custo_fixo_categoria"
              ("id","companyId","categoryId","marcadoEm","prateleira","prateleiraDefinidaPorId","prateleiraDefinidaEm")
            VALUES ('${rnd(6)}','${CO}','${cats[1].id}',now(),'BANCO','${user.id}',now())`,
      recusaPor: null,
    },
    {
      nome: 'LEGÍTIMO: CASA sem rastro (nunca foi movida — é o default)',
      sql: `INSERT INTO "custo_fixo_categoria" ("id","companyId","categoryId","marcadoEm","prateleira")
            VALUES ('${rnd(7)}','${CO}','${cats[2].id}',now(),'CASA')`,
      recusaPor: null,
    },
    /**
     * ⭐⭐ A LIÇÃO DE 21/09 PROVADA: o CHECK **não é vocabulário fechado**. Uma prateleira
     * nova (maiúscula, não-vazia) ENTRA sem migration — o banco valida FORMA, e quem decide o
     * vocabulário é o TypeScript. Se este caso fosse RECUSADO, o CHECK teria virado parede.
     */
    {
      nome: '⭐ PRATELEIRA NOVA ("COFRE") entra — o banco não guarda vocabulário',
      sql: `INSERT INTO "custo_fixo_categoria" ("id","companyId","categoryId","marcadoEm","prateleira")
            VALUES ('${rnd(8)}','${CO}','${cats[3].id}',now(),'COFRE')`,
      recusaPor: null,
    },
    // ─────────── o unique dos chips ───────────
    {
      nome: 'LEGÍTIMO: chips do usuário',
      sql: `INSERT INTO "custo_fixo_chips" ("id","companyId","userId","casa","banco","compromissos","atualizadoEm")
            VALUES ('${rnd(9)}','${CO}','${user.id}',true,false,true,now())`,
      recusaPor: null,
    },
    {
      nome: 'chips DUPLICADO pro mesmo (empresa, usuário)',
      sql: `INSERT INTO "custo_fixo_chips" ("id","companyId","userId","casa","banco","compromissos","atualizadoEm")
            VALUES ('${rnd(10)}','${CO}','${user.id}',false,false,false,now())`,
      /**
       * ⚠️ O erro cru do Prisma mostra as COLUNAS da chave (`Key ("companyId","userId")=…`),
       * **não** o nome do índice — casar pelo nome deu *"recusado pela constraint ERRADA"*
       * sobre o índice certo na 1ª rodada.
       */
      recusaPor: 'Key ("companyId", "userId")',
    },
  ]

  let ok = 0
  let falhou = 0

  await prisma
    .$transaction(async (tx) => {
      for (const c of casos) {
        // ⚠️ SAVEPOINT por caso: sem ele o 1º erro aborta a transação inteira no Postgres
        await tx.$executeRawUnsafe('SAVEPOINT sp')
        try {
          await tx.$executeRawUnsafe(c.sql)
          if (c.recusaPor == null) {
            console.log(`   ✓ ACEITO (certo)   ${c.nome}`)
            ok++
          } else {
            console.log(`   ⛔ PASSOU E NÃO DEVIA  ${c.nome}  (esperava ${c.recusaPor})`)
            falhou++
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp')
          }
        } catch (e) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp')
          const msg = String((e as Error).message)
          if (c.recusaPor == null) {
            console.log(`   ⛔ RECUSOU E NÃO DEVIA  ${c.nome}\n      ${msg.slice(0, 160)}`)
            falhou++
          } else if (msg.includes(c.recusaPor)) {
            console.log(`   ✓ RECUSADO por ${c.recusaPor}   ${c.nome}`)
            ok++
          } else {
            console.log(`   ⚠️ recusado pela constraint ERRADA  ${c.nome}\n      ${msg.slice(0, 200)}`)
            falhou++
          }
        }
      }

      /**
       * ⭐⭐ O CONTRAFACTUAL, MEDIDO NO PRÓPRIO POSTGRES — a lógica de três valores.
       *
       * A forma INGÊNUA do CHECK do rastro (sem o `IS NOT NULL` explícito) devolve **NULL**
       * pro caso "quem preenchido, quando NULL" — e **CHECK com expressão NULL PASSA**. É o
       * furo exato do `chk_aviso_acao_completa` de 04/10.
       */
      const [r] = await tx.$queryRawUnsafe<{ ingenuo: boolean | null; nosso: boolean | null }[]>(`
        SELECT
          (('x' IS NULL AND NULL IS NULL) OR (length(trim('x')) > 0 AND length(trim(NULL)) > 0)) AS ingenuo,
          (('x' IS NULL AND NULL IS NULL)
            OR ('x' IS NOT NULL AND NULL IS NOT NULL AND length(trim('x')) > 0)) AS nosso
      `)
      console.log('\n⭐⭐ CONTRAFACTUAL DA LÓGICA DE TRÊS VALORES (medido no Postgres):')
      console.log(`   CHECK INGÊNUO  → ${r.ingenuo === null ? 'NULL → **PASSARIA**' : r.ingenuo}`)
      console.log(`   CHECK NOSSO    → ${r.nosso === null ? 'NULL (ruim!)' : r.nosso} → ${r.nosso === false ? 'RECUSA ✓' : 'ATENÇÃO'}`)
      if (r.ingenuo !== null) falhou++
      if (r.nosso !== false) falhou++

      throw new Error('ROLLBACK_PROPOSITAL')
    })
    .catch((e) => {
      if (!String((e as Error).message).includes('ROLLBACK_PROPOSITAL')) throw e
    })

  const depois = {
    categorias: await prisma.custoFixoCategoria.count(),
    chips: await prisma.custoFixoChips.count(),
  }
  console.log(`\nDEPOIS → marcações ${depois.categorias} · chips ${depois.chips}`)
  const intacto = antes.categorias === depois.categorias && antes.chips === depois.chips
  console.log(`⛔ ZERO ESCRITA: ${intacto ? '✓ confirmado' : '⚠️ MUDOU — investigar'}`)
  console.log(`\n${falhou === 0 && intacto ? '⭐ PROVA OK' : '⛔ PROVA FALHOU'} — ${ok} corretos, ${falhou} problemas`)
  if (falhou > 0 || !intacto) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error('⛔', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
