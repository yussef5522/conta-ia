// Sprint Asaas 3B (31/05/2026) — GET /api/subscription/checkout/pix/status
//
// Polling chamado pela UI a cada 3s. Quando Asaas reportar RECEIVED/
// CONFIRMED, marca Subscription ACTIVE + currentPeriodEnd.
//
// ⚠️ Webhook (3C) é a fonte definitiva. Esse polling é UX rápida.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getPaymentStatus, isPaymentConfirmed } from '@/lib/asaas/pix'
import type { PlanoId } from '@/lib/planos/config'

const querySchema = z.object({
  paymentId: z.string().min(5),
})

export async function GET(request: NextRequest) {
  const sessionUser = await getAuthUser(request)
  if (!sessionUser) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    paymentId: url.searchParams.get('paymentId') ?? '',
  })
  if (!parsed.success) {
    return NextResponse.json({ erro: 'paymentId obrigatório' }, { status: 400 })
  }

  const payment = await getPaymentStatus(parsed.data.paymentId)

  // 🛡️ Confirma que o paymentId pertence ao user (multi-tenant defesa)
  // O externalReference que salvamos tem `user:USERID|plan:...|ciclo:...|dias:DIAS`
  const expectedPrefix = `user:${sessionUser.sub}|`
  if (
    payment.externalReference &&
    !payment.externalReference.startsWith(expectedPrefix)
  ) {
    return NextResponse.json(
      { erro: 'paymentId não pertence ao usuário' },
      { status: 403 },
    )
  }

  // Confirmado: ativa subscription
  if (isPaymentConfirmed(payment.status)) {
    // Decode externalReference pra pegar plan/ciclo/dias
    const ref = payment.externalReference ?? ''
    const matchPlan = ref.match(/plan:([^|]+)/)
    const matchCiclo = ref.match(/ciclo:([^|]+)/)
    const matchDias = ref.match(/dias:(\d+)/)
    const planId = (matchPlan?.[1] ?? 'inteligencia') as PlanoId
    const dias = matchDias ? parseInt(matchDias[1], 10) : 30
    const currentPeriodEnd = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)

    await prisma.subscription.updateMany({
      where: { userId: sessionUser.sub, status: { not: 'GRANTED' } },
      data: {
        status: 'ACTIVE',
        planId,
        trialEndsAt: null,
        currentPeriodEnd,
        // ciclo registrado via reference no Asaas (3C webhook usará)
      },
    })

    return NextResponse.json({
      status: 'CONFIRMED',
      asaasStatus: payment.status,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    })
  }

  return NextResponse.json({
    status: 'PENDING',
    asaasStatus: payment.status,
  })
}
