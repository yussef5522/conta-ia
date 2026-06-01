// Sprint post-3B (01/06/2026) — POST /api/dev/expire-trial
//
// 🚨 SÓ ATIVA EM ASAAS_ENV=sandbox. Em produção retorna 404 (não 403 —
// não revela que existe).
//
// Marca a Subscription do USER LOGADO como TRIAL com trialEndsAt no
// passado. No próximo verifyToken/login, middleware vai bloquear e
// mostrar /assinar.
//
// 🛡️ Multi-tenant: SEMPRE altera só o próprio session.sub. Smuggle de
// userId no body é ignorado.
// 🛡️ Bloqueia GRANTED — não pode expirar admin@contaia mesmo em
// sandbox por engano.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkDevGuard } from '@/lib/dev/guard'

export async function POST(request: NextRequest) {
  // 🚨 Guard #1: ambiente
  if (!checkDevGuard().allow) {
    return NextResponse.json({ erro: 'Not found' }, { status: 404 })
  }

  // 🚨 Guard #2: auth
  const session = await getAuthUser(request)
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  // 🚨 Guard #3: existe Subscription + não é GRANTED
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
        erro: 'Subscription GRANTED não pode ser expirada (proteção).',
        code: 'GRANTED_PROTECTED',
      },
      { status: 403 },
    )
  }

  // Expira agora: TRIAL + trialEndsAt = ontem
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'TRIAL',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      currentPeriodEnd: null,
    },
  })

  return NextResponse.json({
    ok: true,
    action: 'expired',
    nextAction: 'Refresh ou re-login pra cair em /assinar',
  })
}
