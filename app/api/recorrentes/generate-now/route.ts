// Sprint 4.0.1.b — endpoint manual pra disparar geração de tx recorrentes.
// Usado pra smoke test + casos onde o user quer gerar imediatamente sem
// esperar o cron diário.
//
// Aceita body opcional { empresaId, windowDays } pra escopo limitado.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { generateRecurringTransactions } from '@/lib/recurrence/generator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const empresaId = typeof body.empresaId === 'string' ? body.empresaId : null
    const windowDays =
      typeof body.windowDays === 'number' && body.windowDays > 0 && body.windowDays <= 60
        ? body.windowDays
        : undefined

    if (!empresaId) {
      return NextResponse.json({ erro: 'empresaId obrigatório' }, { status: 400 })
    }

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.create')

    const result = await generateRecurringTransactions({
      companyId: empresaId,
      windowDays,
    })

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return handleApiError(error)
  }
}
