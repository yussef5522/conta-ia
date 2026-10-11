/**
 * ⭐⭐⭐ A PROVA DOS CHECKS DO RASTRO DO PEDIDO — contra POSTGRES REAL (11/10/2026).
 *
 * **REGRA 13 da casa:** ***todo CHECK novo nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele não existir ali. Mesmo
 * padrão de `scripts/prova-check-aviso.ts`, `prova-check-contagem-negativo.ts` e do trigger de
 * imutabilidade do ledger.
 *
 * ⚠️ **E A LIÇÃO DA REGRA 13 É SOBRE LÓGICA DE TRÊS VALORES:** o `chk_aviso_acao_completa`
 * (04/10) foi provado FURADO porque comparava CONTEÚDO de coluna NULLABLE — `length(trim(NULL))`
 * não é 0, é **NULL**, e ***CHECK com expressão NULL PASSA***. Aqui as duas chaves de forma
 * (`companyId`/`ordemId`) são **NOT NULL por construção**, e a REDE 3 abaixo MEDE isso no
 * próprio banco em vez de eu afirmar — porque "é NOT NULL" é exatamente o tipo de premissa que
 * envelhece quando alguém mexe no schema.
 *
 * ⚠️ ZERO ESCRITA: os INSERTs tortos são feitos pra FALHAR, os legítimos são desfeitos no fim, e
 * o script confere a contagem antes e depois — se algo sobrar, ele apaga e ACUSA.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-pedido-declarado.ts --empresa=<companyId>
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const ID_DE_PROVA = 'prova-chk-ped'

interface Caso {
  nome: string
  campos: Record<string, string | number | boolean | null>
  constraintEsperada: string
}

async function main() {
  const empresaId = process.argv.slice(2).find((a) => a.startsWith('--empresa='))?.split('=')[1]
  if (!empresaId) {
    console.error('⛔ falta --empresa=<companyId>')
    process.exit(1)
  }
  /** ⛔ REGRA 8b — prova contra QUAL banco antes de medir (zero silencioso é indistinguível de "não tem") */
  const nome = await exigirEmpresaNesteBanco(prisma, empresaId)
  console.log(`\n⭐ empresa: ${nome} (${empresaId})`)

  const antes = await prisma.stockOrdemPedidoDeclarado.count()
  console.log(`linhas na tabela ANTES: ${antes}`)

  /** ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO, então ela não pode passar por
   *  nenhuma validação nossa — é justamente o caminho "por fora da porta". */
  const insere = (campos: Record<string, string | number | boolean | null>, sufixo: string) => {
    const base: Record<string, string | number | boolean | null> = {
      id: `${ID_DE_PROVA}-${sufixo}`,
      companyId: empresaId,
      ordemId: `${ID_DE_PROVA}-ordem`,
      unidades: 30,
      correcao: false,
      declaradoPorId: null,
      ...campos,
    }
    const cols = Object.keys(base).map((c) => `"${c}"`).join(',')
    const vals = Object.values(base)
      .map((v) =>
        v === null ? 'NULL'
          : typeof v === 'number' ? String(v)
            : typeof v === 'boolean' ? (v ? 'true' : 'false')
              : `'${v.replace(/'/g, "''")}'`,
      )
      .join(',')
    return prisma.$executeRawUnsafe(
      `INSERT INTO "stock_ordem_pedido_declarado" (${cols},"declaradoEm") VALUES (${vals}, now())`,
    )
  }

  const casos: Caso[] = [
    /** ⛔⛔ O CASO QUE MOTIVOU O CHECK: *"pedido 0"* é a mentira que este sprint inteiro mata */
    {
      nome: 'pedido ZERO — "pedido 0" não é um pedido, é a ausência fingindo número',
      campos: { unidades: 0 },
      constraintEsperada: 'chk_pedido_declarado_positivo',
    },
    {
      nome: 'pedido NEGATIVO — ninguém produz menos que nada',
      campos: { unidades: -5 },
      constraintEsperada: 'chk_pedido_declarado_positivo',
    },
    {
      nome: 'companyId só com espaço — rastro sem empresa não é multi-tenant',
      campos: { companyId: '   ' },
      constraintEsperada: 'chk_pedido_declarado_company',
    },
    {
      nome: 'companyId VAZIO',
      campos: { companyId: '' },
      constraintEsperada: 'chk_pedido_declarado_company',
    },
    {
      nome: 'ordemId VAZIO — declaração que não aponta pra ordem nenhuma',
      campos: { ordemId: '' },
      constraintEsperada: 'chk_pedido_declarado_ordem',
    },
    {
      nome: 'ordemId só com espaço',
      campos: { ordemId: ' ' },
      constraintEsperada: 'chk_pedido_declarado_ordem',
    },
  ]

  console.log('\n── REDE 1: o BANCO recusa quem grava por fora da porta ──')
  let recusadosCerto = 0
  for (const [i, c] of casos.entries()) {
    try {
      await insere(c.campos, `torto-${i}`)
      console.log(`  ⛔⛔ ENTROU (o CHECK não bloqueou!): ${c.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const bateu = msg.includes(c.constraintEsperada)
      console.log(
        `  ${bateu ? '✓' : '⚠️'} recusado por ${bateu ? c.constraintEsperada : `OUTRO motivo — ${msg.slice(0, 140)}`}: ${c.nome}`,
      )
      if (bateu) recusadosCerto++
    }
  }
  console.log(`  → ${recusadosCerto} de ${casos.length} recusados pelo CHECK certo`)

  /**
   * ⭐⭐ REDE 2 — OS CASOS LEGÍTIMOS **ENTRAM**. É o lado que falta em quase todo guard de
   * CHECK: provar que ele não barra o certo. *Guard que barra o legítimo ensina a afrouxar a
   * régua* — e aqui o caso mais importante é **DUAS linhas da MESMA ordem**, que é o estado
   * NORMAL depois de uma correção (declarou 30, corrigiu pra 20). Um índice único aqui mataria
   * justamente a correção que o dono pediu.
   */
  console.log('\n── REDE 2: o legítimo entra, inclusive DUAS declarações da mesma ordem ──')
  const legitimos: { nome: string; campos: Record<string, string | number | boolean | null> }[] = [
    { nome: '1ª declaração (correcao=false)', campos: { unidades: 30, correcao: false } },
    { nome: 'a CORREÇÃO da MESMA ordem (correcao=true) — 2 linhas é o normal', campos: { unidades: 20, correcao: true } },
    { nome: 'fração (KG/LT têm casas: 2,858 é o lote da maionese)', campos: { unidades: 2.858 } },
    { nome: 'sem autor (`declaradoPorId` NULL) — gesto do tablet/sugestão', campos: { declaradoPorId: null } },
  ]
  let entraram = 0
  for (const [i, l] of legitimos.entries()) {
    try {
      await insere(l.campos, `ok-${i}`)
      entraram++
      console.log(`  ✓ ENTROU: ${l.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ⛔⛔ RECUSADO (o CHECK está estreito demais): ${l.nome} — ${msg.slice(0, 160)}`)
    }
  }
  console.log(`  → ${entraram} de ${legitimos.length} aceitos`)

  /**
   * ⭐⭐⭐ REDE 3 — O CONTRAFACTUAL DA REGRA 13, MEDIDO NO PRÓPRIO BANCO.
   *
   * ⚠️ As duas chaves de forma são NOT NULL, então `length(trim(x)) > 0` é seguro **aqui**. Mas
   * a premissa é do SCHEMA, e schema muda: esta rede mede o que o Postgres responde pra a forma
   * ingênua sobre NULL, pra a lição ficar no output e não só no comentário.
   */
  console.log('\n── REDE 3: por que o `IS NOT NULL` é obrigatório onde a coluna pode ser nula ──')
  const [tres] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean }[]>(
    `SELECT (length(trim(NULL)) > 0) AS ingenua,
            (NULL IS NOT NULL AND length(trim(NULL)) > 0) AS nossa`,
  )
  console.log(`  forma INGÊNUA sobre NULL → ${tres.ingenua === null ? 'NULL → o CHECK PASSARIA' : tres.ingenua}`)
  console.log(`  forma com IS NOT NULL    → ${tres.nossa} → RECUSA`)
  const [nn] = await prisma.$queryRawUnsafe<{ companyid: string; ordemid: string }[]>(
    `SELECT (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_ordem_pedido_declarado' AND column_name = 'companyId') AS companyid,
            (SELECT is_nullable FROM information_schema.columns
               WHERE table_name = 'stock_ordem_pedido_declarado' AND column_name = 'ordemId')   AS ordemid`,
  )
  console.log(`  e as colunas do CHECK de forma são nullable? companyId=${nn.companyid} · ordemId=${nn.ordemid}`)
  if (nn.companyid !== 'NO' || nn.ordemid !== 'NO') {
    console.log('  ⛔⛔ UMA DELAS FICOU NULLABLE — o CHECK de forma passou a ter o furo de três valores')
  }

  console.log('\n── LIMPEZA: zero escrita líquida ──')
  await prisma.$executeRawUnsafe(
    `DELETE FROM "stock_ordem_pedido_declarado" WHERE "id" LIKE '${ID_DE_PROVA}%'`,
  )
  const depois = await prisma.stockOrdemPedidoDeclarado.count()
  console.log(`linhas na tabela DEPOIS: ${depois} (antes: ${antes})`)

  const ok =
    recusadosCerto === casos.length &&
    entraram === legitimos.length &&
    tres.ingenua === null &&
    tres.nossa === false &&
    depois === antes
  console.log(ok ? '\n⭐ PROVA OK — os 3 CHECKs mordem, o legítimo entra, e nada sobrou.' : '\n⛔ PROVA FALHOU — ver acima.')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('⛔', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
