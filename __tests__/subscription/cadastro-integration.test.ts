// Sprint Engine de Assinatura FATIA 1 — cadastro cria subscription.

import { afterAll, describe, expect, test } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { POST as cadastroPost } from '@/app/api/auth/cadastro/route'
import { TRIAL_DURATION_DAYS } from '@/lib/subscription/create-trial'

const TEST_PREFIX = `cad-int-${Date.now()}-${process.pid}`
const createdUserIds: string[] = []

async function callCadastro(body: object): Promise<Response> {
  const req = new NextRequest('http://localhost/api/auth/cadastro', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  return cadastroPost(req)
}

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

describe('POST /api/auth/cadastro cria Subscription TRIAL', () => {
  test('user novo recebe TRIAL 14d no plano inteligencia', async () => {
    const email = `${TEST_PREFIX}-trial@t.dev`
    const res = await callCadastro({
      name: 'Trial New',
      email,
      password: 'SenhaForte123!',
      confirmPassword: 'SenhaForte123!',
    })
    expect(res.status).toBe(201)

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    })
    expect(user).not.toBeNull()
    createdUserIds.push(user!.id)

    expect(user!.subscription).not.toBeNull()
    expect(user!.subscription!.status).toBe('TRIAL')
    expect(user!.subscription!.planId).toBe('inteligencia')

    // trialEndsAt entre 13 e 15 dias do agora (margem pra runtime)
    const diffDays =
      (user!.subscription!.trialEndsAt!.getTime() - Date.now()) /
      (24 * 60 * 60 * 1000)
    expect(diffDays).toBeGreaterThan(TRIAL_DURATION_DAYS - 1)
    expect(diffDays).toBeLessThanOrEqual(TRIAL_DURATION_DAYS + 0.01)
  })

  test('cupom FREE_MONTHS estende o trial (14 + 60 = 74 dias)', async () => {
    // Cria cupom FREE_MONTHS=2 ativo. Code = [A-Z0-9]{4,20}
    const cupomCode = `FMTEST${Date.now().toString().slice(-8)}`.slice(0, 20)
    const cupom = await prisma.coupon.create({
      data: {
        code: cupomCode,
        description: 'Teste FREE_MONTHS',
        type: 'FREE_MONTHS',
        value: 0,
        freeMonths: 2,
        status: 'ACTIVE',
        createdById: 'test-system',
      },
    })

    const email = `${TEST_PREFIX}-bonus@t.dev`
    const res = await callCadastro({
      name: 'Bonus User',
      email,
      password: 'SenhaForte123!',
      confirmPassword: 'SenhaForte123!',
      couponCode: cupom.code,
    })
    expect(res.status).toBe(201)

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    })
    expect(user).not.toBeNull()
    createdUserIds.push(user!.id)

    const diffDays =
      (user!.subscription!.trialEndsAt!.getTime() - Date.now()) /
      (24 * 60 * 60 * 1000)

    // 14 + 60 = 74 dias (com margem pra runtime)
    expect(diffDays).toBeGreaterThan(73)
    expect(diffDays).toBeLessThanOrEqual(74.01)

    // originCouponId gravado
    expect(user!.subscription!.originCouponId).toBe(cupom.id)

    // Cleanup
    await prisma.couponRedemption
      .deleteMany({ where: { couponId: cupom.id } })
      .catch(() => {})
    await prisma.coupon.delete({ where: { id: cupom.id } }).catch(() => {})
  })

  test('cupom inválido NÃO bloqueia signup (trial 14d default)', async () => {
    const email = `${TEST_PREFIX}-invcup@t.dev`
    const res = await callCadastro({
      name: 'Invalid Coupon',
      email,
      password: 'SenhaForte123!',
      confirmPassword: 'SenhaForte123!',
      couponCode: 'CUPOMNAOEXISTE',
    })
    expect(res.status).toBe(201)

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    })
    createdUserIds.push(user!.id)
    expect(user!.subscription!.status).toBe('TRIAL')

    const diffDays =
      (user!.subscription!.trialEndsAt!.getTime() - Date.now()) /
      (24 * 60 * 60 * 1000)
    expect(diffDays).toBeGreaterThan(TRIAL_DURATION_DAYS - 1)
    expect(diffDays).toBeLessThanOrEqual(TRIAL_DURATION_DAYS + 0.01)
    expect(user!.subscription!.originCouponId).toBeNull()
  })

  test('PERCENTAGE cupom NÃO afeta trialEndsAt (vira ACTIVE bonus no preço Fatia 3)', async () => {
    const cupomCode = `PCT${Date.now().toString().slice(-8)}`.slice(0, 20)
    const cupom = await prisma.coupon.create({
      data: {
        code: cupomCode,
        description: 'Teste PERCENTAGE',
        type: 'PERCENTAGE',
        value: 50,
        freeMonths: null,
        status: 'ACTIVE',
        createdById: 'test-system',
      },
    })

    const email = `${TEST_PREFIX}-pct@t.dev`
    const res = await callCadastro({
      name: 'Pct User',
      email,
      password: 'SenhaForte123!',
      confirmPassword: 'SenhaForte123!',
      couponCode: cupom.code,
    })
    expect(res.status).toBe(201)

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    })
    createdUserIds.push(user!.id)

    const diffDays =
      (user!.subscription!.trialEndsAt!.getTime() - Date.now()) /
      (24 * 60 * 60 * 1000)
    // Sem extensão — só 14d
    expect(diffDays).toBeLessThanOrEqual(TRIAL_DURATION_DAYS + 0.01)

    // Cleanup
    await prisma.couponRedemption
      .deleteMany({ where: { couponId: cupom.id } })
      .catch(() => {})
    await prisma.coupon.delete({ where: { id: cupom.id } }).catch(() => {})
  })
})
