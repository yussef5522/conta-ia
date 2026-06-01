// Sprint Engine de Assinatura FATIA 1 (31/05/2026) — Cria Subscription
// TRIAL pro user no cadastro. Idempotente: chamar 2x retorna a mesma
// subscription (graças ao @@unique([userId])).

import type { Prisma, PrismaClient, Subscription } from '@prisma/client'

export const TRIAL_DURATION_DAYS = 14
export const DEFAULT_TRIAL_PLAN_ID = 'inteligencia' // mostra IA = âncora de valor

export interface CreateTrialOptions {
  userId: string
  /** Data de início do trial. Default: now. Útil pra testes deterministicos. */
  startAt?: Date
  /** Dias bônus do FREE_MONTHS (ex: cupom 2 meses = 60). */
  bonusDays?: number
  /** ID do cupom que originou o bônus (snapshot). */
  originCouponId?: string | null
}

/**
 * Cria Subscription TRIAL pra um user. Atomic + idempotente.
 * Se já existe subscription pro userId, retorna a existente SEM MODIFICAR.
 *
 * @param prisma instância Prisma ou TransactionClient
 */
export async function createTrialSubscription(
  prisma: PrismaClient | Prisma.TransactionClient,
  opts: CreateTrialOptions,
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({
    where: { userId: opts.userId },
  })
  if (existing) return existing

  const startAt = opts.startAt ?? new Date()
  const bonusDays = Math.max(0, opts.bonusDays ?? 0)
  const totalDays = TRIAL_DURATION_DAYS + bonusDays
  const trialEndsAt = new Date(startAt.getTime() + totalDays * 24 * 60 * 60 * 1000)

  return prisma.subscription.create({
    data: {
      userId: opts.userId,
      planId: DEFAULT_TRIAL_PLAN_ID,
      status: 'TRIAL',
      trialEndsAt,
      originCouponId: opts.originCouponId ?? null,
    },
  })
}

/**
 * Cria Subscription GRANTED (vitalícia, sem cobrança). Usado pela migration
 * de dados dos early adopters E pro admin conceder cortesias futuras.
 */
export async function createGrantedSubscription(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
  planId: string = DEFAULT_TRIAL_PLAN_ID,
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { userId } })
  if (existing) return existing

  return prisma.subscription.create({
    data: {
      userId,
      planId,
      status: 'GRANTED',
      trialEndsAt: null,
    },
  })
}
