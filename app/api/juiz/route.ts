// Sprint Fase 3 CAMADA 3 (15-17/08/2026) — API do juiz de módulo. FORA de
// /api/admin (painel admin do SaaS, auth separada + 404-obscurity): aqui é
// feature do dashboard normal, auth de usuário via getAuthContext.
//   GET  → { latest, history } (pro selo do dashboard + a tela /juiz)
//   POST → roda o juiz agora, persiste e devolve o relatório ("rodar agora")
// O cron chama o MESMO POST (dono único da execução).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { runModuleJudge } from '@/lib/loans/run-module-judge'

// RESILIENTE (17/08) + AGNÓSTICO AO SCHEMA (String OU Json): 1 relatório com
// detail ruim NÃO pode derrubar o GET (era o que fazia o selo cair no cinza
// "nunca rodou"). Aceita string (parse), objeto (coluna Json/legado), ou default
// — nunca estoura. `as unknown` porque o tipo varia (dev SQLite String, e há
// linha legado como objeto).
function parseDetail(d: unknown): unknown {
  if (d && typeof d === 'object') return d
  if (typeof d === 'string') {
    try { return JSON.parse(d) } catch { /* detail corrompido — cai no default */ }
  }
  return { byCompany: [], sharedTx: [], balanceChecks: [], dupStableKey: [], vendaChecks: [], cardChecks: [], cardResumo: [] }
}

export async function GET(request: NextRequest) {
  try {
    await getAuthContext(request)
    const rows = await prisma.loanModuleJudgeReport.findMany({ orderBy: { runAt: 'desc' }, take: 30 })
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
        dupIssues: rep.dupIssues,
        vendaIssues: rep.vendaIssues,
        cardIssues: rep.cardIssues,
        durationMs: rep.durationMs,
        detail: JSON.stringify({ byCompany: rep.byCompany, sharedTx: rep.sharedTx, balanceChecks: rep.balanceChecks, dupStableKey: rep.dupStableKey, vendaChecks: rep.vendaChecks, cardChecks: rep.cardChecks, cardResumo: rep.cardResumo }),
      },
    })
    return NextResponse.json({ ok: true, report: { ...saved, detail: parseDetail(saved.detail as unknown) } })
  } catch (e) {
    return handleApiError(e)
  }
}
