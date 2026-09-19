// Sprint Fase 3 CAMADA 3 (16/08/2026) — CRON do juiz noturno. Roda os invariantes
// contra o banco INTEIRO, persiste o relatório, e manda e-mail SÓ na falha (com o
// detalhe + link pra /juiz). Agendado no crontab (madrugada). Espelha o padrão de
// scripts/monitor-dups-daily.ts (npx tsx, PrismaClient próprio).
//
// Destinatário: JUDGE_ALERT_EMAIL (env). Sem ele, loga que não mandou (não trava).

import { PrismaClient } from '@prisma/client'
import { expurgarTextosAntigos } from '@/lib/credit-card/quarentena-fatura'
import { expurgarTextosDeVendaAntigos } from '@/lib/stock/vendas/quarentena-venda'
import { runModuleJudge } from '../lib/loans/run-module-judge'
import { runAndPersistStockJudge } from '../lib/stock/run-stock-judge'
import { buildJudgeAlertEmail } from '../lib/loans/judge-alert-email'
import { sendEmail } from '../lib/email/send'
import { checkInfra } from '../lib/infra/health'
import { checkDeploy, migrationsPendentes, avaliarDeploy } from '../lib/infra/deploy-health'

const prisma = new PrismaClient()
const BASE = process.env.APP_BASE_URL ?? 'https://app.caixaos.com.br'
const ALERT_TO = process.env.JUDGE_ALERT_EMAIL

async function main() {
  const rep = await runModuleJudge(prisma)
  const stockRep = await runAndPersistStockJudge(prisma) // tabela isolada stock_judge_report
  await prisma.loanModuleJudgeReport.create({
    data: {
      passed: rep.passed,
      totalContracts: rep.totalContracts,
      totalFail: rep.totalFail,
      balanceIssues: rep.balanceIssues,
      dupIssues: rep.dupIssues,
      vendaIssues: rep.vendaIssues,
      cardIssues: rep.cardIssues,
      durationMs: rep.durationMs,
      detail: JSON.stringify({ byCompany: rep.byCompany, sharedTx: rep.sharedTx, balanceChecks: rep.balanceChecks, dupStableKey: rep.dupStableKey, vendaChecks: rep.vendaChecks, cardChecks: rep.cardChecks, cardResumo: rep.cardResumo }),
    },
  })
  // INFRA — a máquina embaixo do sistema. Roda às 3h, quando NÃO há build: swap em uso
  // neste horário é operação normal não cabendo na RAM, não o build respirando.
  const { leitura, checks: infraChecks } = checkInfra()
  const stamp = new Date().toISOString()
  if (leitura) {
    console.log(`[juiz ${stamp}] infra: RAM ${leitura.memDisponivelMb}/${leitura.memTotalMb} MB livres · swap ${leitura.swapUsadoMb}/${leitura.swapTotalMb} MB em uso${infraChecks.length ? ` · ${infraChecks.length} alerta(s)` : ''}`)
  }
  // DEPLOY — o artefato servido está são? (symlink íntegro, BUILD_ID, CSS, rollback
  // disponível). Pega o que o smoke não pega: `.next` que voltou a ser diretório real
  // responde 200 e mesmo assim jogou fora a troca atômica e o rollback em segundos.
  const { leitura: dep0 } = checkDeploy()
  // ⭐ D5 precisa do BANCO (a leitura de arquivo não sabe o que foi aplicado)
  const dep = dep0 ? { ...dep0, migrationsPendentes: await migrationsPendentes(prisma) } : null
  const deployChecks = dep ? avaliarDeploy(dep) : []
  if (dep) {
    console.log(`[juiz ${stamp}] deploy: ${dep.ehSymlink ? `symlink → ${dep.alvo}` : '⚠️ .next é diretório real'} · BUILD_ID ${dep.buildIdOk ? 'ok' : 'AUSENTE'} · ${dep.cssCount} css · ${dep.buildsGuardados} build(s) guardado(s)${deployChecks.length ? ` · ${deployChecks.length} alerta(s)` : ''}`)
    for (const c of deployChecks) console.log(`[juiz ${stamp}]   ${c.invariante} (${c.nivel}): ${c.detalhe}`)
  }

  console.log(`[juiz ${stamp}] ${rep.passed ? '✓ OK' : '✗ FALHA'} · ${rep.totalContracts - rep.totalFail}/${rep.totalContracts} contratos · balance ${rep.balanceIssues} · dup ${rep.dupIssues} · venda ${rep.vendaIssues} · cartão ${rep.cardIssues} · estoque ${stockRep.stockIssues} · ${rep.durationMs}ms`)

  if (!rep.passed || !stockRep.passed || infraChecks.length > 0 || deployChecks.length > 0) {
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
        cardChecks: rep.cardChecks,
        stockChecks: stockRep.fails,
        infraChecks: [...infraChecks, ...deployChecks],
        juizUrl: `${BASE}/juiz`,
      })
      const r = await sendEmail({ to: ALERT_TO, subject, html, type: 'juiz-module-alert' })
      console.log(`[juiz ${stamp}] e-mail de falha → ${ALERT_TO}: ${r.success ? 'enviado (' + (r.id ?? '') + ')' : r.skipped ? 'PULADO (RESEND ausente)' : 'FALHOU (' + (r.error ?? '?') + ')'}`)
    }
  }
  /**
   * ⭐ O EXPURGO DA QUARENTENA (16/09) — e isto é a correção de uma promessa MINHA.
   *
   * ⛔ Quando a quarentena nasceu eu escrevi que o texto era expurgado em 12 meses (LGPD,
   * a mesma régua do `rawOfxBlob`) — e a função ficou com **zero chamadores**, ou seja a
   * promessa nunca ia acontecer. É a lição do E10 deste doc: *invariante planejado e não
   * construído é pior que nenhum*, porque cria confiança falsa.
   *
   * ⚠️ Fail-soft: higiene de retenção não pode derrubar a rodada do juiz. E o texto é a
   * ÚNICA coisa que sai — a metadata fica, pra auditoria sem PII.
   */
  try {
    const purgados = await expurgarTextosAntigos(new Date())
    if (purgados > 0) console.log(`[juiz ${stamp}] quarentena de faturas: ${purgados} texto(s) expurgado(s) (12 meses, LGPD)`)
  } catch (e) {
    console.error(`[juiz ${stamp}] expurgo da quarentena falhou (não derruba a rodada):`, (e as Error).message)
  }

  /**
   * ⭐ E o mesmo pra quarentena de VENDAS (19/09) — ela nasce COM chamador.
   *
   * ⚠️ A lição do E10: expurgo prometido no comentário e sem quem o chame é pior que
   * expurgo nenhum, porque cria a confiança de que a retenção está cuidada.
   */
  try {
    const purgados = await expurgarTextosDeVendaAntigos()
    if (purgados > 0) console.log(`[juiz ${stamp}] quarentena de vendas: ${purgados} texto(s) expurgado(s) (12 meses)`)
  } catch (e) {
    console.error(`[juiz ${stamp}] expurgo da quarentena de vendas falhou (não derruba a rodada):`, (e as Error).message)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[juiz] erro fatal:', (e as Error).message)
  process.exit(1)
})
