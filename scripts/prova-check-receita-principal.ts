/**
 * ⭐⭐⭐ A PROVA DO CHECK DA ESTRELA — contra POSTGRES REAL (12/10/2026).
 *
 * **REGRA 13 da casa:** ***todo CHECK novo nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele não existir ali.
 *
 * ⚠️ **E A REGRA 13 É SOBRE LÓGICA DE TRÊS VALORES — aqui ela NÃO morde, e o registro importa
 * pra ninguém achar que eu esqueci:** `companyId`/`fichaId` são **NOT NULL**, então
 * `length(trim(x)) > 0` nunca avalia pra NULL (o furo do `chk_aviso_acao_completa`, 04/10, era
 * comparar conteúdo de coluna NULLABLE). A **REDE 3** mede isso no próprio banco em vez de eu
 * afirmar — "é NOT NULL" é exatamente o tipo de premissa que envelhece quando alguém mexe no
 * schema.
 *
 * ⚠️ ZERO ESCRITA LÍQUIDA: os tortos são feitos pra FALHAR, os legítimos são apagados no fim, e
 * o script confere a contagem antes e depois — se sobrar, ele apaga e ACUSA.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-receita-principal.ts --empresa=<companyId>
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const ID = 'prova-estrela'
const CONSTRAINT = 'chk_receita_principal_forma'

async function main() {
  const empresaId = process.argv.slice(2).find((a) => a.startsWith('--empresa='))?.split('=')[1]
  if (!empresaId) {
    console.error('⛔ falta --empresa=<companyId>')
    process.exit(1)
  }
  /** ⛔ REGRA 8b — prova contra QUAL banco antes de medir (zero silencioso ≠ "não tem") */
  const nome = await exigirEmpresaNesteBanco(prisma, empresaId)
  console.log(`\n⭐ empresa: ${nome} (${empresaId})`)

  const antes = await prisma.stockReceitaPrincipal.count()
  console.log(`linhas ANTES: ${antes}`)

  const limpar = () => prisma.$executeRawUnsafe(`DELETE FROM "stock_receita_principal" WHERE "id" LIKE '${ID}%'`)
  await limpar()

  /** ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO — ela não pode passar por
   *  nenhuma validação nossa; é justamente o caminho "por fora da porta". */
  const insere = (sufixo: string, companyId: string, fichaId: string, principal = true) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_receita_principal" ("id","companyId","fichaId","principal","marcadoEm")
       VALUES ('${ID}-${sufixo}','${companyId}','${fichaId}',${principal},now())`,
    )

  console.log('\n── REDE 1: o BANCO recusa a forma torta ──')
  const tortos: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: 'companyId VAZIO', run: () => insere('t1', '', 'ficha-x') },
    { nome: 'companyId só ESPAÇO', run: () => insere('t2', '   ', 'ficha-x') },
    { nome: 'fichaId VAZIO', run: () => insere('t3', empresaId, '') },
    { nome: 'fichaId só ESPAÇO', run: () => insere('t4', empresaId, '  ') },
  ]
  let recusados = 0
  for (const t of tortos) {
    try {
      await t.run()
      console.log(`  ⛔⛔ ENTROU (o CHECK não bloqueou!): ${t.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const bateu = msg.includes(CONSTRAINT)
      console.log(`  ${bateu ? '✓' : '⚠️'} recusado${bateu ? '' : ` por OUTRO motivo — ${msg.slice(0, 120)}`}: ${t.nome}`)
      if (bateu) recusados++
    }
  }
  console.log(`  → ${recusados} de ${tortos.length} recusados pelo CHECK certo`)

  /**
   * ⭐⭐ REDE 2 — O LEGÍTIMO ENTRA. É o lado que falta em quase todo guard de trava: provar
   * que ela **não barra o certo**. ⚠️ E `principal = false` é caso legítimo de propósito: é o
   * rastro do DESMARCAR, que tem que caber no banco.
   */
  console.log('\n── REDE 2: o legítimo entra, inclusive o DESMARCADO ──')
  let entraram = 0
  const legitimos: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: 'marcada (principal = true)', run: () => insere('ok1', empresaId, 'ficha-aaa', true) },
    { nome: 'DESMARCADA com rastro (principal = false)', run: () => insere('ok2', empresaId, 'ficha-bbb', false) },
    { nome: 'sem autor (marcadoPorId NULL — dono do sistema não tem usuário)', run: () => insere('ok3', empresaId, 'ficha-ccc') },
  ]
  for (const l of legitimos) {
    try {
      await l.run()
      entraram++
      console.log(`  ✓ ENTROU: ${l.nome}`)
    } catch (e) {
      console.log(`  ⛔⛔ RECUSADO (o CHECK está estreito demais): ${l.nome} — ${(e as Error).message.slice(0, 160)}`)
    }
  }

  console.log('\n── REDE 2b: a MESMA receita 2× é recusada pelo índice único ──')
  let unicoMordeu = false
  try {
    await insere('dup', empresaId, 'ficha-aaa', false)
    console.log('  ⛔⛔ ENTROU — marcar 2× criou uma 2ª linha')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    unicoMordeu = msg.includes('23505') || /unique/i.test(msg)
    console.log(`  ${unicoMordeu ? '✓' : '⚠️'} recusado: 2ª linha da mesma (companyId, fichaId)`)
  }

  /**
   * ⭐⭐⭐ REDE 3 — O CONTRAFACTUAL DA REGRA 13, MEDIDO NO PRÓPRIO BANCO.
   *
   * Aqui o CHECK é seguro **porque as colunas são NOT NULL**. A rede mostra (a) o que o
   * Postgres responde pra `length(trim(NULL)) > 0` — a forma que furou em 04/10 —, e (b) que
   * as duas colunas comparadas REALMENTE são NOT NULL hoje.
   */
  console.log('\n── REDE 3: por que este CHECK é seguro (e o que furou em 04/10) ──')
  const [tres] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null }[]>(
    `SELECT (length(trim(NULL)) > 0) AS ingenua`,
  )
  console.log(`  a forma sobre NULL → ${tres.ingenua === null ? 'NULL → o CHECK PASSARIA (o furo de 04/10)' : tres.ingenua}`)

  const [nn] = await prisma.$queryRawUnsafe<{ empresa: string; ficha: string }[]>(
    `SELECT (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_receita_principal' AND column_name = 'companyId') AS empresa,
            (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_receita_principal' AND column_name = 'fichaId')   AS ficha`,
  )
  console.log(`  as colunas comparadas são nullable? companyId=${nn.empresa} · fichaId=${nn.ficha}`)

  const checks = await prisma.$queryRawUnsafe<{ conname: string }[]>(
    `SELECT conname FROM pg_constraint WHERE conrelid = 'stock_receita_principal'::regclass AND contype = 'c'`,
  )
  console.log(`  CHECKs vivos na tabela: ${checks.map((c) => c.conname).join(', ') || '(nenhum)'}`)

  console.log('\n── LIMPEZA: zero escrita líquida ──')
  await limpar()
  const depois = await prisma.stockReceitaPrincipal.count()
  console.log(`linhas DEPOIS: ${depois} (antes: ${antes})`)

  const ok =
    recusados === tortos.length &&
    entraram === legitimos.length &&
    unicoMordeu &&
    tres.ingenua === null &&
    nn.empresa === 'NO' &&
    nn.ficha === 'NO' &&
    depois === antes
  console.log(ok
    ? '\n⭐ PROVA OK — o CHECK morde a forma torta, o legítimo entra, o único morde, e nada sobrou.'
    : '\n⛔ PROVA FALHOU — ver acima.')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('⛔', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
