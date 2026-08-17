// Sprint Fase 3 CAMADA 3 (15-16/08/2026) — API do juiz de módulo. FORA de
// /api/admin (que é o painel admin do SaaS, auth separada + 404-obscurity):
// aqui é feature do dashboard normal, auth de usuário via getAuthContext.
//   GET  → { latest, history } (pro selo do dashboard + a tela /juiz)
//   POST → roda o juiz agora, persiste e devolve o relatório ("rodar agora")
// O cron chama o MESMO POST (dono único da execução). detail é String (JSON).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { runModuleJudge } from '@/lib/loans/run-module-judge'

export async function GET(request: NextRequest) {
  try {
    await getAuthContext(request)
    const rows = await prisma.loanModuleJudgeReport.findMany({ orderBy: { runAt: 'desc' }, take: 30 })
    // RESILIENTE (17/08): 1 relatório com detail ruim NÃO pode derrubar o GET
    // inteiro (era o que fazia o selo cair no cinza "nunca rodou"). Aceita string
    // (parse), objeto (coluna legado), ou default — nunca estoura.
    const parseDetail = (d: unknown) => {
      if (d && typeof d === 'object') return d
      if (typeof d === 'string') { try { return JSON.parse(d) } catch { /* detail corrompido */ } }
      return { byCompany: [], sharedTx: [], balanceChecks: [] }
    }
    const history = rows.map((r) => ({ ...r, detail: parseDetail(r.detail as unknown) }))
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
        detail: JSON.stringify({ byCompany: rep.byCompany, sharedTx: rep.sharedTx, balanceChecks: rep.balanceChecks }),
      },
    })
    return NextResponse.json({ ok: true, report: { ...saved, detail: JSON.parse(saved.detail) } })
  } catch (e) {
    return handleApiError(e)
  }
}
