// ESTOQUE FASE 1 item 3 — envia CIÊNCIA (210210) às notas NOVAS que vieram SÓ RESUMO
// (temXmlCompleto=false) e rebaixa pra puxar o XML COMPLETO. O caminhão vem: sem itens,
// a conferência não tem o que conferir.
// USO: npx tsx scripts/sefaz-ciencia.ts <companyId> [chave1 chave2 ...]

import { PrismaClient } from '@prisma/client'
import { garantirCienciaPendentes } from '../lib/stock/sefaz/garantir-ciencia'
import { runSefazDownload } from '../lib/stock/sefaz/download'

const prisma = new PrismaClient()
const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const companyId = process.argv[2] || CACULA
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // REGRA 4: o script e o CRON usam a MESMA função. Antes o script tinha a lógica dele e
  // o cron não tinha nenhuma — foi assim que as 7 notas ficaram presas esperando alguém
  // lembrar de rodar isto na mão.
  const resumoOnly = await prisma.stockNfe.findMany({
    where: { companyId, status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: false },
    select: { chave: true, emitNome: true, vNF: true },
  })
  if (resumoOnly.length === 0) { console.log('Nenhuma nota nova resumo-only pendente de Ciência.'); await prisma.$disconnect(); return }

  console.log(`=== CIÊNCIA (210210) em ${resumoOnly.length} nota(s) resumo-only ===`)
  const c = await garantirCienciaPendentes({ companyId, db: prisma })
  console.log(`  ${c.enviadas} enviada(s) · ${c.jaManifestadas} já manifestada(s) · ${c.desistidas} desistida(s) · ${c.erros.length} erro(s)`)
  for (const e of c.erros) console.log(`  ❌ ${e.emitNome ?? e.chave}: ${e.cStat ?? ''} ${e.motivo}`)

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
