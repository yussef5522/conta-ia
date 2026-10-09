/**
 * ⚠️ REGRA 13 — TODO CHECK NOVO NASCE COM PROVA DE INSERT TORTO CONTRA POSTGRES.
 *
 * ⛔ CHECK **não existe no schema Prisma** (mora no SQL da migration), e o `db push` do dev cria
 * a tabela a partir do schema → no SQLite o INSERT torto PASSA, e isso não é o CHECK falhando:
 * é ele não existir ali. Logo, a prova é script contra Postgres, nunca teste da suíte.
 *
 * ⭐⭐ O CASO QUE MAIS IMPORTA AQUI É O DE **TRÊS VALORES**: `declaradoPorId` é **NULLABLE de
 * propósito** (397 das 448 conclusões vêm do tablet, sem usuário). Então:
 *   · `conferidoPorId <> declaradoPorId` com o declarado NULL devolve **NULL**
 *   · e ***CHECK com expressão NULL PASSA*** — o furo exato do `chk_aviso_acao_completa` (04/10)
 * Por isso o `IS NULL` vem EXPLÍCITO e PRIMEIRO, e este script mede o contrafactual no próprio
 * banco em vez de eu afirmar que a forma está certa.
 *
 * ⚠️ **ATUALIZADO EM 09/10 PRA A TABELA NOVA (`stock_conclusao_carimbo`).** O carimbo passou a
 * assinar pela SESSÃO: o PIN saiu do fluxo, e com ele a coluna `conferidoPorColaboradorId`
 * (NOT NULL na tabela velha) — era ela que tornava o carimbo-sem-PIN impossível de gravar.
 * ⛔ Consequência registrada: o eixo do COLABORADOR não tem mais CHECK, porque o conferente
 * não tem identidade de colaborador; comparar com NULL devolveria NULL e seria trava de papel.
 *
 * ⭐ ZERO ESCRITA LÍQUIDA: conta as linhas antes e depois e aborta se não voltar ao mesmo.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

type Caso = { nome: string; args: unknown[]; esperaConstraint: string }

const SQL =
  `INSERT INTO "stock_conclusao_carimbo" ` +
  `("id","companyId","conclusaoId","conferidoPorId","conferidoPorNome",` +
  `"declaradoPorId","declaradoPorColaboradorId","corrigiuDe","motivoDaCorrecao") ` +
  `VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const antes = await prisma.stockConclusaoCarimbo.count()
  console.log(`\nlinhas antes: ${antes}`)

  const tortos: Caso[] = [
    {
      nome: 'conclusaoId em branco (forma)',
      args: ['pv1', EMPRESA, '   ', 'u-1', 'marcyelle', null, 'c-2', null, null],
      esperaConstraint: 'chk_carimbo_conclusao',
    },
    {
      nome: 'nome do conferente em branco (o selo diria "conferido · " sem nome)',
      args: ['pv2', EMPRESA, 'conc-1', 'u-1', '  ', null, 'c-2', null, null],
      esperaConstraint: 'chk_carimbo_quem',
    },
    {
      nome: 'conferidoPorId em branco (carimbo sem assinatura)',
      args: ['pv3', EMPRESA, 'conc-1', '', 'marcyelle', null, 'c-2', null, null],
      esperaConstraint: 'chk_carimbo_quem',
    },
    {
      nome: '⭐⭐ AUTO-CONFERÊNCIA pelo eixo da SESSÃO (quem lançou carimbando a própria)',
      args: ['pv4', EMPRESA, 'conc-1', 'u-1', 'marcyelle', 'u-1', 'c-2', null, null],
      esperaConstraint: 'chk_carimbo_nao_e_o_declarante_user',
    },
    {
      nome: '⭐ MEIA-CORREÇÃO: número novo SEM motivo',
      args: ['pv5', EMPRESA, 'conc-1', 'u-1', 'marcyelle', null, 'c-2', 7, null],
      esperaConstraint: 'chk_carimbo_correcao_completa',
    },
    {
      nome: '⭐ MEIA-CORREÇÃO: número novo com motivo em BRANCO (o furo do length(trim))',
      args: ['pv6', EMPRESA, 'conc-1', 'u-1', 'marcyelle', null, 'c-2', 7, '   '],
      esperaConstraint: 'chk_carimbo_correcao_completa',
    },
    {
      nome: '⭐ MEIA-CORREÇÃO ao contrário: motivo SEM número',
      args: ['pv7', EMPRESA, 'conc-1', 'u-1', 'marcyelle', null, 'c-2', null, 'contou errado'],
      esperaConstraint: 'chk_carimbo_correcao_completa',
    },
  ]

  console.log('\n═══════ OS TORTOS TÊM QUE SER RECUSADOS ═══════')
  let okTortos = 0
  for (const c of tortos) {
    try {
      await prisma.$executeRawUnsafe(SQL, ...c.args)
      console.log(`  ⛔⛔ PASSOU (DEFEITO!): ${c.nome}`)
      await prisma.$executeRawUnsafe(`DELETE FROM "stock_conclusao_carimbo" WHERE "id" = $1`, c.args[0])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const pelaCerta = msg.includes(c.esperaConstraint)
      console.log(`  ${pelaCerta ? '✓' : '⚠️'} ${c.nome} → recusado por ${pelaCerta ? c.esperaConstraint : `OUTRA constraint: ${msg.slice(0, 120)}`}`)
      if (pelaCerta) okTortos++
    }
  }

  const legitimos: { nome: string; args: unknown[] }[] = [
    {
      nome: 'CONFIRMAR (o caminho de todo dia): conferente ≠ declarante, sem correção',
      args: ['pv-ok-1', EMPRESA, 'conc-ok-1', 'u-ger', 'marcyelle', 'u-outro', 'c-decl', null, null],
    },
    {
      nome: '⭐ conclusão do TABLET: declaradoPorId NULL (397 das 448 são assim)',
      args: ['pv-ok-2', EMPRESA, 'conc-ok-2', 'u-ger', 'marcyelle', null, 'c-decl', null, null],
    },
    {
      nome: 'CORRIGIR completo: número + motivo',
      args: ['pv-ok-3', EMPRESA, 'conc-ok-3', 'u-ger', 'marcyelle', null, 'c-decl', 10, 'contou errado'],
    },
    {
      nome: '⚠️ corrigiuDe ZERO com motivo (zero é valor, não ausência)',
      args: ['pv-ok-4', EMPRESA, 'conc-ok-4', 'u-ger', 'marcyelle', null, 'c-decl', 0, 'digitou errado'],
    },
  ]

  console.log('\n═══════ OS LEGÍTIMOS TÊM QUE ENTRAR (e saem depois) ═══════')
  let okLegit = 0
  for (const c of legitimos) {
    try {
      await prisma.$executeRawUnsafe(SQL, ...c.args)
      console.log(`  ✓ ${c.nome} → ENTROU`)
      okLegit++
    } catch (e) {
      console.log(`  ⛔⛔ RECUSADO (DEFEITO!): ${c.nome} — ${(e instanceof Error ? e.message : '').slice(0, 160)}`)
    }
  }

  console.log('\n═══════ UM CARIMBO POR CONCLUSÃO — o índice único ═══════')
  try {
    await prisma.$executeRawUnsafe(SQL, 'pv-dup', EMPRESA, 'conc-ok-1', 'u-x', 'cristian', null, null, null, null)
    console.log('  ⛔⛔ o 2º carimbo PASSOU (DEFEITO!)')
    await prisma.$executeRawUnsafe(`DELETE FROM "stock_conclusao_carimbo" WHERE "id" = 'pv-dup'`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ✓ o 2º carimbo foi recusado (${msg.includes('23505') || msg.includes('nique') ? '23505, chave única' : msg.slice(0, 80)})`)
  }

  console.log('\n═══════ CONTRAFACTUAL — a lógica de TRÊS valores, medida ═══════')
  const [t] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean | null }[]>(
    `SELECT ('u-1' <> NULL) AS ingenua,
            (NULL IS NULL OR 'u-1' <> NULL) AS nossa`,
  )
  console.log(`  a forma INGÊNUA sobre NULL devolve: ${t.ingenua === null ? 'NULL → o CHECK PASSARIA sem decidir' : t.ingenua}`)
  console.log(`  a NOSSA forma sobre NULL devolve:   ${t.nossa === null ? 'NULL' : `${t.nossa} → decide de propósito`}`)
  const [m] = await prisma.$queryRawUnsafe<{ ingenua: boolean | null; nossa: boolean | null }[]>(
    `SELECT (length(trim(NULL)) > 0) AS ingenua,
            (NULL IS NOT NULL AND length(trim(NULL)) > 0) AS nossa`,
  )
  console.log(`  meia-correção, forma INGÊNUA (só length): ${m.ingenua === null ? 'NULL → PASSARIA' : m.ingenua}`)
  console.log(`  meia-correção, a NOSSA (IS NOT NULL antes): ${m.nossa === null ? 'NULL' : `${m.nossa} → RECUSA`}`)

  console.log('\n═══════ LIMPEZA — zero escrita líquida ═══════')
  await prisma.$executeRawUnsafe(
    `DELETE FROM "stock_conclusao_carimbo" WHERE "id" LIKE 'pv-%' OR "id" LIKE 'pv%'`,
  )
  const depois = await prisma.stockConclusaoCarimbo.count()
  console.log(`linhas depois: ${depois} (antes: ${antes})`)

  const ok = okTortos === tortos.length && okLegit === legitimos.length && depois === antes
  console.log(
    ok
      ? `\n⭐ PROVA OK — ${okTortos}/${tortos.length} tortos recusados · ${okLegit}/${legitimos.length} legítimos aceitos · escrita líquida 0`
      : `\n⛔ PROVA FALHOU — tortos ${okTortos}/${tortos.length} · legítimos ${okLegit}/${legitimos.length} · linhas ${antes}→${depois}`,
  )
  await prisma.$disconnect()
  if (!ok) process.exit(1)
}

main().catch((e) => { console.error('[prova] erro:', e instanceof Error ? e.message : e); process.exit(1) })
