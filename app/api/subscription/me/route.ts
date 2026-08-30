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

  // ⭐⭐ A ASSINATURA É DA EMPRESA (30/08/2026). Era `getOrCreateSubscription`, que CRIAVA
  // um trial pessoal "por defesa" — e foi assim que a operadora de estoque ganhou banner
  // de trial. Agora resolve pela empresa e **não cria nada**.
  const { assinaturaEfetiva, podeGerenciarPlano } = await import('@/lib/subscription/por-empresa')
  const sub = await assinaturaEfetiva(sessionUser.sub)

  // ⚠️ SEM assinatura = funcionário convidado. Devolve `null` e a tela **não mostra
  // banner nenhum** — nem "trial", nem "expirado", nem "assinar". Ele não é o cliente.
  if (!sub) return NextResponse.json({ subscription: null, podeGerenciar: false })

  const effective = getEffectiveSubscriptionStatus({
    status: sub.status,
    planId: sub.planId,
    trialEndsAt: sub.trialEndsAt,
  })
  const podeGerenciar = await podeGerenciarPlano(sessionUser.sub)

  const plano = PLANOS.find((p) => p.id === sub.planId)

  return NextResponse.json({
    podeGerenciar,
    subscription: {
      rawStatus: effective.rawStatus,
      effectiveStatus: effective.effectiveStatus,
      planId: effective.planId,
      planoNome: plano?.nome ?? sub.planId,
      trialEndsAt: effective.trialEndsAt?.toISOString() ?? null,
      diasRestantesTrial: effective.diasRestantesTrial,
      isExpired: effective.isExpired,
    },
  })
}
