/**
 * ⚠️ REGRA 13 — TODO CHECK NOVO NASCE COM PROVA DE INSERT TORTO CONTRA POSTGRES.
 *
 * ⛔ CHECK **não existe no schema Prisma** (mora no SQL da migration), e o `db push` do dev cria
 * a tabela a partir do schema → no SQLite o INSERT torto PASSA, e isso não é o CHECK falhando:
 * é ele não existir ali. Logo, a prova é script contra Postgres, nunca teste da suíte.
 *
 * ⭐⭐ E O CASO QUE MAIS IMPORTA AQUI É O 5º: `somaValor` é **NULLABLE de propósito** (o relatório
 * de complementos não declara valor que sirva de régua), então o CHECK dele é **lógica de três
 * valores**. `"somaValor" >= 0` sozinho devolve **NULL** quando a coluna é NULL — e
 * ***CHECK com expressão NULL PASSA***, que foi o furo do `chk_aviso_acao_completa` de 04/10.
 * Por isso o `IS NULL` vem EXPLÍCITO e PRIMEIRO, e este script mede o contrafactual no próprio
 * banco em vez de eu afirmar que a forma está certa.
 *
 * ⭐ ZERO ESCRITA LÍQUIDA: conta as linhas antes e depois e aborta se não voltar ao mesmo.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

type Caso = { nome: string; args: unknown[]; esperaConstraint: string }

const SQL =
  `INSERT INTO "stock_venda_arquivo" ` +
  `("id","companyId","data","relatorio","nomeArquivo","linhasArquivo","somaQuantidade","somaValor","modo") ` +
  `VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const antes = await prisma.stockVendaArquivo.count()
  console.log(`\nlinhas antes: ${antes}`)

  const d = new Date('2000-01-01T12:00:00Z') // ⚠️ data de prova no passado, longe de dado real

  const tortos: Caso[] = [
    {
      nome: 'relatorio minúsculo (forma, não vocabulário)',
      args: ['pv1', EMPRESA, d, 'produtos', 'a.xls', 1, 1, 10, 'DIA'],
      esperaConstraint: 'chk_venda_arquivo_relatorio',
    },
    {
      nome: 'modo em branco',
      args: ['pv2', EMPRESA, d, 'PRODUTOS', 'a.xls', 1, 1, 10, '   '],
      esperaConstraint: 'chk_venda_arquivo_modo',
    },
    {
      nome: 'nome do arquivo só espaço',
      args: ['pv3', EMPRESA, d, 'PRODUTOS', '   ', 1, 1, 10, 'DIA'],
      esperaConstraint: 'chk_venda_arquivo_nome',
    },
    {
      nome: 'arquivo de ZERO linha (não é arquivo que entrou)',
      args: ['pv4', EMPRESA, d, 'PRODUTOS', 'a.xls', 0, 0, 10, 'DIA'],
      esperaConstraint: 'chk_venda_arquivo_linhas',
    },
    {
      nome: 'quantidade negativa',
      args: ['pv5', EMPRESA, d, 'PRODUTOS', 'a.xls', 1, -3, 10, 'DIA'],
      esperaConstraint: 'chk_venda_arquivo_qtd',
    },
    {
      nome: '⭐ Σ em R$ NEGATIVO (o caso do IS NOT NULL explícito)',
      args: ['pv6', EMPRESA, d, 'PRODUTOS', 'a.xls', 1, 1, -0.01, 'DIA'],
      esperaConstraint: 'chk_venda_arquivo_valor',
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
      nome: 'PRODUTOS com Σ em R$ (o caminho de todo dia)',
      args: ['pv-ok-1', EMPRESA, d, 'PRODUTOS', 'Relatorio_Produtos.xls', 214, 1240, 18743.9, 'DIA'],
    },
    {
      /** ⭐ o caso que o CHECK de três valores tem que ACEITAR — 34% das linhas valem R$ 0,00 */
      nome: '⭐ COMPLEMENTOS com somaValor NULL ("não declara", nunca "somava zero")',
      args: ['pv-ok-2', EMPRESA, d, 'COMPLEMENTOS', 'Relatorio_Complementos.xls', 612, 612, null, 'DIA'],
    },
    {
      nome: 'Σ em R$ ZERO (zero é um valor, não ausência)',
      args: ['pv-ok-3', EMPRESA, new Date('2000-01-02T12:00:00Z'), 'PRODUTOS', 'a.xls', 1, 1, 0, 'PERIODO'],
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

  console.log('\n═══════ UM ARQUIVO POR (dia, relatório) — o índice único ═══════')
  try {
    await prisma.$executeRawUnsafe(
      SQL,
      ...(['pv-dup', EMPRESA, d, 'PRODUTOS', 'outro.xls', 1, 1, 1, 'DIA'] as never[]),
    )
    console.log('  ⛔⛔ a 2ª linha do MESMO dia+relatório PASSOU — dois Σ declarados pro mesmo dia')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ✓ a 2ª linha do mesmo dia+relatório foi recusada (${msg.includes('23505') ? '23505, chave única' : msg.slice(0, 80)})`)
  }

  /**
   * ⛔⛔ O CONTRAFACTUAL MEDIDO NO PRÓPRIO BANCO — a razão de existir da REGRA 13.
   *
   * A forma INGÊNUA (`"somaValor" >= 0`, sem o `IS NULL` explícito) **ACEITA** `NULL`, porque a
   * expressão vira NULL e CHECK com NULL passa. Aqui isso seria inofensivo por sorte (NULL é
   * legítimo); o que o par abaixo prova é que a lógica de três valores é REAL, e por isso a
   * forma do nosso CHECK não pode depender dela por acaso.
   */
  console.log('\n═══════ CONTRAFACTUAL — a lógica de TRÊS valores, medida ═══════')
  const [tres] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean }[]>(
    `SELECT (NULL::double precision >= 0) AS ingenua,
            (NULL::double precision IS NULL OR NULL::double precision >= 0) AS nossa`,
  )
  console.log(`  a forma INGÊNUA sobre NULL devolve: ${tres.ingenua === null ? 'NULL → o CHECK PASSARIA' : String(tres.ingenua)}`)
  console.log(`  a NOSSA forma sobre NULL devolve:   ${String(tres.nossa)} → decide de propósito`)

  console.log('\n═══════ LIMPEZA — zero escrita líquida ═══════')
  await prisma.stockVendaArquivo.deleteMany({
    where: { id: { in: ['pv-ok-1', 'pv-ok-2', 'pv-ok-3', 'pv-dup'] } },
  })
  const depois = await prisma.stockVendaArquivo.count()
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
