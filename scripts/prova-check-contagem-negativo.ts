/**
 * ⭐⭐⭐ A PROVA DOS CHECKS DO RASTRO DO NEGATIVO — contra POSTGRES REAL (05/10/2026).
 *
 * **REGRA 13 da casa:** ***todo CHECK novo nasce com teste de INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele não existir ali. Mesmo
 * padrão de `scripts/prova-check-aviso.ts` e do trigger de imutabilidade do ledger.
 *
 * ⛔⛔⛔ **E ESTA PROVA EXISTE PORQUE O CHECK NASCEU ERRADO — o caso 5 é o que pegou.** O
 * `chk_contagem_negativo_era_negativo` era `saldoAntes < 0 OR valorAntes < 0`, mais ESTREITO que
 * a definição de `eraNegativo` (que também é verdadeira com **custo médio ≤ 0**, isto é saldo em
 * pé com valor ZERADO). Medido em prod: **2 itens nesse estado** (`FANTA UVA 2L` 7 UN · R$ 0,00 e
 * `acucar` 5 · R$ 0,00). Contar um deles criaria a linha com `valorAntes = 0`, o CHECK recusaria,
 * e a transação da contagem voltaria atrás: **"nenhum caminho termina em recusa" quebrado só em
 * PRODUÇÃO**. O caso 5 prova que a linha legítima ENTRA, e o contrafactual mostra o CHECK antigo
 * recusando-a.
 *
 * ⚠️ ZERO ESCRITA: os INSERTs tortos são feitos pra FALHAR, o caso legítimo é desfeito no fim, e
 * o script confere a contagem antes e depois — se algo sobrar, ele apaga e ACUSA.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-contagem-negativo.ts --empresa=<companyId>
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { contarLinha, ContagemError } from '../lib/stock/contagem'

const ID_DE_PROVA = 'prova-chk-cneg'

interface Caso {
  nome: string
  campos: Record<string, string | number | null>
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

  const antes = await prisma.stockContagemNegativo.count()
  console.log(`linhas na tabela ANTES: ${antes}`)

  /** ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO, então ela não pode passar por
   *  nenhuma validação nossa — é justamente o caminho "por fora da porta". */
  const insere = (campos: Record<string, string | number | null>, sufixo: string) => {
    const base: Record<string, string | number | null> = {
      id: `${ID_DE_PROVA}-${sufixo}`,
      companyId: empresaId,
      contagemId: `${ID_DE_PROVA}-sessao`,
      itemId: `${ID_DE_PROVA}-item`,
      saldoAntes: -3.56,
      valorAntes: -31.46,
      contado: 6,
      motivo: 'FICHA_ERRADA',
      baseDoCusto: 'ULTIMO_CONHECIDO',
      custoUsado: 34,
      residuo: -89.58,
      registradoPorId: null,
      registradoPorNome: null,
      ...campos,
    }
    const cols = Object.keys(base).map((c) => `"${c}"`).join(',')
    const vals = Object.values(base)
      .map((v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`))
      .join(',')
    return prisma.$executeRawUnsafe(
      `INSERT INTO "stock_contagem_negativo" (${cols},"criadoEm") VALUES (${vals}, now())`,
    )
  }

  const casos: Caso[] = [
    {
      nome: 'motivo VAZIO — rastro sem causa não é rastro',
      campos: { motivo: '   ' },
      constraintEsperada: 'chk_contagem_negativo_motivo',
    },
    {
      nome: 'base do custo VAZIA — a valoração tem que dizer em que se apoiou',
      campos: { baseDoCusto: '' },
      constraintEsperada: 'chk_contagem_negativo_base',
    },
    {
      nome: 'contagem NEGATIVA — não existe contar menos que zero',
      campos: { contado: -1 },
      constraintEsperada: 'chk_contagem_negativo_contado',
    },
    /** ⛔⛔ a linha sobre item SÃO: dado que mente sobre o porquê da investigação */
    {
      nome: 'item SÃO (saldo em pé e dinheiro em pé) — não havia negativo pra investigar',
      campos: { saldoAntes: 10, valorAntes: 340 },
      constraintEsperada: 'chk_contagem_negativo_era_negativo',
    },
  ]

  console.log('\n── REDE 1: o BANCO recusa quem grava por fora da porta ──')
  let recusadosCerto = 0
  for (const [i, c] of casos.entries()) {
    try {
      await insere(c.campos, `torto-${i}`)
      console.log(`  ⛔⛔ ENTROU (o CHECK não bloqueou!): ${c.nome}`)
      await prisma.$executeRawUnsafe(
        `DELETE FROM "stock_contagem_negativo" WHERE "id" LIKE '${ID_DE_PROVA}%'`,
      )
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
   * ⭐⭐ REDE 2 — O CASO LEGÍTIMO **ENTRA**. É o lado que falta em quase todo guard de CHECK:
   * provar que ele não barra o certo. *Guard que barra o legítimo ensina a afrouxar a régua.*
   */
  console.log('\n── REDE 2: a linha LEGÍTIMA de custo médio ZERO entra (o defeito de 05/10) ──')
  let legitimaEntrou = false
  try {
    await insere({ saldoAntes: 5, valorAntes: 0, custoUsado: 0, baseDoCusto: 'A_DEFINIR', residuo: 0 }, 'legitima')
    legitimaEntrou = true
    console.log('  ✓ ENTROU: saldo 5 em pé com valor R$ 0,00 (o `acucar` de prod) — custo médio 0 É negativo pela régua')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ⛔⛔ RECUSADA — o CHECK está estreito demais e a contagem desse item FALHA em prod: ${msg.slice(0, 160)}`)
  } finally {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "stock_contagem_negativo" WHERE "id" LIKE '${ID_DE_PROVA}%'`,
    )
  }

  /** ⚠️ O CONTRAFACTUAL: o CHECK ANTIGO recusaria essa mesma linha — medido no próprio Postgres,
   *  sem reaplicar migration nenhuma (a expressão é avaliada pelo banco). */
  const [{ antigo, atual }] = await prisma.$queryRawUnsafe<{ antigo: boolean; atual: boolean }[]>(
    'SELECT (5 < 0 OR 0 < 0) AS antigo, (5 < 0 OR 0 <= 0) AS atual',
  )
  console.log(`  contrafactual no banco → CHECK antigo aceita? ${antigo} · CHECK novo aceita? ${atual}`)

  /** ⭐ REDE 3 — a LIB recusa ANTES, e a recusa é PERGUNTA (409 com as 4 opções), nunca beco */
  console.log('\n── REDE 3: a LIB pergunta o motivo ANTES de gravar (não é recusa) ──')
  try {
    await contarLinha(
      {
        companyId: empresaId, contagemId: `${ID_DE_PROVA}-sessao`, itemId: `${ID_DE_PROVA}-item`,
        qtdContada: 6, confirmarFreio: true, viuSistema: true, observacao: null,
      },
      prisma,
    )
    console.log('  ⚠️ não perguntou (item de prova não existe — esperado; a pergunta tem teste de integração próprio)')
  } catch (e) {
    const code = e instanceof ContagemError ? e.code : null
    console.log(`  ${code === 'MOTIVO_DO_NEGATIVO' ? '✓ PERGUNTOU' : `· parou antes (${code ?? 'erro'})`}: ${(e as Error).message.slice(0, 120)}`)
  }

  const depois = await prisma.stockContagemNegativo.count()
  const sobrou = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "stock_contagem_negativo" WHERE "id" LIKE '${ID_DE_PROVA}%'`,
  )
  console.log(`\nlinhas na tabela DEPOIS: ${depois} (antes ${antes}) · resíduo da prova: ${sobrou[0].n}`)
  const limpo = depois === antes && Number(sobrou[0].n) === 0
  console.log(limpo ? '⭐ ZERO escrita — o banco está como estava' : '⛔⛔ SOBROU dado da prova — conferir à mão')
  console.log(
    `\nVEREDITO: ${recusadosCerto === casos.length && legitimaEntrou && limpo ? '⭐ os CHECKs recusam o torto E aceitam o legítimo' : '⛔ conferir acima'}`,
  )
}

main()
  .catch((e) => {
    console.error('⛔', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
