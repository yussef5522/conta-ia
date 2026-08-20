// ESTOQUE FASE 0 item 6 — CRON horário do download SEFAZ. Roda pra toda empresa com
// certificado ATIVO. Respeita o bloqueio "consumo indevido" (o próprio download pula
// se blockedUntil > agora). Uma empresa falhando não para as outras. Agendado no
// crontab: 0 * * * * npx tsx scripts/cron-sefaz-download.ts >> /var/log/conta-ia-sefaz.log
//
// Espelha scripts/cron-judge.ts (PrismaClient próprio, npx tsx).

import { PrismaClient } from '@prisma/client'
import { runSefazDownload } from '../lib/stock/sefaz/download'

const prisma = new PrismaClient()

async function main() {
  const certs = await prisma.stockCertificate.findMany({ where: { status: 'ATIVO' }, select: { companyId: true } })
  const companyIds = [...new Set(certs.map((c) => c.companyId))]
  const stamp = new Date().toISOString()
  console.log(`[sefaz ${stamp}] ${companyIds.length} empresa(s) com cert ativo`)

  for (const companyId of companyIds) {
    try {
      const r = await runSefazDownload({ companyId })
      console.log(`[sefaz ${stamp}] ${companyId}: cStat ${r.cStat} · ${r.paginas}pág · ${r.totalDocs}docs · novas ${r.novas} · hist ${r.historicas}${r.blocked ? ` · BLOQUEADO até ${r.bloqueadoAte}` : ''}`)
    } catch (e) {
      console.error(`[sefaz ${stamp}] ${companyId}: ERRO ${(e as Error).message}`)
    }
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[sefaz] erro fatal:', (e as Error).message)
  process.exit(1)
})
