/**
 * ⭐⭐ REGRA 13 — A PROVA DOS CHECKs DE `stock_base_do_tamanho`, CONTRA POSTGRES (07/10/2026).
 *
 * ⛔⛔ POR QUE ISTO NÃO É TESTE DA SUÍTE: **CHECK não existe no schema Prisma** — ele mora no
 * SQL da migration. O `db push` do dev cria a tabela a partir do schema, então **no SQLite o
 * INSERT torto PASSA**, e isso não é o CHECK falhando: é ele não existir ali. A régua da casa
 * desde 04/10 é que todo CHECK novo ganha um script que tenta o INSERT torto contra Postgres e
 * exige a recusa **pelo nome da constraint**.
 *
 * ⚠️ E a REGRA 13 nasceu porque um CHECK com coluna nullable passou FURADO em prod
 * (`chk_aviso_acao_completa`): `length(trim(NULL))` não é 0, é NULL, e **CHECK com expressão
 * NULL PASSA**. Aqui as duas colunas são NOT NULL, então o furo de três valores não se aplica —
 * mas o contrafactual é medido no próprio banco, em vez de eu afirmar isso.
 *
 * ⛔ ZERO ESCRITA LÍQUIDA: tudo roda numa transação com ROLLBACK forçado, e a contagem de
 * linhas antes/depois é conferida.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const CO = process.env.PROVA_COMPANY_ID ?? 'cmq17yapb00gnrndlh33sctbo'

interface Caso {
  nome: string
  sql: string
  /** o nome da constraint que TEM que recusar — "aceita" quando a linha é legítima */
  esperado: string | 'aceita'
}

const CASOS: Caso[] = [
  {
    nome: 'tamanho em minúscula (o CHECK de FORMA)',
    sql: `INSERT INTO stock_base_do_tamanho (id, "companyId", tamanho, "fichaId") VALUES ('p1', $1, 'grande', 'f1')`,
    esperado: 'chk_base_tamanho_forma',
  },
  {
    nome: 'tamanho vazio',
    sql: `INSERT INTO stock_base_do_tamanho (id, "companyId", tamanho, "fichaId") VALUES ('p2', $1, '   ', 'f1')`,
    esperado: 'chk_base_tamanho_forma',
  },
  {
    nome: 'ficha vazia (base fantasma)',
    sql: `INSERT INTO stock_base_do_tamanho (id, "companyId", tamanho, "fichaId") VALUES ('p3', $1, 'GRANDE', '  ')`,
    esperado: 'chk_base_ficha',
  },
  {
    nome: 'o MESMO tamanho duas vezes (dois custos pra mesma pizza)',
    sql: `INSERT INTO stock_base_do_tamanho (id, "companyId", tamanho, "fichaId") VALUES ('p4', $1, 'GRANDE', 'f1'), ('p5', $1, 'GRANDE', 'f2')`,
    // ⚠️ MEDIDO em prod: pra violação de UNIQUE em raw query o Prisma devolve o código
    // `23505` com a CHAVE, e **não** o nome do índice. A chave identifica qual régua mordeu
    // tão bem quanto o nome — procurar o nome aqui era asserção sobre uma mensagem que não
    // existe, e foi o que fez esta prova sair 5 de 6 na 1ª rodada.
    esperado: '23505:("companyId", tamanho)',
  },
  {
    nome: 'LEGÍTIMO: GRANDE apontando pra uma ficha',
    sql: `INSERT INTO stock_base_do_tamanho (id, "companyId", tamanho, "fichaId") VALUES ('p6', $1, 'GRANDE', 'f1')`,
    esperado: 'aceita',
  },
  {
    nome: 'LEGÍTIMO: tamanho novo com espaço no meio (GRANDE PRECINHO)',
    sql: `INSERT INTO stock_base_do_tamanho (id, "companyId", tamanho, "fichaId") VALUES ('p7', $1, 'GRANDE PRECINHO', 'f2')`,
    esperado: 'aceita',
  },
]

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[prova] CHECKs de stock_base_do_tamanho · ${nome.trim()}`)

  const antes = await prisma.stockBaseDoTamanho.count()
  let ok = 0
  let falhou = 0

  for (const c of CASOS) {
    let recusadoPor: string | null = null
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(c.sql, CO)
        throw new Error('ROLLBACK_PROPOSITAL')
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'ROLLBACK_PROPOSITAL') recusadoPor = null
      // ⚠️ só o NOME da constraint conta: "deu erro" não prova qual régua mordeu
      else {
        const alvos = CASOS.map((x) => x.esperado).filter((n) => n !== 'aceita')
        recusadoPor =
          alvos.find((n) => {
            if (!n.startsWith('23505:')) return msg.includes(n)
            // ⭐ unique: o código do Postgres + a chave violada
            return msg.includes('23505') && msg.includes(n.slice('23505:'.length))
          }) ?? `outro: ${msg.replace(/\s+/g, ' ').slice(0, 110)}`
      }
    }

    const passou = c.esperado === 'aceita' ? recusadoPor === null : recusadoPor === c.esperado
    if (passou) ok++
    else falhou++
    console.log(
      `  ${passou ? '✓' : '⛔'} ${c.nome}\n       esperado: ${c.esperado} · veio: ${recusadoPor ?? 'ACEITO'}`,
    )
  }

  /**
   * ⭐⭐ O CONTRAFACTUAL, MEDIDO NO PRÓPRIO BANCO — e não uma afirmação minha: a forma INGÊNUA
   * do CHECK de forma (`length(trim(x)) > 0` sem o `upper`) **aceitaria** o tamanho em
   * minúscula, e aí `GRANDE` e `grande` seriam dois tamanhos com duas bases.
   */
  const [{ ingenuo, nosso }] = await prisma.$queryRawUnsafe<{ ingenuo: boolean; nosso: boolean }[]>(
    `SELECT (length(trim('grande')) > 0) AS ingenuo,
            ('grande' = upper('grande') AND length(trim('grande')) > 0) AS nosso`,
  )
  console.log(`\n  CONTRAFACTUAL do CHECK de forma com 'grande':`)
  console.log(`     ingênuo (só length) aceita? ${ingenuo}  ⛔ e aí 'grande' ≠ 'GRANDE' seriam duas bases`)
  console.log(`     o nosso (com upper)  aceita? ${nosso}  ⭐ RECUSA`)

  const depois = await prisma.stockBaseDoTamanho.count()
  console.log(`\n  linhas na tabela: ${antes} → ${depois} ${antes === depois ? '(ZERO ESCRITA ✓)' : '⛔ GRAVOU'}`)
  console.log(`  ${falhou === 0 && ingenuo && !nosso ? '⭐ PROVA OK' : '⛔ PROVA FALHOU'} · ${ok} de ${CASOS.length}`)
  if (falhou > 0 || antes !== depois) process.exit(1)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // ⛔ a mensagem do erro pode vazar a URI com a senha — nunca imprimir a exceção crua
    console.error('FALHOU:', e instanceof Error ? e.name : 'erro desconhecido')
    process.exit(1)
  })
