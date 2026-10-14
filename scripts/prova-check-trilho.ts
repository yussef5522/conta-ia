/**
 * ⭐⭐⭐ A PROVA DO CHECK DO TRILHO — contra POSTGRES REAL (14/10/2026).
 *
 * **REGRA 13 da casa:** ***todo CHECK novo nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele não existir ali.
 *
 * ⭐⭐ **E A REGRA 13 AQUI SE RESOLVE PELA AUSÊNCIA DE NULL, não por `IS NOT NULL` no CHECK.** A
 * coluna nasce `NOT NULL DEFAULT 'recolhido'`, então `"trilho" <> ''` **nunca vê NULL** e não há
 * lógica de três valores pra escapar. ⚠️ Se ela fosse nullable, `'' <> NULL` avaliaria pra
 * **NULL** e ***CHECK com expressão NULL PASSA*** — o furo exato do `chk_aviso_acao_completa`
 * (04/10). A **REDE 3** mede as duas coisas no próprio banco em vez de eu afirmar: que a coluna
 * É `NOT NULL` (premissa que envelhece quando alguém mexe no schema) e o CONTRAFACTUAL de a
 * forma ingênua sobre NULL devolver `NULL → PASSARIA`.
 *
 * ⚠️ ZERO ESCRITA LÍQUIDA: os tortos são feitos pra FALHAR, os legítimos são apagados no fim, e
 * o script confere a contagem antes e depois — se sobrar, ele apaga e ACUSA.
 *
 * ⛔ E ELE NÃO TOCA A LINHA DE NINGUÉM: o `userId` de prova tem prefixo próprio, e o DELETE
 * final filtra por ele. Rodar isto não pode mexer na preferência real de um usuário.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-trilho.ts
 */
import { prisma } from '../lib/db'

const ID = 'prova-trilho'
const CONSTRAINT_TRILHO = 'chk_user_trilho_forma'
const CONSTRAINT_TEMA = 'chk_user_tema_forma'

/** ⚠️ imprime contra QUAL banco a prova mediu — output sem esta linha não conclui nada (REGRA 8b) */
async function dizerOBanco() {
  const [{ db }] = await prisma.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db')
  console.log(`⭐ banco: ${db}`)
  if (!/prod|scratch|test/.test(db)) {
    console.error('⛔ banco inesperado — abortando pra não escrever em lugar desconhecido')
    process.exit(1)
  }
  return db
}

async function main() {
  await dizerOBanco()

  const antes = await prisma.userTemaPreferencia.count()
  console.log(`linhas ANTES: ${antes}`)

  const limpar = () =>
    prisma.$executeRawUnsafe(`DELETE FROM "user_tema_preferencia" WHERE "userId" LIKE '${ID}%'`)
  await limpar()

  /**
   * ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO — ela não pode passar por nenhuma
   * validação nossa; é justamente o caminho "por fora da porta". Se eu usasse o Prisma com o
   * tipo, o `normalizarTrilho` consertaria o lixo antes de ele chegar no CHECK, e o teste
   * provaria a MINHA função em vez da constraint.
   */
  const insere = (sufixo: string, tema: string, trilho: string) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "user_tema_preferencia" ("userId","tema","trilho","atualizadoEm")
       VALUES ('${ID}-${sufixo}','${tema}','${trilho}',now())`,
    )

  console.log('\n── REDE 1: o BANCO recusa a forma torta ──')
  const tortos: { nome: string; constraint: string; run: () => Promise<unknown> }[] = [
    { nome: 'trilho VAZIO', constraint: CONSTRAINT_TRILHO, run: () => insere('t1', 'claro', '') },
    { nome: 'trilho só ESPAÇO', constraint: CONSTRAINT_TRILHO, run: () => insere('t2', 'claro', '   ') },
    { nome: 'trilho em CAIXA ALTA', constraint: CONSTRAINT_TRILHO, run: () => insere('t3', 'claro', 'ABERTO') },
    { nome: 'trilho CapitalizadO', constraint: CONSTRAINT_TRILHO, run: () => insere('t4', 'claro', 'Recolhido') },
    /** ⚠️ o CHECK do TEMA tem que continuar mordendo — o ALTER de hoje não pode tê-lo afrouxado */
    { nome: 'tema VAZIO (o CHECK de 05/10 segue de pé)', constraint: CONSTRAINT_TEMA, run: () => insere('t5', '', 'aberto') },
    { nome: 'tema em CAIXA ALTA (idem)', constraint: CONSTRAINT_TEMA, run: () => insere('t6', 'ESCURO', 'aberto') },
    /**
     * ⭐⭐ O CASO QUE ESTA PROVA ACHOU EM PROD, dos DOIS lados (14/10). A 1ª rodada devolveu
     * **5 de 6** porque `"trilho" <> ''` é **true** pra `'   '` — a forma fraca só pega a string
     * vazia. O irmão do tema tem a mesma forma e o mesmo furo; os dois foram corrigidos na
     * migration `20261014160000` com `length(trim(...)) > 0`. **Os dois casos ficam aqui pra
     * sempre: foi o que a régua deixou passar.**
     */
    { nome: 'tema só ESPAÇO (o furo achado em prod)', constraint: CONSTRAINT_TEMA, run: () => insere('t7', '   ', 'aberto') },
  ]

  let recusados = 0
  for (const t of tortos) {
    try {
      await t.run()
      console.log(`  ⛔⛔ ACEITOU "${t.nome}" — o CHECK não morde!`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      /** ⛔ recusar NÃO BASTA: tem que ser a constraint CERTA. Recusado por outro motivo (FK,
       *  tipo, PK) daria selo verde sem o CHECK existir. */
      const pelaCerta = msg.includes(t.constraint)
      console.log(`  ${pelaCerta ? '⭐' : '⚠️'} recusou "${t.nome}"${pelaCerta ? ` pela ${t.constraint}` : ' — mas por OUTRO motivo!'}`)
      if (pelaCerta) recusados++
    }
  }
  console.log(`  → ${recusados} de ${tortos.length} recusados pela constraint certa`)

  console.log('\n── REDE 2: o legítimo ENTRA ──')
  const legitimos: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: "recolhido (o default)", run: () => insere('ok1', 'claro', 'recolhido') },
    { nome: 'aberto', run: () => insere('ok2', 'escuro', 'aberto') },
    /**
     * ⭐ O CASO QUE A COLUNA NOVA TORNA POSSÍVEL: linha ANTIGA, de quem escolheu tema antes de
     * 14/10 — o `ADD COLUMN ... DEFAULT` preenche sozinho, então ela não precisa declarar o
     * trilho. É o que faz a migration não exigir backfill.
     */
    {
      nome: 'linha SEM declarar trilho (o DEFAULT preenche — nada de backfill)',
      run: () =>
        prisma.$executeRawUnsafe(
          `INSERT INTO "user_tema_preferencia" ("userId","tema","atualizadoEm")
           VALUES ('${ID}-ok3','claro',now())`,
        ),
    },
  ]
  let aceitos = 0
  for (const l of legitimos) {
    try {
      await l.run()
      console.log(`  ⭐ aceitou "${l.nome}"`)
      aceitos++
    } catch (e) {
      console.log(`  ⛔⛔ RECUSOU o legítimo "${l.nome}": ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`  → ${aceitos} de ${legitimos.length} aceitos`)

  /** ⭐ e o DEFAULT que entrou tem que ser o MESMO da régua (`TRILHO_PADRAO`) */
  const semDeclarar = await prisma.$queryRawUnsafe<{ trilho: string }[]>(
    `SELECT "trilho" FROM "user_tema_preferencia" WHERE "userId" = '${ID}-ok3'`,
  )
  console.log(`  ⭐ a linha sem declarar nasceu com trilho = '${semDeclarar[0]?.trilho}' (esperado 'recolhido')`)

  console.log('\n── REDE 3: as premissas MEDIDAS no próprio banco ──')
  const colunas = await prisma.$queryRawUnsafe<{ column_name: string; is_nullable: string; column_default: string | null }[]>(
    `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_name = 'user_tema_preferencia' AND column_name IN ('tema','trilho')`,
  )
  for (const c of colunas) {
    const ok = c.is_nullable === 'NO'
    console.log(
      `  ${ok ? '⭐' : '⛔⛔'} ${c.column_name}: is_nullable=${c.is_nullable} default=${c.column_default ?? '(nenhum)'}`,
    )
    if (!ok) {
      console.log(
        `     ⛔⛔ ${c.column_name} virou NULLABLE — o CHECK de forma passa a ter lógica de TRÊS`,
      )
      console.log(`        valores e o torto PASSA. Veja o contrafactual abaixo e a REGRA 13.`)
    }
  }

  /**
   * ⭐⭐ O CONTRAFACTUAL, medido no PRÓPRIO Postgres — a lição de 04/10 virando número em vez
   * de afirmação minha: a forma ingênua sobre NULL devolve **NULL**, e `CHECK` com expressão
   * NULL **PASSA**.
   */
  const [tres] = await prisma.$queryRawUnsafe<
    { ingenua: boolean | null; passaria: boolean; explicita: boolean }[]
  >(
    `SELECT (NULL::text <> '') AS ingenua,
            (CASE WHEN (NULL::text <> '') THEN false ELSE true END) AS passaria,
            (NULL::text IS NOT NULL AND NULL::text <> '') AS explicita`,
  )
  console.log(
    `  ⭐ contrafactual: forma INGÊNUA sobre NULL → ${tres.ingenua === null ? 'NULL' : tres.ingenua}` +
      ` ⇒ o CHECK ${tres.passaria ? 'PASSARIA' : 'recusaria'} · forma EXPLÍCITA → ${tres.explicita} ⇒ RECUSA`,
  )
  console.log(
    `  ⚠️ aqui a ingênua BASTA porque a coluna é NOT NULL — se ela virar nullable, este CHECK`,
  )
  console.log(`     passa a precisar do \`IS NOT NULL\` explícito e antes.`)

  console.log('\n── REDE 4: as constraints existem de verdade ──')
  const cons = await prisma.$queryRawUnsafe<{ conname: string }[]>(
    `SELECT conname FROM pg_constraint
      WHERE conrelid = 'user_tema_preferencia'::regclass AND contype = 'c'
      ORDER BY conname`,
  )
  console.log(`  CHECKs na tabela: ${cons.map((c) => c.conname).join(', ') || '(nenhum)'}`)
  for (const esperada of [CONSTRAINT_TEMA, CONSTRAINT_TRILHO]) {
    const tem = cons.some((c) => c.conname === esperada)
    console.log(`  ${tem ? '⭐' : '⛔⛔'} ${esperada}`)
  }

  console.log('\n── LIMPEZA ──')
  await limpar()
  const depois = await prisma.userTemaPreferencia.count()
  console.log(`linhas DEPOIS: ${depois}`)
  console.log(
    depois === antes
      ? '⭐ ZERO ESCRITA LÍQUIDA — como encontrou'
      : `⛔⛔ SOBROU DADO: ${depois - antes} linha(s) — investigar`,
  )
}

main()
  .catch((e) => {
    console.error('⛔ falhou:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
