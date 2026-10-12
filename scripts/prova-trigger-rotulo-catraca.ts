/**
 * ⭐⭐⭐ A PROVA DA CATRACA DO RÓTULO — contra POSTGRES REAL (11/10/2026).
 *
 * **REGRA 13 da casa:** ***toda trava nova do banco nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** o trigger **não existe no schema Prisma** —
 * ele mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite
 * do dev o INSERT torto **PASSA**, e isso não é a trava falhando: é ela não existir ali. Mesmo
 * padrão de `prova-check-pedido-declarado.ts`, `prova-check-aviso.ts` e do trigger de
 * imutabilidade do ledger (que, por esta mesma razão, foi TIRADO do dev em 21/08).
 *
 * ⚠️ **E A LIÇÃO DA REGRA 13 É SOBRE LÓGICA DE TRÊS VALORES:** `NEW."unidadeLoteBase" <>
 * un_produto` com qualquer lado NULL avalia pra **NULL**, o `IF` não entra, e a versão torta
 * PASSA. A REDE 3 abaixo **MEDE isso no próprio banco** em vez de eu afirmar.
 *
 * ⚠️ ZERO ESCRITA LÍQUIDA: a cena é montada com ids `prova-rot%`, os tortos são feitos pra
 * FALHAR, e tudo é apagado no fim — o script confere a contagem antes e depois e ACUSA se sobrar.
 *
 * USO (no servidor):  npx tsx scripts/prova-trigger-rotulo-catraca.ts --empresa=<companyId>
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const ID = 'prova-rot'
const CONSTRAINT = 'ROTULO DO RENDIMENTO INCOERENTE'

async function main() {
  const empresaId = process.argv.slice(2).find((a) => a.startsWith('--empresa='))?.split('=')[1]
  if (!empresaId) {
    console.error('⛔ falta --empresa=<companyId>')
    process.exit(1)
  }
  /** ⛔ REGRA 8b — prova contra QUAL banco antes de medir (zero silencioso ≠ "não tem") */
  const nome = await exigirEmpresaNesteBanco(prisma, empresaId)
  console.log(`\n⭐ empresa: ${nome} (${empresaId})`)

  const versoesAntes = await prisma.stockFichaVersao.count()
  const itensAntes = await prisma.stockItem.count()
  const fichasAntes = await prisma.stockFicha.count()
  console.log(`versões ANTES: ${versoesAntes} · itens: ${itensAntes} · fichas: ${fichasAntes}`)

  const limpar = async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "stock_ficha_versao" WHERE "id" LIKE '${ID}%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "stock_ficha" WHERE "id" LIKE '${ID}%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "stock_item" WHERE "id" LIKE '${ID}%'`)
  }
  await limpar()

  /**
   * A CENA: um produto contado em **UN** e uma ficha apontando pra ele. É o retrato das 37 —
   * e `prova-rot-item` nasce com `unidadeControle = 'UN'`, então rótulo em KG é incoerente.
   */
  await prisma.$executeRawUnsafe(
    `INSERT INTO "stock_item" ("id","companyId","nome","unidadeControle","categoria","criadoVia","criadoEm","atualizadoEm")
     VALUES ('${ID}-item','${empresaId}','PROVA porcao (apagar)','UN','INTERMEDIARIO','MANUAL',now(),now())`,
  )
  await prisma.$executeRawUnsafe(
    `INSERT INTO "stock_ficha" ("id","companyId","itemProduzidoId","tipoProduto","versaoAtual","ativo","criadoEm","atualizadoEm")
     VALUES ('${ID}-ficha','${empresaId}','${ID}-item','INTERMEDIARIO',1,true,now(),now())`,
  )

  /** ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO — ela não pode passar por nenhuma
   *  validação nossa; é justamente o caminho "por fora da porta". */
  const insereVersao = (sufixo: string, versao: number, unidade: string) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "stock_ficha_versao" ("id","companyId","fichaId","versao","loteBase","unidadeLoteBase","criadoEm")
       VALUES ('${ID}-${sufixo}','${empresaId}','${ID}-ficha',${versao},1,'${unidade}',now())`,
    )

  console.log('\n── REDE 1: o BANCO recusa nascer torto e recusa REGREDIR ──')
  let recusados = 0

  // (a) NASCER torto: v1 sem anterior, rótulo em KG num produto em UN
  try {
    await insereVersao('torto-v1', 1, 'KG')
    console.log('  ⛔⛔ ENTROU (a catraca não bloqueou!): v1 nascendo com o rótulo em KG')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const bateu = msg.includes(CONSTRAINT)
    console.log(`  ${bateu ? '✓' : '⚠️'} recusado${bateu ? '' : ` por OUTRO motivo — ${msg.slice(0, 160)}`}: v1 nascendo torta (produto UN · rende KG)`)
    if (bateu) recusados++
  }

  // a v1 COERENTE entra (é a base da regressão)
  await insereVersao('ok-v1', 1, 'UN')

  // (b) REGREDIR: a v1 é coerente e a v2 volta pra KG
  try {
    await insereVersao('torto-v2', 2, 'KG')
    console.log('  ⛔⛔ ENTROU (a catraca não bloqueou!): v2 regredindo pra KG depois de convertida')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const bateu = msg.includes(CONSTRAINT)
    console.log(`  ${bateu ? '✓' : '⚠️'} recusado${bateu ? '' : ` por OUTRO motivo — ${msg.slice(0, 160)}`}: v2 REGREDINDO (anterior já era coerente)`)
    if (bateu) recusados++
  }
  console.log(`  → ${recusados} de 2 recusados pela catraca`)

  /**
   * ⭐⭐ REDE 2 — O LEGÍTIMO ENTRA. É o lado que falta em quase todo guard de trava: provar que
   * ela **não barra o certo**. E aqui o caso que mais importa é o **LEGADO** — a `MAIONESE` e o
   * sabor `CALABRESA` já existem tortos em prod; uma trava que os prendesse viraria parede na
   * ficha de maior volume do cardápio.
   */
  console.log('\n── REDE 2: o legítimo entra, INCLUSIVE o legado torto ──')
  let entraram = 0
  const legitimos: { nome: string; run: () => Promise<unknown> }[] = [
    { nome: 'v2 COERENTE (o caminho de todo dia)', run: () => insereVersao('ok-v2', 2, 'UN') },
    // a ficha legada: v3 torta em cima de uma v2 que também era torta
    {
      nome: 'LEGADO: v4 torta sobre v3 JÁ torta (é a MAIONESE/CALABRESA)',
      run: async () => {
        // monta a v3 torta por UPDATE (a forma do legado: a versão já existia)
        await insereVersao('leg-v3', 3, 'UN')
        await prisma.$executeRawUnsafe(
          `UPDATE "stock_ficha_versao" SET "unidadeLoteBase" = 'KG' WHERE "id" = '${ID}-leg-v3'`,
        )
        return insereVersao('leg-v4', 4, 'KG')
      },
    },
  ]
  for (const l of legitimos) {
    try {
      await l.run()
      entraram++
      console.log(`  ✓ ENTROU: ${l.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ⛔⛔ RECUSADO (a catraca está estreita demais): ${l.nome} — ${msg.slice(0, 200)}`)
    }
  }
  console.log(`  → ${entraram} de ${legitimos.length} aceitos`)

  /**
   * ⭐⭐⭐ REDE 3 — O CONTRAFACTUAL DA REGRA 13, MEDIDO NO PRÓPRIO BANCO.
   *
   * A forma INGÊNUA do trigger seria `IF NEW."unidadeLoteBase" <> un_produto THEN RAISE`. Esta
   * rede mostra o que o Postgres responde pra ela quando um lado é NULL — pra a lição ficar no
   * OUTPUT, não só no comentário.
   */
  console.log('\n── REDE 3: por que o `IS NULL` vem explícito e ANTES ──')
  const [tres] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean }[]>(
    `SELECT ('KG' <> NULL) AS ingenua,
            (NULL IS NULL OR 'KG' = NULL) AS nossa`,
  )
  console.log(`  forma INGÊNUA ('KG' <> NULL) → ${tres.ingenua === null ? 'NULL → o IF NÃO ENTRA e a versão torta PASSA' : tres.ingenua}`)
  console.log(`  a nossa (IS NULL antes)      → ${tres.nossa} → retorna cedo, sem comparar conteúdo`)

  const [nn] = await prisma.$queryRawUnsafe<{ rotulo: string; produto: string }[]>(
    `SELECT (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_ficha_versao' AND column_name = 'unidadeLoteBase') AS rotulo,
            (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_item' AND column_name = 'unidadeControle')        AS produto`,
  )
  console.log(`  e as colunas comparadas são nullable? rótulo=${nn.rotulo} · produto=${nn.produto}`)

  /** ⭐ e o trigger existe mesmo? (a pergunta que o D4 ensinou a fazer: provar, não supor) */
  const gatilhos = await prisma.$queryRawUnsafe<{ tgname: string }[]>(
    `SELECT tgname FROM pg_trigger WHERE tgrelid = 'stock_ficha_versao'::regclass AND NOT tgisinternal`,
  )
  console.log(`  triggers vivos em stock_ficha_versao: ${gatilhos.map((g) => g.tgname).join(', ') || '(nenhum)'}`)

  console.log('\n── LIMPEZA: zero escrita líquida ──')
  await limpar()
  const versoesDepois = await prisma.stockFichaVersao.count()
  const itensDepois = await prisma.stockItem.count()
  const fichasDepois = await prisma.stockFicha.count()
  console.log(`versões DEPOIS: ${versoesDepois} (antes: ${versoesAntes}) · itens: ${itensDepois} · fichas: ${fichasDepois}`)

  const ok =
    recusados === 2 &&
    entraram === legitimos.length &&
    tres.ingenua === null &&
    gatilhos.some((g) => g.tgname === 'trg_stock_ficha_versao_rotulo') &&
    versoesDepois === versoesAntes &&
    itensDepois === itensAntes &&
    fichasDepois === fichasAntes
  console.log(ok
    ? '\n⭐ PROVA OK — a catraca morde nascer-torto e regredir, o legado passa, e nada sobrou.'
    : '\n⛔ PROVA FALHOU — ver acima.')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('⛔', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
