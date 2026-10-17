/**
 * ⭐⭐⭐ A PROVA DOS CHECKS DA CONFIG DE COMPRA — contra POSTGRES REAL (16/10/2026).
 *
 * **REGRA 13 da casa:** ***todo CHECK novo nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele não existir ali.
 *
 * ⚠️⚠️ **AQUI A REGRA 13 MORDE DE VERDADE** — ao contrário da prova da estrela (12/10), em que as
 * duas colunas comparadas eram NOT NULL e o furo era teórico. `fornecedor` é **NULLABLE e
 * comparado por CONTEÚDO**, que é exatamente a forma do `chk_aviso_acao_completa` (04/10):
 * `length(btrim(NULL, …))` é **NULL**, não 0, e NULL num CHECK **PASSA**. A REDE 3 mede os dois
 * contrafactuais no próprio banco em vez de eu afirmar.
 *
 * ⚠️ E o `btrim` leva a **classe de branco por extenso** (` \t\n\r\f\v`): o `btrim` do Postgres
 * apara **só o espaço** por default — medido em 14/10, e a razão da migration
 * `20261014201500`. Por isso os tortos incluem TAB e NEWLINE, não só espaço.
 *
 * ⭐ E a **forma do CSV** (`chk_compra_config_dias`) já recusa só-branco por construção — `'   '`
 * não casa `^$|^[0-6](,[0-6])*$`. É por isso que esta tabela **não precisa** do trigger
 * `stock_texto_de_escolha` que as duas de 14/10 ganharam; a REDE 1 prova isso em vez de prometer.
 *
 * ⚠️ ZERO ESCRITA LÍQUIDA: os tortos são feitos pra FALHAR, os legítimos são apagados no fim, e o
 * script confere a contagem antes e depois — se sobrar, ele apaga e ACUSA.
 *
 * ⛔⛔ E o INSERT torto usa o **`prisma` global**, nunca um `tx` de `$transaction` com
 * `throw ROLLBACK`: a cicatriz de 13/10 é que `$executeRawUnsafe` pelo client global DENTRO de
 * uma transação sai por **outra conexão**, o rollback não o desfaz, e a linha FICA no banco
 * fingindo que a prova foi limpa. Aqui a limpeza é explícita (DELETE por prefixo de id) e
 * CONFERIDA.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-consumo-e-compras.ts --empresa=<companyId>
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const ID = 'prova-compra-config'

const C_FORMA = 'chk_compra_config_forma'
const C_DIAS = 'chk_compra_config_dias'
const C_ANTEC = 'chk_compra_config_antecedencia'
const C_FOLGA = 'chk_compra_config_folga'
const C_FORN = 'chk_compra_config_fornecedor'

/** ⚠️ SQL literal: `null` vira NULL de verdade (e não a string 'null'), e aspas internas escapam */
const lit = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)

async function main() {
  const empresaId = process.argv.slice(2).find((a) => a.startsWith('--empresa='))?.split('=')[1]
  if (!empresaId) {
    console.error('⛔ falta --empresa=<companyId>')
    process.exit(1)
  }
  /** ⛔ REGRA 8b — prova contra QUAL banco antes de medir (zero silencioso ≠ "não tem") */
  const nome = await exigirEmpresaNesteBanco(prisma, empresaId)
  console.log(`\n⭐ empresa: ${nome} (${empresaId})`)

  const antes = await prisma.stockCompraConfig.count()
  console.log(`linhas ANTES: ${antes}`)

  const limpar = () =>
    prisma.$executeRawUnsafe(`DELETE FROM "stock_compra_config" WHERE "id" LIKE '${ID}%'`)
  await limpar()

  /** ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO — ela não pode passar por nenhuma
   *  validação nossa; é justamente o caminho "por fora da porta". */
  const insere = (
    sufixo: string,
    o: {
      companyId?: string
      itemId?: string
      dias?: string
      antec?: number
      fornecedor?: string | null
      folga?: number
    } = {},
  ) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_compra_config"
         ("id","companyId","itemId","diasChegada","antecedenciaDias","fornecedor","folgaPct","definidoEm")
       VALUES (
         '${ID}-${sufixo}',
         ${lit(o.companyId ?? empresaId)},
         ${lit(o.itemId ?? `item-${sufixo}`)},
         ${lit(o.dias ?? '0,3')},
         ${o.antec ?? 1},
         ${lit(o.fornecedor === undefined ? 'FRIGORIFICO SILVA' : o.fornecedor)},
         ${o.folga ?? 10},
         now()
       )`,
    )

  /* ═══════════════════ REDE 1 — o BANCO recusa o torto ═══════════════════ */
  console.log('\n── REDE 1: o BANCO recusa o torto, pela constraint CERTA ──')
  const tortos: { nome: string; constraint: string; run: () => Promise<unknown> }[] = [
    // forma dos ids
    { nome: 'companyId VAZIO', constraint: C_FORMA, run: () => insere('t1', { companyId: '' }) },
    { nome: 'companyId só ESPAÇO', constraint: C_FORMA, run: () => insere('t2', { companyId: '   ' }) },
    { nome: 'companyId só TAB (o btrim default não apararia)', constraint: C_FORMA, run: () => insere('t3', { companyId: '\t' }) },
    { nome: 'itemId VAZIO', constraint: C_FORMA, run: () => insere('t4', { itemId: '' }) },
    { nome: 'itemId só NEWLINE', constraint: C_FORMA, run: () => insere('t5', { itemId: '\n' }) },
    // forma do CSV de dias
    { nome: 'dias com índice 7 (a semana tem 0..6)', constraint: C_DIAS, run: () => insere('t6', { dias: '0,7' }) },
    { nome: 'dias por NOME ("SEG,QUA")', constraint: C_DIAS, run: () => insere('t7', { dias: 'SEG,QUA' }) },
    { nome: 'dias com vírgula sobrando ("0,")', constraint: C_DIAS, run: () => insere('t8', { dias: '0,' }) },
    { nome: 'dias só ESPAÇO (a forma já recusa — sem trigger)', constraint: C_DIAS, run: () => insere('t9', { dias: '   ' }) },
    { nome: 'dias com espaço no meio ("0, 3")', constraint: C_DIAS, run: () => insere('t10', { dias: '0, 3' }) },
    // antecedência
    { nome: 'antecedência NEGATIVA', constraint: C_ANTEC, run: () => insere('t11', { antec: -1 }) },
    { nome: 'antecedência 300 dias (dedo escorregado)', constraint: C_ANTEC, run: () => insere('t12', { antec: 300 }) },
    // folga
    { nome: 'folga NEGATIVA', constraint: C_FOLGA, run: () => insere('t13', { folga: -5 }) },
    { nome: 'folga 1000% (o 1,10 digitado como 110 e multiplicado)', constraint: C_FOLGA, run: () => insere('t14', { folga: 1000 }) },
    // ⚠️⚠️ O CASO DA REGRA 13: nullable comparado por conteúdo
    { nome: '⚠️ fornecedor VAZIO (nullable comparado por conteúdo)', constraint: C_FORN, run: () => insere('t15', { fornecedor: '' }) },
    { nome: '⚠️ fornecedor só ESPAÇO (o furo de 04/10)', constraint: C_FORN, run: () => insere('t16', { fornecedor: '   ' }) },
    { nome: '⚠️ fornecedor só TAB+NEWLINE', constraint: C_FORN, run: () => insere('t17', { fornecedor: '\t\n' }) },
  ]
  let recusados = 0
  for (const t of tortos) {
    try {
      await t.run()
      console.log(`  ⛔⛔ ENTROU (o CHECK não bloqueou!): ${t.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const bateu = msg.includes(t.constraint)
      console.log(
        `  ${bateu ? '✓' : '⚠️'} recusado${bateu ? ` (${t.constraint})` : ` por OUTRO motivo — ${msg.slice(0, 120)}`}: ${t.nome}`,
      )
      if (bateu) recusados++
    }
  }
  console.log(`  → ${recusados} de ${tortos.length} recusados pela constraint CERTA`)

  /* ═══════════════════ REDE 2 — o LEGÍTIMO entra ═══════════════════ */
  /**
   * ⭐⭐ É o lado que falta em quase todo guard de trava: provar que ela **não barra o certo**.
   * ⚠️ E cada legítimo aqui é um caso REAL do brief, não um valor de enfeite:
   *   · `fornecedor NULL` — lei C5: fornecedor é OPCIONAL
   *   · `dias ''` — item sem config fica FORA da mesa (e a tela avisa), não é erro
   *   · `antecedência 0` — fornecedor que entrega no mesmo dia do pedido
   *   · `folga 0` — o dono pode não querer folga
   *   · `dias '0,1,2,3,4,5,6'` — chega todo dia
   */
  console.log('\n── REDE 2: o legítimo entra (e cada um é caso REAL do brief) ──')
  let entraram = 0
  const legitimos: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: 'config cheia (SEG+QUI, antec 1, folga 10, com fornecedor)', run: () => insere('ok1') },
    { nome: '⚠️ fornecedor NULL (é OPCIONAL na lei C5)', run: () => insere('ok2', { fornecedor: null }) },
    { nome: "dias '' (sem config — item fica fora da mesa, com aviso)", run: () => insere('ok3', { dias: '' }) },
    { nome: 'antecedência 0 (entrega no mesmo dia do pedido)', run: () => insere('ok4', { antec: 0 }) },
    { nome: 'folga 0 (o dono não quer folga neste item)', run: () => insere('ok5', { folga: 0 }) },
    { nome: 'chega TODO dia (0,1,2,3,4,5,6)', run: () => insere('ok6', { dias: '0,1,2,3,4,5,6' }) },
    { nome: 'um dia só (6 = DOM)', run: () => insere('ok7', { dias: '6' }) },
    { nome: 'fornecedor com espaço no MEIO (nome composto)', run: () => insere('ok8', { fornecedor: 'CIA DA FRUTA' }) },
  ]
  for (const l of legitimos) {
    try {
      await l.run()
      entraram++
      console.log(`  ✓ ENTROU: ${l.nome}`)
    } catch (e) {
      console.log(
        `  ⛔⛔ RECUSADO (o CHECK está estreito demais): ${l.nome} — ${(e as Error).message.slice(0, 160)}`,
      )
    }
  }

  /* ═══════════════════ REDE 2b — o único ═══════════════════ */
  console.log('\n── REDE 2b: a MESMA (empresa, item) 2× é recusada pelo índice único ──')
  let unicoMordeu = false
  try {
    await insere('dup', { itemId: 'item-ok1', dias: '5' })
    console.log('  ⛔⛔ ENTROU — salvar 2× criou uma 2ª config que pode DIVERGIR')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    unicoMordeu = msg.includes('23505') || /unique/i.test(msg)
    console.log(`  ${unicoMordeu ? '✓' : '⚠️'} recusado: 2ª linha da mesma (companyId, itemId)`)
  }

  /* ═══════════════════ REDE 3 — o contrafactual, MEDIDO ═══════════════════ */
  /**
   * ⭐⭐⭐ Os dois contrafactuais da REGRA 13, medidos no próprio banco:
   *  (a) a forma INGÊNUA sobre NULL (`length(trim(NULL)) > 0`) devolve **NULL**, e NULL num CHECK
   *      PASSA — é o furo exato do `chk_aviso_acao_completa`;
   *  (b) o `btrim` DEFAULT não apara TAB — a razão da classe de branco por extenso.
   * ⚠️ E ele confere que `fornecedor` É nullable hoje: *"é nullable"* é exatamente o tipo de
   *    premissa que envelhece quando alguém mexe no schema.
   */
  console.log('\n── REDE 3: o contrafactual da REGRA 13, medido no banco ──')
  const [cf] = await prisma.$queryRawUnsafe<
    {
      ingenua: boolean | null
      nossa: boolean | null
      trimSimplesTab: boolean | null
      btrimClasseTab: boolean | null
    }[]
  >(
    `SELECT
       (length(trim(NULL)) > 0)                               AS ingenua,
       (NULL IS NULL OR length(btrim(NULL, E' \\t\\n\\r\\f\\v')) > 0) AS nossa,
       (length(trim(E'\\t')) > 0)                              AS "trimSimplesTab",
       (length(btrim(E'\\t', E' \\t\\n\\r\\f\\v')) > 0)          AS "btrimClasseTab"`,
  )
  console.log(
    `  (a) a forma INGÊNUA sobre NULL → ${cf.ingenua === null ? 'NULL → o CHECK PASSARIA (o furo de 04/10)' : cf.ingenua}`,
  )
  console.log(`      a NOSSA (IS NULL primeiro) sobre NULL → ${cf.nossa} → ACEITA (NULL é legítimo aqui)`)
  console.log(
    `  (b) trim() simples num TAB → ${cf.trimSimplesTab} ⇒ ${cf.trimSimplesTab ? 'PASSARIA' : 'recusa'}  ·  btrim com a CLASSE → ${cf.btrimClasseTab} ⇒ ${cf.btrimClasseTab ? 'PASSARIA' : 'RECUSA'}`,
  )

  const [nn] = await prisma.$queryRawUnsafe<{ fornecedor: string; dias: string }[]>(
    `SELECT
       (SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'stock_compra_config' AND column_name = 'fornecedor')  AS fornecedor,
       (SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'stock_compra_config' AND column_name = 'diasChegada') AS dias`,
  )
  console.log(`  colunas: fornecedor nullable=${nn.fornecedor} (é o caso da REGRA 13) · diasChegada nullable=${nn.dias}`)

  const presentes = await prisma.$queryRawUnsafe<{ nome: string }[]>(
    `SELECT conname AS nome FROM pg_constraint
      WHERE conrelid = 'stock_compra_config'::regclass AND contype = 'c' ORDER BY conname`,
  )
  console.log(`  CHECKs vivos na tabela: ${presentes.map((p) => p.nome).join(' · ')}`)

  /* ═══════════════════ limpeza CONFERIDA ═══════════════════ */
  await limpar()
  const depois = await prisma.stockCompraConfig.count()
  console.log(`\nlinhas DEPOIS: ${depois}`)

  const limpo = depois === antes
  const tudo =
    recusados === tortos.length && entraram === legitimos.length && unicoMordeu && limpo && cf.ingenua === null

  console.log(
    `\n${tudo ? '⭐ PROVA OK' : '⛔ PROVA FALHOU'} — tortos ${recusados}/${tortos.length} · legítimos ${entraram}/${legitimos.length} · único ${unicoMordeu ? 'ok' : 'FALHOU'} · escrita líquida ${limpo ? 'ZERO' : `⛔ ${depois - antes}`}`,
  )
  process.exit(tudo ? 0 : 1)
}

main()
  .catch((e) => {
    console.error('⛔', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
