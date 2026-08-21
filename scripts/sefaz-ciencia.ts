// ESTOQUE FASE 1 item 3 — envia CIÊNCIA (210210) às notas NOVAS que vieram SÓ RESUMO
// (temXmlCompleto=false) e rebaixa pra puxar o XML COMPLETO. O caminhão vem: sem itens,
// a conferência não tem o que conferir.
// USO: npx tsx scripts/sefaz-ciencia.ts <companyId> [chave1 chave2 ...]

import { PrismaClient } from '@prisma/client'
import { enviarEvento } from '../lib/stock/sefaz/ciencia'
import { TP_EVENTO } from '../lib/stock/sefaz/evento'
import { runSefazDownload } from '../lib/stock/sefaz/download'

const prisma = new PrismaClient()
const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const companyId = process.argv[2] || CACULA
const chavesArg = process.argv.slice(3)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const resumoOnly = await prisma.stockNfe.findMany({
    where: { companyId, status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: false, ...(chavesArg.length ? { chave: { in: chavesArg } } : {}) },
    select: { chave: true, emitNome: true, vNF: true },
  })
  if (resumoOnly.length === 0) { console.log('Nenhuma nota nova resumo-only pendente de Ciência.'); await prisma.$disconnect(); return }

  console.log(`=== CIÊNCIA (210210) em ${resumoOnly.length} nota(s) resumo-only ===`)
  for (const n of resumoOnly) {
    try {
      const r = await enviarEvento({ companyId, chave: n.chave, tpEvento: TP_EVENTO.CIENCIA })
      console.log(`  ${r.ok ? '✅' : '❌'} ${n.emitNome} (${n.vNF}): cStat ${r.cStat} · ${r.xMotivo}${r.nProt ? ` · prot ${r.nProt}` : ''}`)
    } catch (e) {
      console.log(`  ❌ ${n.emitNome}: ERRO ${(e as Error).message}`)
    }
  }

  console.log('\naguardando a SEFAZ processar + rebaixando pra puxar o XML completo...')
  await sleep(8000)
  const dl = await runSefazDownload({ companyId })
  console.log(`  download: cStat ${dl.cStat} · ${dl.paginas}pág · ${dl.totalDocs}docs`)

  const depois = await prisma.stockNfe.findMany({
    where: { companyId, chave: { in: resumoOnly.map((n) => n.chave) } },
    select: { chave: true, emitNome: true, temXmlCompleto: true },
  })
  console.log('\n=== resultado ===')
  for (const n of depois) {
    const nItens = await prisma.stockNfeItem.count({ where: { companyId, chave: n.chave } })
    console.log(`  ${n.emitNome}: XML completo=${n.temXmlCompleto ? 'SIM' : 'ainda não'} · ${nItens} itens`)
  }
  console.log('\n(se ainda não completou, o cron horário puxa na próxima rodada — a Ciência já foi deferida.)')
  await prisma.$disconnect()
}
main().catch((e) => { console.error('erro:', (e as Error).message); process.exit(1) })
