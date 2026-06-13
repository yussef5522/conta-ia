// Fase 5 — GET /api/monitor-alerts?empresaId=X
// Retorna alertas pendentes (dismissedAt IS NULL) da empresa do user.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { MONITOR_METRIC_LABELS, type MonitorMetricKey } from '@/lib/monitor/queries'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const empresaId = request.nextUrl.searchParams.get('empresaId')
  if (!empresaId) {
    return NextResponse.json({ erro: 'empresaId obrigatório' }, { status: 400 })
  }

  const access = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: empresaId },
    select: { userId: true },
  })
  if (!access) {
    return NextResponse.json({ erro: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
  }

  const alerts = await prisma.monitorAlert.findMany({
    where: {
      companyId: empresaId,
      dismissedAt: null,
    },
    orderBy: { detectedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      ...a,
      label: MONITOR_METRIC_LABELS[a.metricKey as MonitorMetricKey] ?? a.metricKey,
    })),
    count: alerts.length,
  })
}
