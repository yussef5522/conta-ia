// ⛔⛔ RETROATIVO — as etapas que ficaram órfãs ANTES do fix de 06/09/2026.
//
// **O caso que motivou:** a etapa da Carlise, iniciada às 16:38, numa ordem concluída pela
// tela de Produção. Ficou aberta 7h05 **sem gesto nenhum que a resolvesse**.
//
// ⛔ **NÃO INVENTA TEMPO.** O script só grava o REGISTRO de que a ordem levou a etapa junto
// (`stock_etapa_encerrada`); `finalizadoEm` continua null, o tempo continua "a apurar" e a
// etapa segue fora das médias. Isso é o que ele NÃO faz, e é o mais importante dele.
//
// ⚠️ As telas já falam a verdade sem este script (o estado é derivado da ORDEM, não do
// registro). O que ele acrescenta é o **RASTRO**: quando o encerramento foi reconhecido e
// que foi retroativo — sem isso a auditoria não distingue "a ordem levou" de "ninguém sabe".
//
// USO:  npx tsx scripts/encerrar-etapas-orfas.ts <companyId>          (preview, não grava)
//       npx tsx scripts/encerrar-etapas-orfas.ts <companyId> --apply  (grava)

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const companyId = process.argv[2]
const APPLY = process.argv.includes('--apply')

async function main() {
  if (!companyId) throw new Error('uso: npx tsx scripts/encerrar-etapas-orfas.ts <companyId> [--apply]')
  // ⛔ REGRA 8b: prova em qual banco está antes de medir — zero silencioso é indistinguível
  // de "não tem", e já custou uma investigação inteira de perda de dado que não existia.
  await exigirEmpresaNesteBanco(prisma, companyId)

  const encerradas = await prisma.stockProductionOrder.findMany({
    where: { companyId, estado: { in: ['CONCLUIDA', 'CANCELADA'] } },
    select: { id: true, estado: true, atualizadoEm: true },
  })
  if (!encerradas.length) { console.log('nenhuma ordem encerrada nesta empresa.'); return }
  const estadoDaOrdem = new Map(encerradas.map((o) => [o.id, o]))

  const abertas = await prisma.stockOrdemEtapa.findMany({
    where: { companyId, ordemId: { in: encerradas.map((o) => o.id) }, iniciadoEm: { not: null }, finalizadoEm: null },
    orderBy: { iniciadoEm: 'asc' },
  })
  const jaRegistradas = new Set((await prisma.stockEtapaEncerrada.findMany({
    where: { companyId }, select: { etapaId: true },
  })).map((x) => x.etapaId))
  const alvo = abertas.filter((e) => !jaRegistradas.has(e.id))

  const colabs = await prisma.stockColaborador.findMany({ where: { companyId }, select: { id: true, nome: true } })
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))

  console.log(`\netapas órfãs (abertas em ordem já encerrada): ${alvo.length}`)
  if (jaRegistradas.size) console.log(`  (${jaRegistradas.size} já tinham registro — não se toca nelas)`)
  for (const e of alvo) {
    const o = estadoDaOrdem.get(e.ordemId)!
    const horas = ((Date.now() - e.iniciadoEm!.getTime()) / 3_600_000).toFixed(1)
    console.log(`  · “${e.nome}” · ${e.executorId ? nome.get(e.executorId) ?? '(sem nome)' : '(sem executor)'}`)
    console.log(`    iniciada ${e.iniciadoEm!.toISOString()} (aberta há ${horas}h) · ordem ${e.ordemId} está ${o.estado}`)
    console.log(`    → vira ENCERRADA_SEM_FINALIZAR, motivo ORDEM_${o.estado}, SEM finalizadoEm`)
  }
  if (!alvo.length) return

  if (!APPLY) { console.log('\n(preview — nada gravado. Rode com --apply pra gravar o rastro.)'); return }

  let n = 0
  for (const e of alvo) {
    const o = estadoDaOrdem.get(e.ordemId)!
    await prisma.stockEtapaEncerrada.create({
      data: {
        companyId, etapaId: e.id, ordemId: e.ordemId,
        motivo: o.estado === 'CANCELADA' ? 'ORDEM_CANCELADA' : 'ORDEM_CONCLUIDA',
        // ⚠️ a data do encerramento é a da ORDEM (quando ela de fato encerrou), não "agora" —
        // carimbar o instante do script diria que isso aconteceu hoje, e não aconteceu.
        encerradaEm: o.atualizadoEm,
        // ⚠️ e o AUTOR fica NULL de propósito: quem encerrou a ordem naquele dia não está
        // guardado em lugar nenhum, e inventar um nome seria pior que a ausência dele.
        encerradaPorId: null,
      },
    })
    n++
  }
  console.log(`\n✓ ${n} etapa(s) com o rastro gravado (nenhum finalizadoEm foi carimbado).`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
