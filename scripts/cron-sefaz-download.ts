// ESTOQUE FASE 0 item 6 — CRON horário do download SEFAZ. Roda pra toda empresa com
// certificado ATIVO. Respeita o bloqueio "consumo indevido" (o próprio download pula
// se blockedUntil > agora). Uma empresa falhando não para as outras. Agendado no
// crontab: 0 * * * * npx tsx scripts/cron-sefaz-download.ts >> /var/log/conta-ia-sefaz.log
//
// Espelha scripts/cron-judge.ts (PrismaClient próprio, npx tsx).

import { PrismaClient } from '@prisma/client'
import { runSefazDownload } from '../lib/stock/sefaz/download'
import { garantirCienciaPendentes } from '../lib/stock/sefaz/garantir-ciencia'

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

      // CIÊNCIA das resumo-only (fix do bug da Focatto, 23/08). Sem isto a SEFAZ NUNCA
      // entrega o XML completo e a nota mora na fila — o download sozinho não resolve,
      // porque não há o que baixar até a manifestação. Idempotente: nota já manifestada
      // é pulada, então rodar de hora em hora não gera enxurrada de eventos.
      const c = await garantirCienciaPendentes({ companyId, db: prisma })
      if (c.candidatas > 0) {
        console.log(`[sefaz ${stamp}] ${companyId}: ciência — ${c.candidatas} resumo-only · ${c.enviadas} enviada(s) · ${c.jaManifestadas} já ok · ${c.desistidas} desistida(s) · ${c.erros.length} erro(s)`)
        for (const e of c.erros) console.error(`[sefaz ${stamp}]   ciência FALHOU ${e.emitNome ?? e.chave}: ${e.cStat ?? ''} ${e.motivo}`)
        // a Ciência é deferida: o XML completo vem na PRÓXIMA rodada do download.
      }
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
