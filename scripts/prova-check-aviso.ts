/**
 * ⭐⭐⭐ A PROVA DAS DUAS REDES DO AVISO — contra POSTGRES REAL (04/10/2026).
 *
 * **Regra que nasce com este arquivo (ordem do dono):** ***todo CHECK novo nasce com teste de
 * INSERT torto em prod.***
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** — ele
 * mora no SQL da migration, e o `db push` do dev cria a tabela a partir do schema. No SQLite do
 * dev o INSERT torto **PASSA**, e isso não é o CHECK falhando: é ele não existir ali. Mesmo
 * padrão de `scripts/stock-fase1-prova-ledger.ts` (o trigger de imutabilidade do ledger, que é
 * Postgres-only e foi tirado do dev por isso).
 *
 * ⛔⛔ **E FOI EXATAMENTE ESTA PROVA QUE PEGOU O FURO.** A 1ª versão do `chk_aviso_acao_completa`
 * **não bloqueava** o botão pela metade:
 *     (rótulo IS NULL AND href IS NULL)                      -> false
 *     OR (length(trim(rótulo))>0 AND length(trim(href))>0)   -> true AND NULL = NULL
 *     false OR NULL = NULL   →   e **CHECK com expressão NULL PASSA**
 * `length(trim(NULL))` não é 0, é NULL, e NULL contamina o `AND` inteiro. Nenhum teste da suíte
 * poderia ter visto isso, porque o CHECK não existe no dev.
 *
 * ⚠️ NADA é gravado: os 5 INSERTs são feitos pra FALHAR, e o script confere a contagem antes e
 * depois. Se algum entrar, ele apaga e ACUSA.
 *
 * USO (no servidor):  npx tsx scripts/prova-check-aviso.ts --empresa=<companyId>
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { registrarAviso } from '../lib/avisos/central'
import { AvisoMudoError } from '../lib/avisos/lingua-do-balcao'
import type { NovoAviso } from '../lib/avisos/tipos'

const ID_DE_PROVA = 'prova-check-aviso'

interface Caso {
  nome: string
  sql: () => Promise<unknown>
  constraintEsperada: string
}

async function main() {
  const empresaId = process.argv.slice(2).find((a) => a.startsWith('--empresa='))?.split('=')[1]
  if (!empresaId) {
    console.error('⛔ falta --empresa=<companyId>')
    process.exit(1)
  }
  /** ⛔ REGRA 8b — prova contra QUAL banco antes de medir */
  const nome = await exigirEmpresaNesteBanco(prisma, empresaId)
  console.log(`\n⭐ empresa: ${nome} (${empresaId})`)

  const antes = await prisma.aviso.count()
  console.log(`avisos na tabela ANTES: ${antes}`)

  /** ⚠️ `$executeRawUnsafe` de propósito: a prova é do BANCO, então ela não pode passar por
   *  nenhuma validação nossa — é justamente o caminho "por fora da porta". */
  const insere = (campos: Record<string, string | null>, sufixo: string) => {
    const base: Record<string, string | null> = {
      id: `${ID_DE_PROVA}-${sufixo}`,
      companyId: empresaId,
      setor: 'producao',
      severidade: 'ambar',
      titulo: 'Corrija a ficha',
      corpo: 'porque a conta nao fecha',
      oQueFazer: 'Abra a ficha e conserte.',
      acaoRotulo: null,
      acaoHref: null,
      origem: 'PROVA',
      alvo: sufixo,
      ...campos,
    }
    const cols = Object.keys(base).map((c) => `"${c}"`).join(',')
    const vals = Object.values(base)
      .map((v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`))
      .join(',')
    return prisma.$executeRawUnsafe(
      `INSERT INTO "aviso" (${cols},"atualizadoEm") VALUES (${vals}, now())`,
    )
  }

  const casos: Caso[] = [
    {
      nome: 'aviso MUDO — sem "o que fazer"',
      sql: () => insere({ oQueFazer: '   ' }, 'mudo'),
      constraintEsperada: 'chk_aviso_fala',
    },
    {
      nome: 'aviso MUDO — sem título',
      sql: () => insere({ titulo: '' }, 'sem-titulo'),
      constraintEsperada: 'chk_aviso_fala',
    },
    /** ⛔⛔ O CASO QUE PASSOU na 1ª versão — rótulo sem destino */
    {
      nome: 'botão pela METADE — rótulo sem href (o furo dos 3 valores)',
      sql: () => insere({ acaoRotulo: 'ir' }, 'meio-botao-a'),
      constraintEsperada: 'chk_aviso_acao_completa',
    },
    /** ⛔ e o espelho dele — href sem rótulo (link invisível) */
    {
      nome: 'botão pela METADE — href sem rótulo',
      sql: () => insere({ acaoHref: '/x' }, 'meio-botao-b'),
      constraintEsperada: 'chk_aviso_acao_completa',
    },
    /** ⚠️ e o estado misto por STRING VAZIA, que não é NULL mas também não é botão */
    {
      nome: 'botão com rótulo vazio',
      sql: () => insere({ acaoRotulo: '   ', acaoHref: '/x' }, 'meio-botao-c'),
      constraintEsperada: 'chk_aviso_acao_completa',
    },
    {
      nome: 'setor em CAIXA ALTA (forma)',
      sql: () => insere({ setor: 'PRODUCAO' }, 'forma'),
      constraintEsperada: 'chk_aviso_forma',
    },
  ]

  console.log('\n── REDE 1: o BANCO recusa quem grava por fora da porta ──')
  let falhasEsperadas = 0
  for (const c of casos) {
    try {
      await c.sql()
      console.log(`  ⛔⛔ ENTROU (o CHECK não bloqueou!): ${c.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const bateu = msg.includes(c.constraintEsperada)
      console.log(`  ${bateu ? '✓' : '⚠️'} recusado por ${bateu ? c.constraintEsperada : `OUTRO check — ${msg.slice(0, 120)}`}: ${c.nome}`)
      if (bateu) falhasEsperadas++
    }
  }
  console.log(`  → ${falhasEsperadas} de ${casos.length} recusados pelo CHECK certo`)

  console.log('\n── REDE 2: a LIB recusa ANTES, com a mensagem boa ──')
  const pelaLib: { nome: string; aviso: NovoAviso; esperado: RegExp }[] = [
    {
      nome: 'sem "o que fazer"',
      aviso: {
        companyId: empresaId, setor: 'producao', severidade: 'ambar',
        titulo: 'Corrija a ficha', corpo: 'porque nao fecha', oQueFazer: '',
        origem: 'PROVA', alvo: 'lib-1',
      },
      esperado: /sem "o que fazer"/,
    },
    {
      nome: 'botão pela metade',
      aviso: {
        companyId: empresaId, setor: 'producao', severidade: 'ambar',
        titulo: 'Corrija a ficha', corpo: 'porque nao fecha', oQueFazer: 'Abra a ficha.',
        acaoRotulo: 'ir', acaoHref: null,
        origem: 'PROVA', alvo: 'lib-2',
      },
      esperado: /pela metade/,
    },
    {
      nome: 'título que descreve em vez de mandar a ação',
      aviso: {
        companyId: empresaId, setor: 'producao', severidade: 'ambar',
        titulo: 'Rendimento fora da faixa', corpo: 'porque nao fecha', oQueFazer: 'Abra a ficha.',
        origem: 'PROVA', alvo: 'lib-3',
      },
      esperado: /precisa ser a AÇÃO/,
    },
    {
      nome: 'destino externo (open redirect)',
      aviso: {
        companyId: empresaId, setor: 'producao', severidade: 'ambar',
        titulo: 'Corrija a ficha', corpo: 'porque nao fecha', oQueFazer: 'Abra a ficha.',
        acaoRotulo: 'ir', acaoHref: '//evil.com',
        origem: 'PROVA', alvo: 'lib-4',
      },
      esperado: /caminho interno/,
    },
  ]
  let libOk = 0
  for (const c of pelaLib) {
    try {
      await registrarAviso(c.aviso)
      console.log(`  ⛔⛔ A LIB DEIXOU PASSAR: ${c.nome}`)
    } catch (e) {
      const mudo = e instanceof AvisoMudoError
      const bate = mudo && c.esperado.test(e.motivo)
      console.log(`  ${bate ? '✓' : '⚠️'} ${mudo ? `recusado: ${e.motivo}` : `erro inesperado: ${String(e).slice(0, 100)}`}`)
      if (bate) libOk++
    }
  }
  console.log(`  → ${libOk} de ${pelaLib.length} recusados pela lib, com a mensagem certa`)

  /** ⛔ e NADA pode ter entrado — se entrou, apaga e acusa */
  const sujeira = await prisma.aviso.findMany({
    where: { OR: [{ id: { startsWith: ID_DE_PROVA } }, { origem: 'PROVA' }] },
    select: { id: true, titulo: true },
  })
  if (sujeira.length) {
    console.log(`\n⛔⛔ ${sujeira.length} linha(s) da prova ENTRARAM — apagando:`)
    for (const s of sujeira) console.log(`   ${s.id} · ${s.titulo}`)
    await prisma.aviso.deleteMany({ where: { id: { in: sujeira.map((s) => s.id) } } })
  }

  const depois = await prisma.aviso.count()
  console.log(`\navisos na tabela DEPOIS: ${depois} (tem que ser ${antes})`)
  const ok = falhasEsperadas === casos.length && libOk === pelaLib.length && depois === antes
  console.log(ok ? '\n⭐ AS DUAS REDES ESTÃO DE PÉ · zero escrita' : '\n⛔ ALGO PASSOU — ver acima')
  if (!ok) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
