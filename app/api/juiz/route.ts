// Sprint Fase 3 CAMADA 3 (15/08/2026) — API do juiz de módulo.
//   GET  → { latest, history } (pro selo do dashboard + a tela /admin/juiz)
//   POST → roda o juiz agora, persiste e devolve o relatório ("rodar agora")
// O cron chama o MESMO POST (dono único da execução).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { runModuleJudge } from '@/lib/loans/run-module-judge'

export async function GET(request: NextRequest) {
  try {
    await getAuthContext(request) // só exige login
    const history = await prisma.loanModuleJudgeReport.findMany({
      orderBy: { runAt: 'desc' },
      take: 30,
    })
    return NextResponse.json({ latest: history[0] ?? null, history })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthContext(request)
    const rep = await runModuleJudge(prisma)
    const saved = await prisma.loanModuleJudgeReport.create({
      data: {
        passed: rep.passed,
        totalContracts: rep.totalContracts,
        totalFail: rep.totalFail,
        balanceIssues: rep.balanceIssues,
        durationMs: rep.durationMs,
        detail: { byCompany: rep.byCompany, sharedTx: rep.sharedTx, balanceChecks: rep.balanceChecks },
      },
    })
    return NextResponse.json({ ok: true, report: saved })
  } catch (e) {
    return handleApiError(e)
  }
}
