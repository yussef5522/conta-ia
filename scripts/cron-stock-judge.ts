// ESTOQUE — CRON/manual do juiz do estoque. Roda E1/E2/E3/E12/E15, persiste em
// stock_judge_report, imprime o resultado. Rodar manual: npx tsx scripts/cron-stock-judge.ts

import { PrismaClient } from '@prisma/client'
import { runAndPersistStockJudge } from '../lib/stock/run-stock-judge'

const prisma = new PrismaClient()

async function main() {
  const rep = await runAndPersistStockJudge(prisma)
  const stamp = new Date().toISOString()
  console.log(`[juiz-estoque ${stamp}] ${rep.passed ? '🟢 OK' : '🔴 FALHA'} · ${rep.stockIssues} issue(s) · ${rep.durationMs}ms`)
  for (const f of rep.fails) console.log(`  ${f.invariante} · ${f.companyId ?? '—'} · ${f.detalhe}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error('[juiz-estoque] erro:', (e as Error).message); process.exit(1) })
