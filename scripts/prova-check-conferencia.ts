/**
 * ⚠️ REGRA 13 — TODO CHECK NOVO NASCE COM PROVA DE INSERT TORTO CONTRA POSTGRES.
 *
 * ⛔ CHECK **não existe no schema Prisma** (mora no SQL da migration), e o `db push` do dev cria
 * a tabela a partir do schema → no SQLite o INSERT torto PASSA, e isso não é o CHECK falhando:
 * é ele não existir ali. Logo, a prova é script contra Postgres, nunca teste da suíte.
 *
 * ⭐⭐ E OS CASOS QUE MAIS IMPORTAM AQUI SÃO OS DE **TRÊS VALORES**: `declaradoPorColaboradorId`
 * e `declaradoPorId` são **NULLABLE de propósito** (397 das 448 conclusões vêm do tablet, sem
 * usuário; e há conclusão sem colaborador). Então:
 *   · `conferido <> declarado` com o declarado NULL devolve **NULL**
 *   · e ***CHECK com expressão NULL PASSA*** — o furo exato do `chk_aviso_acao_completa` (04/10)
 * Por isso o `IS NULL` vem EXPLÍCITO e PRIMEIRO em cada um, e este script mede o contrafactual
 * no próprio banco em vez de eu afirmar que a forma está certa.
 *
 * ⭐ ZERO ESCRITA LÍQUIDA: conta as linhas antes e depois e aborta se não voltar ao mesmo.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

type Caso = { nome: string; args: unknown[]; esperaConstraint: string }

const SQL =
  `INSERT INTO "stock_conclusao_conferida" ` +
  `("id","companyId","conclusaoId","conferidoPorId","conferidoPorColaboradorId","conferidoPorNome",` +
  `"declaradoPorColaboradorId","declaradoPorId","corrigiuDe","motivoDaCorrecao") ` +
  `VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const antes = await prisma.stockConclusaoConferida.count()
  console.log(`\nlinhas antes: ${antes}`)

  const tortos: Caso[] = [
    {
      nome: 'conclusaoId em branco (forma)',
      args: ['pv1', EMPRESA, '   ', 'u-1', 'c-1', 'cristian', 'c-2', null, null, null],
      esperaConstraint: 'chk_conferida_conclusao',
    },
    {
      nome: 'nome do conferente em branco — o selo diria "conferido · "',
      args: ['pv2', EMPRESA, 'conc-1', 'u-1', 'c-1', '  ', 'c-2', null, null, null],
      esperaConstraint: 'chk_conferida_quem',
    },
    {
      nome: 'colaborador do PIN em branco',
      args: ['pv3', EMPRESA, 'conc-1', 'u-1', '', 'cristian', 'c-2', null, null, null],
      esperaConstraint: 'chk_conferida_quem',
    },
    {
      nome: '⛔⛔ AUTO-CONFERÊNCIA pelo COLABORADOR (o PIN do declarante)',
      args: ['pv4', EMPRESA, 'conc-1', 'u-1', 'c-1', 'eliane', 'c-1', null, null, null],
      esperaConstraint: 'chk_conferida_nao_e_o_declarante_colab',
    },
    {
      nome: '⛔⛔ AUTO-CONFERÊNCIA pelo USUÁRIO (o gerente que concluiu pela tela)',
      args: ['pv5', EMPRESA, 'conc-1', 'u-1', 'c-1', 'cristian', 'c-2', 'u-1', null, null],
      esperaConstraint: 'chk_conferida_nao_e_o_declarante_user',
    },
    {
      nome: '⭐ MEIA-CORREÇÃO: número novo SEM motivo',
      args: ['pv6', EMPRESA, 'conc-1', 'u-1', 'c-1', 'cristian', 'c-2', null, 7, null],
      esperaConstraint: 'chk_conferida_correcao_completa',
    },
    {
      nome: '⭐ MEIA-CORREÇÃO: número novo com motivo em BRANCO (o furo do length(trim))',
      args: ['pv7', EMPRESA, 'conc-1', 'u-1', 'c-1', 'cristian', 'c-2', null, 7, '   '],
      esperaConstraint: 'chk_conferida_correcao_completa',
    },
    {
      nome: '⭐ MEIA-CORREÇÃO ao contrário: motivo SEM número',
      args: ['pv8', EMPRESA, 'conc-1', 'u-1', 'c-1', 'cristian', 'c-2', null, null, 'contou errado'],
      esperaConstraint: 'chk_conferida_correcao_completa',
    },
  ]

  console.log('\n═══════ INSERTS TORTOS — o banco tem que RECUSAR ═══════')
  let recusados = 0
  for (const c of tortos) {
    try {
      await prisma.$executeRawUnsafe(SQL, ...(c.args as never[]))
      console.log(`  ⛔⛔ ${c.nome} → PASSOU (o CHECK ${c.esperaConstraint} NÃO morde)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const ok = msg.includes(c.esperaConstraint)
      console.log(
        `  ${ok ? '✓' : '⚠️'} ${c.nome} → recusado${ok ? ` por ${c.esperaConstraint}` : ` mas por OUTRA razão: ${msg.slice(0, 140)}`}`,
      )
      if (ok) recusados++
    }
  }

  console.log('\n═══════ OS LEGÍTIMOS TÊM QUE ENTRAR (e saem depois) ═══════')
  const legitimos: { nome: string; args: unknown[] }[] = [
    {
      nome: 'CONFIRMAR (o caminho de todo dia): conferente ≠ declarante, sem correção',
      args: ['pv-ok-1', EMPRESA, 'conc-ok-1', 'u-ger', 'c-conf', 'cristian', 'c-decl', null, null, null],
    },
    {
      /** ⭐ o caso que a lógica de três valores tem que ACEITAR — 397 conclusões são assim */
      nome: '⭐ declarante NULL nos DOIS eixos (conclusão do tablet sem colaborador)',
      args: ['pv-ok-2', EMPRESA, 'conc-ok-2', 'u-ger', 'c-conf', 'cristian', null, null, null, null],
    },
    {
      nome: 'CORRIGIR completo: número + motivo',
      args: ['pv-ok-3', EMPRESA, 'conc-ok-3', 'u-ger', 'c-conf', 'cristian', 'c-decl', null, 10, 'contou errado'],
    },
    {
      /** ⚠️ zero é um VALOR: `corrigiuDe: 0` com motivo é correção legítima (declarou 0 por erro) */
      nome: '⚠️ corrigiuDe ZERO com motivo (zero é valor, não ausência)',
      args: ['pv-ok-4', EMPRESA, 'conc-ok-4', 'u-ger', 'c-conf', 'cristian', 'c-decl', null, 0, 'digitou errado'],
    },
  ]
  let legitimosOk = 0
  for (const l of legitimos) {
    try {
      await prisma.$executeRawUnsafe(SQL, ...(l.args as never[]))
      console.log(`  ✓ ${l.nome} → ENTROU`)
      legitimosOk++
    } catch (e) {
      console.log(`  ⛔⛔ ${l.nome} → RECUSADO: ${e instanceof Error ? e.message.slice(0, 160) : e}`)
    }
  }

  console.log('\n═══════ UM CARIMBO POR CONCLUSÃO — o índice único ═══════')
  try {
    await prisma.$executeRawUnsafe(
      SQL,
      ...(['pv-dup', EMPRESA, 'conc-ok-1', 'u-outro', 'c-outro', 'marcyelle', 'c-decl', null, null, null] as never[]),
    )
    console.log('  ⛔⛔ o 2º carimbo da MESMA conclusão PASSOU — o selo diria "conferido" 2×, com 2 nomes')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ✓ o 2º carimbo foi recusado (${msg.includes('23505') ? '23505, chave única' : msg.slice(0, 80)})`)
  }

  /**
   * ⛔⛔ O CONTRAFACTUAL MEDIDO NO PRÓPRIO BANCO — a razão de existir da REGRA 13.
   *
   * A forma INGÊNUA do anti-auto-conferência (`conferido <> declarado`, sem o `IS NULL`
   * explícito) **ACEITA** o caso do declarante NULL por acidente — e, pior, é uma expressão
   * NULL, então ela passaria **mesmo que a semântica fosse pra barrar**. O par abaixo prova que
   * a lógica de três valores é REAL, e que a nossa forma decide DE PROPÓSITO.
   */
  console.log('\n═══════ CONTRAFACTUAL — a lógica de TRÊS valores, medida ═══════')
  const [tres] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean }[]>(
    `SELECT ('c-1' <> NULL::text) AS ingenua,
            (NULL::text IS NULL OR 'c-1' <> NULL::text) AS nossa`,
  )
  console.log(`  a forma INGÊNUA sobre NULL devolve: ${tres.ingenua === null ? 'NULL → o CHECK PASSARIA sem decidir' : String(tres.ingenua)}`)
  console.log(`  a NOSSA forma sobre NULL devolve:   ${String(tres.nossa)} → decide de propósito`)
  const [meia] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean }[]>(
    `SELECT (length(trim(NULL::text)) > 0) AS ingenua,
            (NULL::text IS NOT NULL AND length(trim(NULL::text)) > 0) AS nossa`,
  )
  console.log(`  meia-correção, forma INGÊNUA (só length): ${meia.ingenua === null ? 'NULL → PASSARIA' : String(meia.ingenua)}`)
  console.log(`  meia-correção, a NOSSA (IS NOT NULL antes): ${String(meia.nossa)} → RECUSA`)

  console.log('\n═══════ LIMPEZA — zero escrita líquida ═══════')
  await prisma.stockConclusaoConferida.deleteMany({
    where: { id: { in: ['pv-ok-1', 'pv-ok-2', 'pv-ok-3', 'pv-ok-4', 'pv-dup'] } },
  })
  const depois = await prisma.stockConclusaoConferida.count()
  console.log(`linhas depois: ${depois} (antes: ${antes})`)

  const ok = recusados === tortos.length && legitimosOk === legitimos.length && depois === antes
  console.log(
    `\n${ok ? '⭐ PROVA OK' : '⛔ PROVA FALHOU'} — ${recusados}/${tortos.length} tortos recusados · ` +
      `${legitimosOk}/${legitimos.length} legítimos aceitos · escrita líquida ${depois - antes}`,
  )
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error('⛔ prova abortou:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
