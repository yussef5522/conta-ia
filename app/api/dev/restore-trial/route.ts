// Sprint post-3B (01/06/2026) — POST /api/dev/restore-trial
//
// 🚨 SÓ ATIVA EM ASAAS_ENV=sandbox. Em produção retorna 404.
//
// Restaura a Subscription do user logado pra TRIAL com 14 dias.
// Inverso de /api/dev/expire-trial.
//
// 🛡️ Mesmas proteções: multi-tenant + GRANTED blindado.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkDevGuard } from '@/lib/dev/guard'

export async function POST(request: NextRequest) {
  if (!checkDevGuard().allow) {
    return NextResponse.json({ erro: 'Not found' }, { status: 404 })
  }

  const session = await getAuthUser(request)
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.sub },
    select: { id: true, status: true },
  })
  if (!sub) {
    return NextResponse.json({ erro: 'Sem subscription' }, { status: 404 })
  }
  if (sub.status === 'GRANTED') {
    return NextResponse.json(
      {
        erro: 'Subscription GRANTED não precisa de trial.',
        code: 'GRANTED_PROTECTED',
      },
      { status: 403 },
    )
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'TRIAL',
      trialEndsAt,
      currentPeriodEnd: null,
    },
  })

  return NextResponse.json({
    ok: true,
    action: 'restored',
    trialEndsAt: trialEndsAt.toISOString(),
  })
}
