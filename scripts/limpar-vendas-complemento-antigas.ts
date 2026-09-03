// APAGA os imports de complemento do passado, PRESERVANDO a lista de trabalho (02/09/2026).
//
// ⭐ DECISÃO DO DONO: *"o passado não interessa — vendas velhas não vão baixar nada. Foco é
// daqui pra frente"*. Mas: *"MANTÉM os 215 nomes na prateleira — os nomes são minha lista
// de trabalho"*.
//
// ⛔⛔ POR QUE O CATÁLOGO VEM ANTES DO DELETE, e não depois: medido em prod, apagar as
// linhas HOJE deixaria a aba com **1 nome de 215** (só o que estava mapeado). A ordem aqui
// não é estilo — é a diferença entre preservar e perder.
//
// ⚠️ RECUSA APAGAR o que gerou movimento de estoque. Nenhum destes gerou (a baixa de
// complemento nunca foi ligada), e é isso que o script CONFERE em vez de supor.
//
// USO:  npx tsx scripts/limpar-vendas-complemento-antigas.ts [--apagar]
//       sem --apagar: só o preview.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { prateleiraGravada } from '@/lib/stock/vendas/import-complementos'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix
const APAGAR = process.argv.includes('--apagar')

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const linhas = await prisma.stockVendaComplementoLinha.findMany({
    where: { companyId: COMPANY },
    select: { importId: true, nomeSuitable: true, ocorrencias: true, data: true },
  })
  if (!linhas.length) { console.log('nenhuma linha de complemento — nada a fazer.'); return }

  const ids = [...new Set(linhas.map((l) => l.importId))]
  console.log('\n=== O QUE VAI SER APAGADO ===')
  for (const id of ids) {
    const ls = linhas.filter((l) => l.importId === id)
    const mv = await prisma.stockMovement.count({ where: { companyId: COMPANY, receiptId: id } })
    console.log(`  ${id}`)
    console.log(`     ${ls.length} linhas · ${ls.reduce((s, l) => s + l.ocorrencias, 0)} ocorrências · movimentos gerados: ${mv}`)
    // ⛔ trava dura: linha que virou movimento no ledger não se apaga por script
    if (mv > 0) throw new Error(`ABORTADO: ${id} gerou ${mv} movimento(s) de estoque. Apagar a linha deixaria o ledger sem origem.`)
  }

  const nomes = [...new Set(linhas.map((l) => l.nomeSuitable))]
  const jaNoCatalogo = new Set((await prisma.stockVendaComplementoNome.findMany({
    where: { companyId: COMPANY }, select: { nomeSuitable: true },
  })).map((c) => c.nomeSuitable))
  const aSemear = nomes.filter((n) => !jaNoCatalogo.has(n))

  const antes = await prateleiraGravada(COMPANY, prisma)
  console.log('\n=== O QUE VAI SER PRESERVADO ===')
  console.log(`  prateleira hoje: ${antes.prateleira.length} nomes`)
  console.log(`  catálogo hoje: ${jaNoCatalogo.size} nome(s) → vai receber mais ${aSemear.length}`)
  console.log(`  mapeamentos (intocados): ${await prisma.stockVendaComplementoMap.count({ where: { companyId: COMPANY } })}`)
  console.log(`  fichas (intocadas): nenhuma é tocada por este script`)
  console.log(`\n  depois: ${nomes.length} nomes na prateleira, todos com 0 ocorrências ("— não vendeu")`)
  console.log(`          as ocorrências voltam sozinhas quando os imports diários começarem.`)

  if (!APAGAR) { console.log('\n(sem --apagar: NADA foi tocado)'); return }

  const r = await prisma.$transaction(async (tx) => {
    // ⚠️ SEMEIA ANTES DE APAGAR, na mesma transação: se o delete rodasse primeiro e a
    // gravação do catálogo falhasse, a lista de trabalho iria embora sem volta.
    const primeiro = new Map<string, Date>()
    const ultimo = new Map<string, Date>()
    for (const l of linhas) {
      if (!primeiro.has(l.nomeSuitable) || l.data < primeiro.get(l.nomeSuitable)!) primeiro.set(l.nomeSuitable, l.data)
      if (!ultimo.has(l.nomeSuitable) || l.data > ultimo.get(l.nomeSuitable)!) ultimo.set(l.nomeSuitable, l.data)
    }
    if (aSemear.length) {
      await tx.stockVendaComplementoNome.createMany({
        data: aSemear.map((nomeSuitable) => ({
          companyId: COMPANY, nomeSuitable,
          primeiroEm: primeiro.get(nomeSuitable)!, ultimoEm: ultimo.get(nomeSuitable)!,
        })),
      })
    }
    const del = await tx.stockVendaComplementoLinha.deleteMany({ where: { companyId: COMPANY } })
    return { semeados: aSemear.length, apagadas: del.count }
  })

  const depois = await prateleiraGravada(COMPANY, prisma)
  console.log('\n=== FEITO ===')
  console.log(`  catálogo semeado: ${r.semeados} · linhas apagadas: ${r.apagadas}`)
  console.log(`  prateleira agora: ${depois.prateleira.length} nomes · período: ${depois.periodo ? `${depois.periodo.de}..${depois.periodo.ate}` : 'null (sem venda importada)'}`)
  if (depois.prateleira.length < antes.prateleira.length) {
    throw new Error(`⛔ A PRATELEIRA ENCOLHEU (${antes.prateleira.length} → ${depois.prateleira.length}). Restaure o dump.`)
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
