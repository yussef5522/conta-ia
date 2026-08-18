// Sprint Fase 3 CAMADA 3 (16/08/2026) — CRON do juiz noturno. Roda os invariantes
// contra o banco INTEIRO, persiste o relatório, e manda e-mail SÓ na falha (com o
// detalhe + link pra /juiz). Agendado no crontab (madrugada). Espelha o padrão de
// scripts/monitor-dups-daily.ts (npx tsx, PrismaClient próprio).
//
// Destinatário: JUDGE_ALERT_EMAIL (env). Sem ele, loga que não mandou (não trava).

import { PrismaClient } from '@prisma/client'
import { runModuleJudge } from '../lib/loans/run-module-judge'
import { buildJudgeAlertEmail } from '../lib/loans/judge-alert-email'
import { sendEmail } from '../lib/email/send'

const prisma = new PrismaClient()
const BASE = process.env.APP_BASE_URL ?? 'https://app.caixaos.com.br'
const ALERT_TO = process.env.JUDGE_ALERT_EMAIL

async function main() {
  const rep = await runModuleJudge(prisma)
  await prisma.loanModuleJudgeReport.create({
    data: {
      passed: rep.passed,
      totalContracts: rep.totalContracts,
      totalFail: rep.totalFail,
      balanceIssues: rep.balanceIssues,
      dupIssues: rep.dupIssues,
      vendaIssues: rep.vendaIssues,
      durationMs: rep.durationMs,
      detail: JSON.stringify({ byCompany: rep.byCompany, sharedTx: rep.sharedTx, balanceChecks: rep.balanceChecks, dupStableKey: rep.dupStableKey, vendaChecks: rep.vendaChecks }),
    },
  })
  const stamp = new Date().toISOString()
  console.log(`[juiz ${stamp}] ${rep.passed ? '✓ OK' : '✗ FALHA'} · ${rep.totalContracts - rep.totalFail}/${rep.totalContracts} contratos · balance ${rep.balanceIssues} · dup ${rep.dupIssues} · venda ${rep.vendaIssues} · ${rep.durationMs}ms`)

  if (!rep.passed) {
    if (!ALERT_TO) {
      console.error(`[juiz ${stamp}] FALHA detectada mas JUDGE_ALERT_EMAIL não configurado — e-mail NÃO enviado`)
    } else {
      const { subject, html } = buildJudgeAlertEmail({
        runAt: new Date(),
        totalContracts: rep.totalContracts,
        totalFail: rep.totalFail,
        balanceIssues: rep.balanceIssues,
        dupIssues: rep.dupIssues,
        byCompany: rep.byCompany,
        sharedTx: rep.sharedTx,
        balanceChecks: rep.balanceChecks,
        dupStableKey: rep.dupStableKey,
        vendaChecks: rep.vendaChecks,
        juizUrl: `${BASE}/juiz`,
      })
      const r = await sendEmail({ to: ALERT_TO, subject, html, type: 'juiz-module-alert' })
      console.log(`[juiz ${stamp}] e-mail de falha → ${ALERT_TO}: ${r.success ? 'enviado (' + (r.id ?? '') + ')' : r.skipped ? 'PULADO (RESEND ausente)' : 'FALHOU (' + (r.error ?? '?') + ')'}`)
    }
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[juiz] erro fatal:', (e as Error).message)
  process.exit(1)
})
