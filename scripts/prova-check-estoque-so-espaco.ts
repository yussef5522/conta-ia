/**
 * ⭐⭐⭐ A PROVA DO TRIGGER DO "SÓ-ESPAÇO" — contra POSTGRES REAL (14/10/2026).
 *
 * **REGRA 13 da casa:** ***todo CHECK/trigger novo nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** trigger **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o trigger falhando: é ele não existir ali. (A suíte
 * prova a trava da PORTA, em `lib/stock/__tests__/so-espaco-nao-passa.integration.test.ts`.)
 *
 * ⭐⭐ **E A REGRA 13 AQUI SE RESOLVE POR `IS NULL` EXPLÍCITO, não pela ausência de NULL.** As duas
 * colunas nascem `NOT NULL`, então hoje o ramo do NULL é redundante — a REDE 3 abaixo **mede** as
 * duas coisas no próprio banco em vez de eu afirmar: que as colunas SÃO `NOT NULL` (premissa que
 * envelhece quando alguém mexe no schema) e o CONTRAFACTUAL de `length(trim(NULL))` devolver
 * **NULL → o CHECK PASSARIA**.
 *
 * ⚠️ ZERO ESCRITA LÍQUIDA: os tortos são feitos pra FALHAR, os legítimos são apagados no fim, e o
 * script confere a contagem antes e depois — se sobrar, ele apaga e ACUSA.
 *
 * ⛔ E ELE NÃO TOCA DADO DE NINGUÉM: cria uma empresa própria com CNPJ de prova e apaga no fim.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-estoque-so-espaco.ts
 */
import { prisma } from '../lib/db'

const CNPJ = '93939393000193'
const TRIGGER_RADAR = 'TEXTO DE ESCOLHA'
const TRIGGER_NOME = 'TEXTO DE ESCOLHA'

/** ⚠️ imprime contra QUAL banco a prova mediu — output sem esta linha não conclui nada (REGRA 8b) */
async function dizerOBanco() {
  const [{ db }] = await prisma.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db')
  console.log(`⭐ banco: ${db}`)
  if (!/prod|scratch|test/.test(db)) {
    console.error('⛔ banco inesperado — abortando pra não escrever em lugar desconhecido')
    process.exit(1)
  }
}

async function main() {
  await dizerOBanco()

  const antesRadar = await prisma.stockRadarItem.count()
  const antesIgn = await prisma.stockVendaIgnorado.count()
  console.log(`linhas ANTES: radar=${antesRadar} ignorado=${antesIgn}`)

  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'prova só-espaço', cnpj: CNPJ } })
  const item = await prisma.stockItem.create({
    data: { companyId: co.id, nome: 'ITEM DE PROVA', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' },
  })

  const limpar = async () => {
    await prisma.stockRadarItem.deleteMany({ where: { companyId: co.id } })
    await prisma.stockVendaIgnorado.deleteMany({ where: { companyId: co.id } })
    await prisma.stockItem.deleteMany({ where: { companyId: co.id } })
    await prisma.company.deleteMany({ where: { id: co.id } })
  }

  /**
   * ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO — ela não pode passar por nenhuma
   * validação nossa; é justamente o caminho "por fora da porta". Se eu usasse o Prisma com o
   * tipo, o `exigirEscolha` barraria o lixo antes de ele chegar no trigger, e o teste provaria a
   * MINHA função em vez da camada 1.
   */
  const insereRadar = (sufixo: string, lista: string) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_radar_item" ("id","companyId","lista","itemId","criadoEm")
       VALUES ('prova-${sufixo}','${co.id}','${lista}','${item.id}',now())`,
    )
  const insereIgnorado = (sufixo: string, nome: string) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_venda_ignorado" ("id","companyId","nomeSuitable","criadoEm")
       VALUES ('prova-${sufixo}','${co.id}','${nome}',now())`,
    )

  console.log('\n── REDE 1: o BANCO recusa o SÓ-ESPAÇO (o furo que o CHECK deixava passar) ──')
  const tortos: { nome: string; esperado: string; run: () => Promise<unknown> }[] = [
    { nome: 'radar · lista só ESPAÇO', esperado: TRIGGER_RADAR, run: () => insereRadar('r1', '   ') },
    { nome: 'radar · lista VAZIA', esperado: TRIGGER_RADAR, run: () => insereRadar('r2', '') },
    { nome: 'radar · lista TAB', esperado: TRIGGER_RADAR, run: () => insereRadar('r3', '\t') },
    { nome: 'ignorado · nome só ESPAÇO', esperado: TRIGGER_NOME, run: () => insereIgnorado('i1', '   ') },
    { nome: 'ignorado · nome VAZIO', esperado: TRIGGER_NOME, run: () => insereIgnorado('i2', '') },
    { nome: 'ignorado · nome TAB', esperado: TRIGGER_NOME, run: () => insereIgnorado('i3', '\t') },
    /**
     * ⭐⭐ O CASO QUE ISOLA O TRIGGER DO CHECK VELHO: o `''` já era recusado pelo CHECK de
     * origem; **o `'   '` NÃO era, e é o defeito deste sprint**. Os dois ficam aqui — o vazio
     * prova que o CHECK antigo segue de pé, e o espaço prova que a camada nova morde.
     */
    { nome: 'radar · UPDATE pra só-espaço (corrigir PRA torto)', esperado: TRIGGER_RADAR, run: async () => {
      await insereRadar('r9', 'REVENDA')
      return prisma.$executeRawUnsafe(`UPDATE "stock_radar_item" SET "lista" = '  ' WHERE "id" = 'prova-r9'`)
    } },
  ]

  let recusados = 0
  for (const t of tortos) {
    try {
      await t.run()
      console.log(`  ⛔⛔ ACEITOU "${t.nome}" — a armadura não morde!`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      /** ⛔ recusar NÃO BASTA: tem que ser pela razão CERTA. Recusado por FK/PK daria selo verde
       *  sem o trigger existir. */
      const pelaCerta = msg.includes(t.esperado)
      console.log(
        `  ${pelaCerta ? '⭐' : '⚠️'} recusou "${t.nome}"${pelaCerta ? '' : ' — mas por OUTRO motivo!'}`,
      )
      if (!pelaCerta) console.log(`      ${msg.split('\n')[0].slice(0, 160)}`)
      if (pelaCerta) recusados++
    }
  }
  console.log(`  → ${recusados} de ${tortos.length} recusados pela razão certa`)

  console.log('\n── REDE 2: o legítimo ENTRA (a armadura não virou parede) ──')
  const legitimos: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: 'radar · REVENDA', run: () => insereRadar('ok1', 'REVENDA') },
    { nome: 'radar · CAROS', run: () => insereRadar('ok2', 'CAROS') },
    /** ⭐ o caso NORMAL do PDV: espaço NO MEIO é nome de verdade, e tem que passar */
    { nome: 'ignorado · "COCA COLA 2L" (espaço no MEIO)', run: () => insereIgnorado('ok3', 'COCA COLA 2L') },
    { nome: 'ignorado · "MILKSHAKE SABOR PACOCA"', run: () => insereIgnorado('ok4', 'MILKSHAKE SABOR PACOCA') },
  ]
  let aceitos = 0
  for (const l of legitimos) {
    try {
      await l.run()
      console.log(`  ⭐ aceitou "${l.nome}"`)
      aceitos++
    } catch (e) {
      console.log(`  ⛔⛔ RECUSOU o legítimo "${l.nome}": ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
  }
  console.log(`  → ${aceitos} de ${legitimos.length} aceitos`)

  console.log('\n── REDE 3: as premissas MEDIDAS no próprio banco ──')
  const colunas = await prisma.$queryRawUnsafe<
    { table_name: string; column_name: string; is_nullable: string }[]
  >(
    `SELECT table_name, column_name, is_nullable
       FROM information_schema.columns
      WHERE (table_name = 'stock_radar_item'     AND column_name = 'lista')
         OR (table_name = 'stock_venda_ignorado' AND column_name = 'nomeSuitable')`,
  )
  for (const c of colunas) {
    const ok = c.is_nullable === 'NO'
    console.log(`  ${ok ? '⭐' : '⛔⛔'} ${c.table_name}.${c.column_name}: is_nullable=${c.is_nullable}`)
    if (!ok) {
      console.log('     ⛔⛔ virou NULLABLE — e aí o ramo do `IS NULL` do trigger DEIXA DE SER')
      console.log('        redundante: é ele que impede o torto de passar (ver contrafactual).')
    }
  }

  /**
   * ⭐⭐ O CONTRAFACTUAL, medido no PRÓPRIO Postgres — a lição de 04/10 virando número em vez de
   * afirmação minha: `length(trim(NULL))` devolve **NULL**, e CHECK com expressão NULL **PASSA**.
   */
  const [tres] = await prisma.$queryRawUnsafe<
    { ingenua: boolean | null; espaco_passa: boolean; forte: boolean }[]
  >(
    `SELECT (length(trim(NULL::text)) > 0) AS ingenua,
            ('   ' <> '')                  AS espaco_passa,
            (length(trim('   ')) > 0)      AS forte`,
  )
  console.log(
    `  ⭐ contrafactual NULL: \`length(trim(NULL))>0\` → ${tres.ingenua === null ? 'NULL' : tres.ingenua}` +
      ` ⇒ um CHECK assim PASSARIA (é o furo de 04/10)`,
  )
  console.log(
    `  ⭐ contrafactual ESPAÇO: a forma VELHA \`'   ' <> ''\` → ${tres.espaco_passa}` +
      ` ⇒ PASSAVA · a forma do trigger \`length(trim('   '))>0\` → ${tres.forte} ⇒ RECUSA`,
  )

  console.log('\n── REDE 4: os triggers existem de verdade ──')
  const trigs = await prisma.$queryRawUnsafe<{ tgname: string; tabela: string }[]>(
    `SELECT t.tgname, c.relname AS tabela
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal AND t.tgname LIKE '%escolha%'
      ORDER BY t.tgname`,
  )
  console.log(`  triggers: ${trigs.map((t) => `${t.tgname} em ${t.tabela}`).join(' · ') || '(nenhum)'}`)
  for (const esperado of ['trg_stock_radar_item_escolha', 'trg_stock_venda_ignorado_escolha']) {
    console.log(`  ${trigs.some((t) => t.tgname === esperado) ? '⭐' : '⛔⛔'} ${esperado}`)
  }

  console.log('\n── LIMPEZA ──')
  await limpar()
  const depoisRadar = await prisma.stockRadarItem.count()
  const depoisIgn = await prisma.stockVendaIgnorado.count()
  console.log(`linhas DEPOIS: radar=${depoisRadar} ignorado=${depoisIgn}`)
  console.log(
    depoisRadar === antesRadar && depoisIgn === antesIgn
      ? '⭐ ZERO ESCRITA LÍQUIDA — como encontrou'
      : '⛔⛔ SOBROU DADO — investigar',
  )
}

main()
  .catch((e) => {
    console.error('⛔ falhou:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
