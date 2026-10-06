/**
 * ⭐⭐⭐ REGRA 13 — A PROVA DOS CHECKS CONTRA POSTGRES (06/10/2026).
 *
 * **A régua, ditada pelo dono em 04/10:** *"CHECK com coluna nullable é lógica de três valores:
 * todo CHECK novo nasce com teste de INSERT torto em PROD."*
 *
 * ⛔⛔ **POR QUE ISTO NÃO PODE SER TESTE DA SUÍTE:** CHECK **não existe no schema Prisma** (mora
 * no SQL da migration) e o `db push` do dev cria a tabela a partir do schema → **no SQLite o
 * INSERT torto PASSA**, e isso não é o CHECK falhando, é ele não existir ali. Foi exatamente
 * assim que o `chk_aviso_acao_completa` ficou furado sem ninguém ver.
 *
 * ⛔ READ-ONLY no efeito: toda tentativa é um INSERT que o banco tem que RECUSAR, e a prova
 * confere a contagem antes/depois. O único INSERT legítimo é desfeito no fim.
 *
 * USO: npx tsx scripts/prova-check-custos-fixos.ts
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const CO = 'cmq17yapb00gnrndlh33sctbo'

interface Tentativa {
  nome: string
  sql: string
  /** o nome da CONSTRAINT que tem que recusar — recusa por outro motivo não prova nada */
  constraint: string
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`\n⭐ empresa: ${nome} (${CO})`)

  const cat = await prisma.category.findFirst({
    where: { companyId: CO, type: 'EXPENSE', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  if (!cat) throw new Error('nenhuma categoria de despesa — a prova precisa de uma FK válida')
  console.log(`   categoria da prova: «${cat.name}» (${cat.id})`)

  const antes = {
    categoria: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    planejado: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
  }
  console.log(`   antes: ${antes.categoria} marcação(ões) · ${antes.planejado} plano(s)`)

  const T = (s: string) => `'${s}'`
  const tortos: Tentativa[] = [
    {
      nome: 'MARCAÇÃO com autor de remoção e SEM data de remoção (meia-remoção)',
      constraint: 'chk_custo_fixo_categoria_remocao',
      sql: `INSERT INTO "custo_fixo_categoria" ("id","companyId","categoryId","removidoPorId")
            VALUES (${T('prova-torto-1')}, ${T(CO)}, ${T(cat.id)}, ${T('alguem')})`,
    },
    {
      nome: 'PLANO com valor NEGATIVO',
      constraint: 'chk_custo_fixo_planejado_valor',
      sql: `INSERT INTO "custo_fixo_planejado" ("id","companyId","categoryId","mes","valor","atualizadoEm")
            VALUES (${T('prova-torto-2')}, ${T(CO)}, ${T(cat.id)}, ${T('2026-10')}, -1, NOW())`,
    },
    {
      nome: 'PLANO com mês em formato livre ("outubro")',
      constraint: 'chk_custo_fixo_planejado_mes',
      sql: `INSERT INTO "custo_fixo_planejado" ("id","companyId","categoryId","mes","valor","atualizadoEm")
            VALUES (${T('prova-torto-3')}, ${T(CO)}, ${T(cat.id)}, ${T('outubro')}, 10, NOW())`,
    },
    {
      nome: 'PLANO com mês 13 (o mês que não existe)',
      constraint: 'chk_custo_fixo_planejado_mes',
      sql: `INSERT INTO "custo_fixo_planejado" ("id","companyId","categoryId","mes","valor","atualizadoEm")
            VALUES (${T('prova-torto-4')}, ${T(CO)}, ${T(cat.id)}, ${T('2026-13')}, 10, NOW())`,
    },
    {
      nome: 'PLANO com mês sem zero à esquerda ("2026-9")',
      constraint: 'chk_custo_fixo_planejado_mes',
      sql: `INSERT INTO "custo_fixo_planejado" ("id","companyId","categoryId","mes","valor","atualizadoEm")
            VALUES (${T('prova-torto-5')}, ${T(CO)}, ${T(cat.id)}, ${T('2026-9')}, 10, NOW())`,
    },
  ]

  let recusados = 0
  console.log('\n══════ OS INSERTS QUE O BANCO TEM QUE RECUSAR ══════')
  for (const t of tortos) {
    try {
      await prisma.$executeRawUnsafe(t.sql)
      console.log(`   ⛔⛔ PASSOU (o CHECK está furado): ${t.nome}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const pelaConstraintCerta = msg.includes(t.constraint)
      recusados += pelaConstraintCerta ? 1 : 0
      console.log(
        `   ${pelaConstraintCerta ? '⭐ RECUSADO' : '⚠️ recusado por OUTRO motivo'}: ${t.nome}`
        + `${pelaConstraintCerta ? ` (${t.constraint})` : ` → ${msg.split('\n').find((l) => l.trim()) ?? msg}`}`,
      )
    }
  }

  console.log('\n══════ O LEGÍTIMO TEM QUE ENTRAR (senão o CHECK é parede) ══════')
  const legitimos: { nome: string; sql: string; id: string }[] = [
    {
      nome: 'PLANO de valor ZERO ("declarei que aqui não sai nada")',
      id: 'prova-ok-1',
      sql: `INSERT INTO "custo_fixo_planejado" ("id","companyId","categoryId","mes","valor","atualizadoEm")
            VALUES (${T('prova-ok-1')}, ${T(CO)}, ${T(cat.id)}, ${T('1999-01')}, 0, NOW())`,
    },
    {
      nome: 'MARCAÇÃO sem remoção nenhuma (os dois campos nulos)',
      id: 'prova-ok-2',
      sql: `INSERT INTO "custo_fixo_categoria" ("id","companyId","categoryId")
            VALUES (${T('prova-ok-2')}, ${T(CO)}, ${T(cat.id)})`,
    },
  ]
  let aceitos = 0
  const criados: string[] = []
  for (const l of legitimos) {
    try {
      await prisma.$executeRawUnsafe(l.sql)
      aceitos++
      criados.push(l.id)
      console.log(`   ⭐ ENTROU: ${l.nome}`)
    } catch (e) {
      console.log(`   ⛔⛔ RECUSADO (o CHECK ficou mais estreito que a régua): ${l.nome} → ${e instanceof Error ? e.message.split('\n')[0] : e}`)
    }
  }

  /**
   * ⚠️ O CONTRAFACTUAL **MEDIDO NO PRÓPRIO BANCO**, e é ele que mata a lógica de três valores:
   * a forma ingênua do CHECK da remoção devolveria NULL — e **CHECK com expressão NULL PASSA**.
   */
  console.log('\n══════ O CONTRAFACTUAL DA LÓGICA DE TRÊS VALORES ══════')
  const r = await prisma.$queryRawUnsafe<{ ingenuo: boolean | null; nosso: boolean }[]>(
    `SELECT
       (NULL::timestamp IS NULL AND 'alguem'::text IS NULL) OR
         (length(trim(NULL::text)) > 0 AND length(trim('alguem'::text)) > 0) AS ingenuo,
       (NULL::timestamp IS NOT NULL OR 'alguem'::text IS NULL) AS nosso`,
  )
  const ing = r[0]?.ingenuo
  console.log(`   forma INGÊNUA (com length/trim): ${ing === null ? 'NULL → o CHECK PASSARIA ⛔' : ing}`)
  console.log(`   forma NOSSA (IS NOT NULL explícito): ${r[0]?.nosso} → o CHECK RECUSA ⭐`)

  // ─────────── desfaz tudo que esta prova criou ───────────
  if (criados.length) {
    await prisma.$executeRawUnsafe(`DELETE FROM "custo_fixo_planejado" WHERE "id" = ${T('prova-ok-1')}`)
    await prisma.$executeRawUnsafe(`DELETE FROM "custo_fixo_categoria" WHERE "id" = ${T('prova-ok-2')}`)
  }

  const depois = {
    categoria: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    planejado: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
  }
  const zeroEscrita = antes.categoria === depois.categoria && antes.planejado === depois.planejado

  console.log('\n══════ PLACAR ══════')
  console.log(`   tortos recusados pela constraint certa: ${recusados} de ${tortos.length}`)
  console.log(`   legítimos aceitos: ${aceitos} de ${legitimos.length}`)
  console.log(`   marcações ${antes.categoria} → ${depois.categoria} · planos ${antes.planejado} → ${depois.planejado}`)
  console.log(`   ${zeroEscrita ? '⭐ ZERO ESCRITA LÍQUIDA' : '⛔ sobrou linha da prova'}`)
  if (recusados !== tortos.length || aceitos !== legitimos.length || !zeroEscrita) process.exit(1)
}

main().catch((e) => { console.error('⛔', e); process.exit(1) }).finally(() => prisma.$disconnect())
