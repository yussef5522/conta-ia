// Sprint Engine de Assinatura FATIA 1 — createTrialSubscription integração.

import { afterAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  createGrantedSubscription,
  createTrialSubscription,
  DEFAULT_TRIAL_PLAN_ID,
  TRIAL_DURATION_DAYS,
} from '@/lib/subscription/create-trial'

const TEST_PREFIX = `sub-create-${Date.now()}-${process.pid}`
const createdUserIds: string[] = []

async function makeUser(suffix: string) {
  const u = await prisma.user.create({
    data: {
      name: `T ${suffix}`,
      email: `${TEST_PREFIX}-${suffix}@t.dev`,
      password: await bcrypt.hash('Senha123!', 10),
    },
  })
  createdUserIds.push(u.id)
  return u
}

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

describe('createTrialSubscription', () => {
  test('cria TRIAL com planId=inteligencia, status=TRIAL, trialEndsAt=+14d', async () => {
    const u = await makeUser('basic')
    const startAt = new Date('2026-05-31T12:00:00Z')
    const sub = await createTrialSubscription(prisma, {
      userId: u.id,
      startAt,
    })

    expect(sub.planId).toBe(DEFAULT_TRIAL_PLAN_ID)
    expect(sub.status).toBe('TRIAL')
    const expectedEnd = new Date(
      startAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
    )
    expect(sub.trialEndsAt?.getTime()).toBe(expectedEnd.getTime())
    expect(sub.originCouponId).toBeNull()
  })

  test('estende trial com bonusDays (FREE_MONTHS=2 → +60 dias)', async () => {
    const u = await makeUser('bonus')
    const startAt = new Date('2026-05-31T12:00:00Z')
    const sub = await createTrialSubscription(prisma, {
      userId: u.id,
      startAt,
      bonusDays: 60,
      originCouponId: 'fake-coupon-id',
    })

    const expectedDays = TRIAL_DURATION_DAYS + 60 // 74
    const expectedEnd = new Date(
      startAt.getTime() + expectedDays * 24 * 60 * 60 * 1000,
    )
    expect(sub.trialEndsAt?.getTime()).toBe(expectedEnd.getTime())
    expect(sub.originCouponId).toBe('fake-coupon-id')
  })

  test('idempotente: 2ª chamada retorna a MESMA subscription, NÃO modifica', async () => {
    const u = await makeUser('idem')
    const first = await createTrialSubscription(prisma, {
      userId: u.id,
      startAt: new Date('2026-05-31T12:00:00Z'),
    })
    const second = await createTrialSubscription(prisma, {
      userId: u.id,
      startAt: new Date('2026-12-31T12:00:00Z'), // tenta mudar
      bonusDays: 365,
    })
    expect(second.id).toBe(first.id)
    // trialEndsAt da segunda chamada é IGUAL ao da primeira (não foi modificado)
    expect(second.trialEndsAt?.getTime()).toBe(first.trialEndsAt?.getTime())
  })

  test('bonusDays negativo é clamped pra 0', async () => {
    const u = await makeUser('neg')
    const startAt = new Date('2026-05-31T12:00:00Z')
    const sub = await createTrialSubscription(prisma, {
      userId: u.id,
      startAt,
      bonusDays: -100,
    })
    const expectedEnd = new Date(
      startAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
    )
    expect(sub.trialEndsAt?.getTime()).toBe(expectedEnd.getTime())
  })
})

describe('createGrantedSubscription', () => {
  test('cria GRANTED, trialEndsAt null, planId=inteligencia default', async () => {
    const u = await makeUser('granted')
    const sub = await createGrantedSubscription(prisma, u.id)

    expect(sub.status).toBe('GRANTED')
    expect(sub.planId).toBe('inteligencia')
    expect(sub.trialEndsAt).toBeNull()
  })

  test('idempotente também: respeitsa @@unique userId', async () => {
    const u = await makeUser('granted-idem')
    const first = await createGrantedSubscription(prisma, u.id)
    const second = await createGrantedSubscription(prisma, u.id, 'performance')
    expect(second.id).toBe(first.id)
    expect(second.planId).toBe('inteligencia') // NÃO mudou
  })
})
