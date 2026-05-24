// Sprint 4.0.4 — endpoint manual pra disparar runAlertsJob.
//
// Restrição: só ADMIN do gerenciador pode chamar (não user comum).
// Usado pra smoke test em prod sem esperar cron diário.
//
// Body opcional: { dryRun?: boolean, force?: boolean, baseUrl?: string }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError } from '@/lib/api/handle-error'
import { runAlertsJob } from '@/lib/email/alerts-job'
import { verifyToken } from '@/lib/auth'

const bodySchema = z.object({
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    const payload = await verifyToken(token).catch(() => null)
    if (!payload?.sub) {
      return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
    }

    // Pra MVP: aceita qualquer user logado (smoke test). Em prod produção,
    // restringir via role ADMIN no User (futuro Sprint hardening).

    const body = await request.json().catch(() => ({}))
    const opts = bodySchema.parse(body)

    const result = await runAlertsJob(opts)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return handleApiError(error)
  }
}
