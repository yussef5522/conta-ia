/**
 * ⭐⭐⭐ A PROVA DOS CHECKS DE EQUIPAMENTO — contra POSTGRES REAL (20/10/2026).
 *
 * **REGRA 13 da casa:** ***todo CHECK novo nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele não existir ali.
 *
 * ⭐⭐ **E AQUI A REGRA 13 MORDE DE VERDADE** — ao contrário da prova da estrela (12/10), em que
 * o furo era teórico porque as colunas comparadas eram NOT NULL. **`supplierCnpj` e `cProd` são
 * NULLABLE comparados por CONTEÚDO**: é a forma EXATA do `chk_aviso_acao_completa` (04/10), que
 * deveria barrar "botão pela metade" e **deixava passar**, porque `length(trim(NULL))` não é 0 —
 * é NULL, e **CHECK com expressão NULL PASSA**. A REDE 3 mede os dois contrafactuais no próprio
 * banco em vez de eu afirmar.
 *
 * ⚠️ **E o `btrim` com a CLASSE escrita por extenso** (` \t\n\r\f\v`) é a cicatriz de 14/10: o
 * `btrim` do Postgres apara, por default, **somente o espaço** — ao contrário do `trim()` do JS,
 * que apara a classe inteira. ***Caractere que não está na lista é caractere que passa***, e por
 * isso os tortos incluem TAB e NEWLINE.
 *
 * ⚠️ ZERO ESCRITA LÍQUIDA: os tortos são feitos pra FALHAR, os legítimos são apagados no fim, e
 * o script confere a contagem antes e depois — se sobrar, ele apaga e ACUSA.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-equipamento.ts --empresa=<companyId>
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const ID = 'prova-equip'
const C_FORMA = 'chk_equipamento_forma'
const C_VALOR = 'chk_equipamento_valor'
const C_QTD = 'chk_equipamento_qtd'
const C_CNPJ = 'chk_equipamento_cnpj'
const C_SUP_FORMA = 'chk_supplier_equip_forma'
const C_SUP_CPROD = 'chk_supplier_equip_cprod'

type Caso = { nome: string; constraint: string; run: () => Promise<unknown> }

async function main() {
  const empresaId = process.argv.slice(2).find((a) => a.startsWith('--empresa='))?.split('=')[1]
  if (!empresaId) {
    console.error('⛔ falta --empresa=<companyId>')
    process.exit(1)
  }
  /** ⛔ REGRA 8b — prova contra QUAL banco antes de medir (zero silencioso ≠ "não tem") */
  const nome = await exigirEmpresaNesteBanco(prisma, empresaId)
  console.log(`\n⭐ empresa: ${nome} (${empresaId})`)

  const antesEq = await prisma.stockEquipamento.count()
  const antesMapa = await prisma.stockSupplierEquipamento.count()
  console.log(`linhas ANTES: equipamento ${antesEq} · aprendizado ${antesMapa}`)

  const limpar = async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "stock_equipamento" WHERE "id" LIKE '${ID}%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "stock_supplier_equipamento" WHERE "id" LIKE '${ID}%'`)
  }
  await limpar()

  /** ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO — ela não pode passar por
   *  nenhuma validação nossa; é justamente o caminho "por fora da porta", que é onde a
   *  CAMADA 1 existe pra morder. */
  const sql = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)

  const equip = (
    sufixo: string,
    o: Partial<{ companyId: string; nome: string; valor: number; quantidade: number; supplierNome: string; supplierCnpj: string | null; nfeItemId: string | null }> = {},
  ) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_equipamento"
         ("id","companyId","nome","valor","quantidade","unidade","data","supplierCnpj","supplierNome","nfeItemId","criadoEm")
       VALUES (${sql(`${ID}-${sufixo}`)}, ${sql(o.companyId ?? empresaId)}, ${sql(o.nome ?? 'BOLEADORA BOL600')},
               ${o.valor ?? 21000}, ${o.quantidade ?? 1}, 'UN', now(),
               ${sql(o.supplierCnpj === undefined ? '62626262000162' : o.supplierCnpj)},
               ${sql(o.supplierNome ?? 'MAQUINAS BOL LTDA')},
               ${sql(o.nfeItemId === undefined ? `${ID}-item-${sufixo}` : o.nfeItemId)}, now())`,
    )

  const mapa = (
    sufixo: string,
    o: Partial<{ companyId: string; supplierCnpj: string; cProd: string | null; xProdNormalizado: string }> = {},
  ) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_supplier_equipamento"
         ("id","companyId","supplierCnpj","cProd","xProd","xProdNormalizado","criadoEm")
       VALUES (${sql(`${ID}-m-${sufixo}`)}, ${sql(o.companyId ?? empresaId)}, ${sql(o.supplierCnpj ?? '62626262000162')},
               ${sql(o.cProd === undefined ? 'BOL600' : o.cProd)}, 'BOLEADORA BOL600',
               ${sql(o.xProdNormalizado ?? `boleadora bol600 ${sufixo}`)}, now())`,
    )

  console.log('\n── REDE 1: o BANCO recusa a forma torta ──')
  const tortos: Caso[] = [
    { nome: 'companyId VAZIO', constraint: C_FORMA, run: () => equip('t1', { companyId: '' }) },
    { nome: 'companyId só ESPAÇO', constraint: C_FORMA, run: () => equip('t2', { companyId: '   ' }) },
    { nome: 'nome VAZIO (o dono não reconheceria a linha)', constraint: C_FORMA, run: () => equip('t3', { nome: '' }) },
    { nome: 'nome só ESPAÇO', constraint: C_FORMA, run: () => equip('t4', { nome: '  ' }) },
    { nome: 'nome só TAB (a classe de 14/10)', constraint: C_FORMA, run: () => equip('t5', { nome: '\t' }) },
    { nome: 'nome só NEWLINE', constraint: C_FORMA, run: () => equip('t6', { nome: '\n' }) },
    { nome: 'supplierNome VAZIO', constraint: C_FORMA, run: () => equip('t7', { supplierNome: '' }) },
    { nome: 'valor NEGATIVO', constraint: C_VALOR, run: () => equip('t8', { valor: -1 }) },
    { nome: 'quantidade ZERO', constraint: C_QTD, run: () => equip('t9', { quantidade: 0 }) },
    { nome: 'quantidade NEGATIVA', constraint: C_QTD, run: () => equip('t10', { quantidade: -2 }) },
    // ⭐⭐ os dois que a REGRA 13 existe pra pegar: coluna NULLABLE comparada por CONTEÚDO
    { nome: '⭐ CNPJ só ESPAÇO (fornecedor em branco na lista do dono)', constraint: C_CNPJ, run: () => equip('t11', { supplierCnpj: '   ' }) },
    { nome: '⭐ CNPJ só TAB', constraint: C_CNPJ, run: () => equip('t12', { supplierCnpj: '\t' }) },
    { nome: 'aprendizado: companyId só ESPAÇO', constraint: C_SUP_FORMA, run: () => mapa('t13', { companyId: ' ' }) },
    { nome: 'aprendizado: CNPJ do fornecedor VAZIO', constraint: C_SUP_FORMA, run: () => mapa('t14', { supplierCnpj: '' }) },
    { nome: 'aprendizado: nome normalizado só ESPAÇO (a CHAVE do mapa)', constraint: C_SUP_FORMA, run: () => mapa('t15', { xProdNormalizado: '   ' }) },
    { nome: '⭐ aprendizado: cProd só ESPAÇO', constraint: C_SUP_CPROD, run: () => mapa('t16', { cProd: '  ' }) },
  ]
  let recusados = 0
  for (const t of tortos) {
    try {
      await t.run()
      console.log(`  ⛔⛔ ENTROU (o CHECK não bloqueou!): ${t.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const bateu = msg.includes(t.constraint)
      console.log(`  ${bateu ? '✓' : '⚠️'} recusado por ${bateu ? t.constraint : `OUTRO motivo — ${msg.slice(0, 110)}`}: ${t.nome}`)
      if (bateu) recusados++
    }
  }
  console.log(`  → ${recusados} de ${tortos.length} recusados pela constraint CERTA`)

  /**
   * ⭐⭐ REDE 2 — O LEGÍTIMO ENTRA. É o lado que falta em quase todo guard de trava: provar
   * que ela **não barra o certo**. ⚠️ E os três primeiros são os casos que o CHECK foi escrito
   * pra ACEITAR, cada um com o motivo que está na migration.
   */
  console.log('\n── REDE 2: o legítimo entra (inclusive o que o CHECK precisa aceitar) ──')
  const legitimos: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: 'a boleadora completa (o caso real)', run: () => equip('ok1') },
    { nome: '⭐ CNPJ NULL — equipamento comprado SEM nota (a porta que a coluna nullable abre)', run: () => equip('ok2', { supplierCnpj: null }) },
    { nome: '⭐ valor ZERO — equipamento em bonificação/doação', run: () => equip('ok3', { valor: 0 }) },
    { nome: 'quantidade FRACIONADA (1,5 — nada proíbe)', run: () => equip('ok4', { quantidade: 1.5 }) },
    { nome: '⭐ sem nfeItemId (sem nota) — e um 2º também sem, pelo MESMO índice', run: () => equip('ok5', { nfeItemId: null }) },
    { nome: '⭐ o SEGUNDO sem nfeItemId (NULL nunca é igual a NULL no Postgres)', run: () => equip('ok6', { nfeItemId: null }) },
    { nome: '⭐ aprendizado com cProd NULL (o DANFE digitado não tem código)', run: () => mapa('ok7', { cProd: null }) },
    { nome: 'aprendizado com cProd preenchido (o casamento preferencial)', run: () => mapa('ok8') },
  ]
  let entraram = 0
  for (const l of legitimos) {
    try {
      await l.run()
      entraram++
      console.log(`  ✓ ENTROU: ${l.nome}`)
    } catch (e) {
      console.log(`  ⛔⛔ RECUSADO (o CHECK está estreito demais): ${l.nome} — ${(e as Error).message.slice(0, 160)}`)
    }
  }

  console.log('\n── REDE 2b: a MESMA linha da nota 2× é recusada pelo índice único ──')
  let unicoEquip = false
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "stock_equipamento"
         ("id","companyId","nome","valor","quantidade","unidade","data","supplierNome","nfeItemId","criadoEm")
       VALUES ('${ID}-dup', ${sql(empresaId)}, 'BOLEADORA BOL600', 21000, 1, 'UN', now(),
               'MAQUINAS BOL LTDA', '${ID}-item-ok1', now())`,
    )
    console.log('  ⛔⛔ ENTROU — confirmar a conferência 2× DOBRARIA o investido')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    unicoEquip = msg.includes('23505') || /unique/i.test(msg)
    console.log(`  ${unicoEquip ? '✓' : '⚠️'} recusado: 2ª linha do mesmo (companyId, nfeItemId)`)
  }

  let unicoMapa = false
  try {
    await mapa('dup', { xProdNormalizado: 'boleadora bol600 ok8' })
    console.log('  ⛔⛔ ENTROU — aprender 2× criou uma 2ª linha que divergiria da primeira')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    unicoMapa = msg.includes('23505') || /unique/i.test(msg)
    console.log(`  ${unicoMapa ? '✓' : '⚠️'} recusado: 2ª linha do mesmo (empresa, fornecedor, nome normalizado)`)
  }

  /**
   * ⭐⭐⭐ REDE 3 — OS CONTRAFACTUAIS DA REGRA 13, MEDIDOS NO PRÓPRIO BANCO.
   *
   * (a) o furo de **04/10**: comparar conteúdo de coluna NULLABLE sem o `IS NULL` explícito;
   * (b) o furo de **14/10**: `btrim`/`trim` sem a classe de caracteres escrita.
   *
   * ⚠️ E aqui **as colunas comparadas SÃO nullable** — então o furo (a) era REAL nesta tabela,
   * não teórico. A rede mede `is_nullable` em vez de eu afirmar: *"é nullable"* é exatamente o
   * tipo de premissa que envelhece quando alguém mexe no schema.
   */
  console.log('\n── REDE 3: os contrafactuais, medidos no banco ──')
  const [r] = await prisma.$queryRawUnsafe<{
    ingenuaNull: boolean | null
    nossaNull: boolean | null
    ingenuaEspaco: boolean | null
    nossaEspaco: boolean | null
    trimSimplesTab: boolean | null
    btrimClasseTab: boolean | null
  }[]>(
    `SELECT (length(trim(NULL::text)) > 0)                              AS "ingenuaNull",
            (NULL::text IS NULL OR length(btrim(NULL::text, E' \\t\\n\\r\\f\\v')) > 0) AS "nossaNull",
            ('   ' <> '')                                               AS "ingenuaEspaco",
            (length(btrim('   ', E' \\t\\n\\r\\f\\v')) > 0)               AS "nossaEspaco",
            (length(trim(E'\\t')) > 0)                                   AS "trimSimplesTab",
            (length(btrim(E'\\t', E' \\t\\n\\r\\f\\v')) > 0)              AS "btrimClasseTab"`,
  )
  console.log(`  (a) a forma INGÊNUA sobre NULL → ${r.ingenuaNull === null ? 'NULL ⇒ o CHECK PASSARIA (o furo de 04/10)' : r.ingenuaNull}`)
  console.log(`      a NOSSA (IS NULL explícito e PRIMEIRO) → ${r.nossaNull} ⇒ ACEITA (NULL é legítimo: equipamento sem nota)`)
  console.log(`  (b) '   ' pela forma ingênua (<> '') → ${r.ingenuaEspaco} ⇒ PASSARIA · pela nossa → ${r.nossaEspaco} ⇒ RECUSA`)
  console.log(`      TAB pelo trim SIMPLES → ${r.trimSimplesTab} ⇒ PASSARIA · pelo btrim com a CLASSE → ${r.btrimClasseTab} ⇒ RECUSA`)

  const [nn] = await prisma.$queryRawUnsafe<{ cnpj: string; cprod: string; empresa: string; nomeCol: string }[]>(
    `SELECT (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_equipamento' AND column_name = 'supplierCnpj') AS cnpj,
            (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_supplier_equipamento' AND column_name = 'cProd') AS cprod,
            (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_equipamento' AND column_name = 'companyId') AS empresa,
            (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_equipamento' AND column_name = 'nome') AS "nomeCol"`,
  )
  console.log(`  colunas comparadas: supplierCnpj nullable=${nn.cnpj} · cProd nullable=${nn.cprod} (⭐ o furo era REAL aqui)`)
  console.log(`                      companyId nullable=${nn.empresa} · nome nullable=${nn.nomeCol}`)

  for (const t of ['stock_equipamento', 'stock_supplier_equipamento']) {
    const checks = await prisma.$queryRawUnsafe<{ conname: string }[]>(
      `SELECT conname FROM pg_constraint WHERE conrelid = '${t}'::regclass AND contype = 'c' ORDER BY conname`,
    )
    console.log(`  CHECKs vivos em ${t}: ${checks.map((c) => c.conname).join(', ') || '(nenhum)'}`)
  }

  console.log('\n── LIMPEZA: zero escrita líquida ──')
  await limpar()
  const depoisEq = await prisma.stockEquipamento.count()
  const depoisMapa = await prisma.stockSupplierEquipamento.count()
  console.log(`linhas DEPOIS: equipamento ${depoisEq} (antes ${antesEq}) · aprendizado ${depoisMapa} (antes ${antesMapa})`)

  const ok =
    recusados === tortos.length &&
    entraram === legitimos.length &&
    unicoEquip && unicoMapa &&
    r.ingenuaNull === null && r.nossaNull === true &&
    r.ingenuaEspaco === true && r.nossaEspaco === false &&
    r.trimSimplesTab === true && r.btrimClasseTab === false &&
    nn.cnpj === 'YES' && nn.cprod === 'YES' &&
    depoisEq === antesEq && depoisMapa === antesMapa
  console.log(ok
    ? '\n⭐ PROVA OK — o CHECK morde a forma torta (NULL, espaço, TAB), o legítimo entra, os dois únicos mordem, e nada sobrou.'
    : '\n⛔ PROVA FALHOU — ver acima.')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('⛔', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
