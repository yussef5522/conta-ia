// Sprint Engine de Assinatura FATIA 1 (31/05/2026)
// GET /api/subscription/me — status efetivo do user logado.
// Usado pelo banner "X dias de trial" + tela /assinar.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getOrCreateSubscription } from '@/lib/subscription/queries'
import { getEffectiveSubscriptionStatus } from '@/lib/subscription/access'
import { PLANOS } from '@/lib/planos/config'

export async function GET(request: NextRequest) {
  const sessionUser = await getAuthUser(request)
  if (!sessionUser) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  // getOrCreateSubscription cria trial 14d se user não tem (defesa).
  const sub = await getOrCreateSubscription(sessionUser.sub)
  const effective = getEffectiveSubscriptionStatus({
    status: sub.status,
    planId: sub.planId,
    trialEndsAt: sub.trialEndsAt,
  })

  const plano = PLANOS.find((p) => p.id === sub.planId)

  return NextResponse.json({
    subscription: {
      rawStatus: effective.rawStatus,
      effectiveStatus: effective.effectiveStatus,
      planId: effective.planId,
      planoNome: plano?.nome ?? sub.planId,
      trialEndsAt: effective.trialEndsAt?.toISOString() ?? null,
      diasRestantesTrial: effective.diasRestantesTrial,
      isExpired: effective.isExpired,
      originCouponId: sub.originCouponId,
    },
  })
}
