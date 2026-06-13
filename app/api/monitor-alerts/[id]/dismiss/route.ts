// Fase 5 — POST /api/monitor-alerts/[id]/dismiss
// "Dispensar até nova mudança". Marca dismissedAt — banner não mostra
// de novo até a métrica MUDAR (cron diário gera novo alerta com valor diferente).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: alertId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const alert = await prisma.monitorAlert.findUnique({
    where: { id: alertId },
    select: { id: true, companyId: true, dismissedAt: true },
  })
  if (!alert) {
    return NextResponse.json({ erro: 'Alerta não encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }

  const access = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: alert.companyId },
    select: { userId: true },
  })
  if (!access) {
    return NextResponse.json({ erro: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
  }

  if (alert.dismissedAt) {
    return NextResponse.json({ ok: true, alreadyDismissed: true })
  }

  const updated = await prisma.monitorAlert.update({
    where: { id: alertId },
    data: {
      dismissedAt: new Date(),
      dismissedById: user.sub,
    },
  })

  return NextResponse.json({ ok: true, alert: updated })
}
