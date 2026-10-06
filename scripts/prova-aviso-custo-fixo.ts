/**
 * ⭐ O AVISO DO SININHO COM DADO REAL — demonstração com ROLLBACK (06/10/2026).
 *
 * ⚠️ O plano usado aqui é o REALIZADO DE AGOSTO de cada categoria — é o que um dono declara
 * de verdade ("este mês deve custar o que custou no mês passado"). NÃO é um número inventado
 * por mim, e nada é gravado: serve pra mostrar QUAIS custos fixos cresceram >20% de agosto
 * pra setembro, que é a informação que o aviso existe pra dar.
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { whereFluxoCaixa } from '../lib/fluxo-caixa/motor'
import { janelaDoMes } from '../lib/periodo/mes-corrente'
import { marcarComoFixa, definirPlanejado } from '../lib/custos-fixos/gestos'
import { produzirAvisosDeFinanceiro } from '../lib/avisos/produtores/financeiro'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const FIXAS = ['Aluguel', 'Salários', 'Energia Elétrica', 'Contabilidade', 'Água e Esgoto',
  'internet', 'Software de Gestão', 'FGTS', 'gas', 'Seguro Predial', 'MONITORAMENTO E SEGURANCA']

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const antes = await prisma.aviso.count({ where: { companyId: CO } })
  // ⚠️ relógio FIXO dentro de setembro, pra a janela do produtor alcançar ago+set
  const AGORA = new Date('2026-09-28T12:00:00Z')

  try {
    await prisma.$transaction(async (tx) => {
      const db = new Proxy(tx, {
        get(t, p) {
          if (p === '$transaction') return (fn: (c: unknown) => unknown) => fn(db)
          return (t as never as Record<string | symbol, unknown>)[p]
        },
      }) as never as typeof prisma

      const cats = await db.category.findMany({
        where: { companyId: CO, type: 'EXPENSE', isActive: true }, select: { id: true, name: true },
      })
      const ago = janelaDoMes('2026-08')
      console.log('\n══════ plano de SETEMBRO = realizado de AGOSTO (o que um dono declara) ══════')
      for (const n of FIXAS) {
        const c = cats.find((x) => x.name.toLowerCase() === n.toLowerCase())
        if (!c) continue
        const r = await db.transaction.aggregate({
          _sum: { amount: true },
          where: { ...whereFluxoCaixa(CO, { de: ago.de, ate: new Date(ago.ate.getTime() - 1) }), type: 'DEBIT', categoryId: c.id },
        })
        const plano = Math.round((r._sum.amount ?? 0) * 100) / 100
        if (plano <= 0) continue
        await marcarComoFixa(CO, c.id, u.id, db)
        await definirPlanejado(CO, c.id, '2026-09', plano, u.id, db)
        console.log(`   ${n.padEnd(26)} plano set = ago R$ ${plano.toFixed(2)}`)
      }

      const r = await produzirAvisosDeFinanceiro(CO, AGORA, db)
      console.log(`\n   produtor: gravados ${r.gravados} · reabertos ${r.reabertos} · resolvidos ${r.resolvidos} · recusados ${r.recusados.length}`)
      for (const x of r.recusados) console.log(`      ⛔ ${x.motivo} → "${x.titulo}"`)
      const avisos = await db.aviso.findMany({
        where: { companyId: CO, origem: 'CUSTO_FIXO_ACIMA_DO_PLANO' },
        select: { setor: true, severidade: true, titulo: true, corpo: true, oQueFazer: true, acaoRotulo: true, acaoHref: true },
      })
      console.log(`\n══════ O QUE O SININHO DIRIA (${avisos.length} aviso(s)) ══════`)
      for (const a of avisos) {
        console.log(`\n   [${a.setor} · ${a.severidade}] ${a.titulo}`)
        console.log(`      ${a.corpo}`)
        console.log(`      → ${a.oQueFazer}`)
        console.log(`      [${a.acaoRotulo} →]`)
      }
      // ⭐ e a idempotência no dado real: 3 rodadas, o mesmo nº de avisos
      await produzirAvisosDeFinanceiro(CO, AGORA, db)
      await produzirAvisosDeFinanceiro(CO, AGORA, db)
      const n2 = await db.aviso.count({ where: { companyId: CO, origem: 'CUSTO_FIXO_ACIMA_DO_PLANO' } })
      console.log(`\n   ⭐ 3 rodadas → ${n2} aviso(s) (anti-spam por origem+alvo)`)
      throw new Error('__ROLLBACK__')
    })
  } catch (e) { if (!(e instanceof Error) || e.message !== '__ROLLBACK__') throw e }

  const depois = await prisma.aviso.count({ where: { companyId: CO } })
  console.log(`\navisos ${antes} → ${depois} · ${antes === depois ? '⭐ ZERO ESCRITA' : '⛔ algo gravou'}`)
}
main().catch((e) => { console.error('⛔', e); process.exit(1) }).finally(() => prisma.$disconnect())
