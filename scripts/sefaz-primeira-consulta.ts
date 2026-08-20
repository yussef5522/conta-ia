// ESTOQUE FASE 0 item 2 — PRIMEIRA CONSULTA REAL à SEFAZ (produção), NSU=0, só
// resumos, SEM Ciência. Define a DATA DE CORTE (default hoje), roda o download e
// imprime o relatório (REGRA 2: o dono olha antes de qualquer Ciência).
//
// USO:  npx tsx scripts/sefaz-primeira-consulta.ts <companyId> [YYYY-MM-DD]
//   companyId default = Cacula. dataCorte default = hoje (00:00).

import { PrismaClient } from '@prisma/client'
import { runSefazDownload } from '../lib/stock/sefaz/download'
import { buildSefazReport } from '../lib/stock/sefaz/report'

const prisma = new PrismaClient()
const CACULA = 'cmq17yapb00gnrndlh33sctbo'

const companyId = process.argv[2] || CACULA
const corteArg = process.argv[3]
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  // DATA DE CORTE = hoje 00:00 (ou o arg). Nota emitida antes = HISTORICA.
  const hoje = new Date()
  const corte = corteArg ? new Date(`${corteArg}T00:00:00`) : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())

  const state = await prisma.stockSefazState.upsert({
    where: { companyId },
    create: { companyId, dataCorte: corte },
    update: { dataCorte: corte }, // só ajusta o corte se rodar de novo; NSU preservado
  })
  console.log(`\n=== PRIMEIRA CONSULTA SEFAZ (produção) ===`)
  console.log(`empresa: ${companyId}`)
  console.log(`DATA DE CORTE: ${corte.toISOString().slice(0, 10)} (nota emitida antes = HISTÓRICA)`)
  console.log(`ultNSU atual: ${state.ultNSU}  ${state.blockedUntil ? `⚠️ bloqueado até ${state.blockedUntil.toISOString()}` : ''}`)
  console.log(`consultando a SEFAZ...\n`)

  const r = await runSefazDownload({ companyId })
  console.log(`--- resposta SEFAZ ---`)
  console.log(`cStat ${r.cStat} · ${r.xMotivo}`)
  console.log(`páginas: ${r.paginas} · docs: ${r.totalDocs} · ultNSU→${r.ultNSU} · maxNSU ${r.maxNSU}`)
  if (r.blocked) console.log(`⚠️ BLOQUEADO (consumo indevido) até ${r.bloqueadoAte} — normal se já consultou hoje; espera 1h.`)

  const rep = await buildSefazReport(companyId, prisma)
  console.log(`\n===== O QUE A SEFAZ DEVOLVEU (REGRA 2) =====`)
  console.log(`Total de notas: ${rep.total}`)
  console.log(`  HISTÓRICAS (antes do corte, sem ação): ${rep.historicas}`)
  console.log(`  NOVAS (>= corte, viram fila de recebimento): ${rep.novas}`)
  console.log(`Fornecedores distintos (nas novas): ${rep.fornecedoresDistintos}`)
  console.log(`Valor total das novas: ${brl(rep.valorTotalNovas)}`)
  console.log(`Período das notas: ${rep.periodo.de ?? '—'} → ${rep.periodo.ate ?? '—'}`)
  console.log(`Novas com XML completo: ${rep.novasComXml} · só resumo (Ciência pendente): ${rep.novasSoResumo}`)
  console.log(`Anomalias: canceladas ${rep.canceladas} · auto-emitidas (própria empresa/transferência) ${rep.autoEmitidas}`)
  if (rep.topFornecedores.length) {
    console.log(`\nTop fornecedores (novas, por valor):`)
    for (const f of rep.topFornecedores) console.log(`  ${f.cnpj.padEnd(16)} ${brl(f.valor).padStart(13)}  ${f.nNotas}nf  ${f.nome.slice(0, 40)}`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[sefaz-primeira-consulta] erro:', (e as Error).message)
  process.exit(1)
})
