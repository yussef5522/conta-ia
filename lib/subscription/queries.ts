// Sprint Engine de Assinatura FATIA 1 (31/05/2026) — Queries Prisma.

import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient, Subscription } from '@prisma/client'
import { getEffectiveSubscriptionStatus } from './access'
import type { EffectiveSubscriptionStatus } from './types'

/**
 * Pega a subscription do user OU cria automaticamente (lazy).
 * Cobertura defensiva: se um user perdeu a subscription (race, migration
 * falhada), cria trial 14d na hora ao invés de quebrar a sessão.
 */
export async function getOrCreateSubscription(
  userId: string,
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { userId } })
  if (existing) return existing

  // Import circular evitado: createTrialSubscription importado tardio
  const { createTrialSubscription } = await import('./create-trial')
  return createTrialSubscription(prisma, { userId })
}

/** Pega só status efetivo (com derivação TRIAL → EXPIRED se passou). */
export async function getEffectiveStatusByUserId(
  userId: string,
): Promise<EffectiveSubscriptionStatus | null> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, planId: true, trialEndsAt: true },
  })
  if (!sub) return null
  return getEffectiveSubscriptionStatus({
    status: sub.status,
    planId: sub.planId,
    trialEndsAt: sub.trialEndsAt,
  })
}

/** Marca subscription como EXPIRED no DB (chamado quando proxy/login detecta). */
export async function markExpired(
  client: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await client.subscription.updateMany({
    where: { userId, status: 'TRIAL' },
    data: { status: 'EXPIRED' },
  })
}
