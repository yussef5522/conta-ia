// Sprint Asaas 3C — Endpoint POST /api/webhooks/asaas (integração).
// Usa Prisma real (SQLite dev) seguindo padrão dos endpoint tests do projeto.

import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

const TEST_TOKEN = 'webhook-test-token-3c-' + Date.now()

beforeEach(() => {
  process.env.ASAAS_WEBHOOK_TOKEN = TEST_TOKEN
})

const { POST } = await import('@/app/api/webhooks/asaas/route')

const TEST_PREFIX = `wh3c-${Date.now()}-${process.pid}`
const createdUserIds: string[] = []
const createdEventIds: string[] = []

async function makeUser(suffix: string, opts: {
  subStatus?: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'PAST_DUE' | 'CANCELED'
  currentPeriodEnd?: Date | null
  gatewaySubscriptionId?: string | null
  gatewayCustomerId?: string | null
} = {}) {
  const u = await prisma.user.create({
    data: {
      name: `T ${suffix}`,
      email: `${TEST_PREFIX}-${suffix}@dev.local`,
      password: await bcrypt.hash('Senha123!', 10),
    },
  })
  createdUserIds.push(u.id)
  await prisma.subscription.create({
    data: {
      userId: u.id,
      planId: 'inteligencia',
      status: opts.subStatus ?? 'TRIAL',
      currentPeriodEnd: opts.currentPeriodEnd ?? null,
      gatewaySubscriptionId: opts.gatewaySubscriptionId ?? null,
      gatewayCustomerId: opts.gatewayCustomerId ?? null,
    },
  })
  return u
}

afterAll(async () => {
  // Cleanup
  if (createdEventIds.length > 0) {
    await prisma.webhookEvent
      .deleteMany({ where: { asaasEventId: { in: createdEventIds } } })
      .catch(() => {})
  }
  if (createdUserIds.length > 0) {
    await prisma.webhookEvent
      .deleteMany({ where: { subscriptionId: { in: await getSubIds() } } })
      .catch(() => {})
    await prisma.subscription
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => {})
  }
})

async function getSubIds(): Promise<string[]> {
  const subs = await prisma.subscription.findMany({
    where: { userId: { in: createdUserIds } },
    select: { id: true },
  })
  return subs.map((s) => s.id)
}

function makeReq(body: unknown, opts: { token?: string | null } = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (opts.token !== null) {
    headers['asaas-access-token'] = opts.token ?? TEST_TOKEN
  }
  return new NextRequest('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

function genEventId(suffix: string): string {
  const id = `evt_${TEST_PREFIX}_${suffix}_${Math.random().toString(36).slice(2)}`
  createdEventIds.push(id)
  return id
}

// ============================================================
// 1. Autenticação
// ============================================================
describe('autenticação asaas-access-token', () => {
  test('sem header → 401', async () => {
    const res = await POST(makeReq({ id: genEventId('a1'), event: 'PAYMENT_CREATED' }, { token: null }))
    expect(res.status).toBe(401)
  })

  test('token errado → 401', async () => {
    const res = await POST(makeReq({ id: genEventId('a2'), event: 'PAYMENT_CREATED' }, { token: 'wrong' }))
    expect(res.status).toBe(401)
  })

  test('tamanho diferente do esperado → 401 (timingSafeEqual guard)', async () => {
    const res = await POST(makeReq({ id: genEventId('a3'), event: 'PAYMENT_CREATED' }, { token: 'a'.repeat(TEST_TOKEN.length + 5) }))
    expect(res.status).toBe(401)
  })

  test('token correto + body válido → 200', async () => {
    const eventId = genEventId('a4')
    const res = await POST(makeReq({ id: eventId, event: 'PAYMENT_CREATED' }))
    expect(res.status).toBe(200)
  })

  test('ASAAS_WEBHOOK_TOKEN ausente → 401 (fail closed)', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN
    const res = await POST(makeReq({ id: genEventId('a5'), event: 'PAYMENT_CREATED' }))
    expect(res.status).toBe(401)
    process.env.ASAAS_WEBHOOK_TOKEN = TEST_TOKEN
  })
})

// ============================================================
// 2. Validação de body
// ============================================================
describe('validação body', () => {
  test('body inválido JSON → 400', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      body: 'NOT JSON {{{',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test('body sem id → 400', async () => {
    const res = await POST(makeReq({ event: 'PAYMENT_CREATED' }))
    expect(res.status).toBe(400)
  })

  test('body sem event → 400', async () => {
    const res = await POST(makeReq({ id: genEventId('b1') }))
    expect(res.status).toBe(400)
  })
})

// ============================================================
// 3. Idempotência
// ============================================================
describe('idempotência', () => {
  test('mesmo eventId 2x → 2ª chamada retorna IDEMPOTENT_SKIP, não reprocessa', async () => {
    const u = await makeUser('idem1')
    const eventId = genEventId('idem1')
    const body = {
      id: eventId,
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_idem',
        customer: 'cus_x',
        subscription: null,
        value: 149.99,
        billingType: 'PIX',
        status: 'CONFIRMED',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }

    const r1 = await POST(makeReq(body))
    expect(r1.status).toBe(200)
    const j1 = await r1.json()
    expect(j1.status).toBe('PROCESSED')

    const subAfter1 = await prisma.subscription.findUnique({ where: { userId: u.id } })
    const periodEnd1 = subAfter1?.currentPeriodEnd

    const r2 = await POST(makeReq(body))
    expect(r2.status).toBe(200)
    const j2 = await r2.json()
    expect(j2.status).toBe('IDEMPOTENT_SKIP')

    const subAfter2 = await prisma.subscription.findUnique({ where: { userId: u.id } })
    // Não estendeu de novo: período permanece igual
    expect(subAfter2?.currentPeriodEnd?.getTime()).toBe(periodEnd1?.getTime())

    const events = await prisma.webhookEvent.findMany({ where: { asaasEventId: eventId } })
    expect(events).toHaveLength(1)
  })
})

// ============================================================
// 4. PAYMENT_CONFIRMED / PAYMENT_RECEIVED → ACTIVATE
// ============================================================
describe('PAYMENT_CONFIRMED / PAYMENT_RECEIVED', () => {
  test('PAYMENT_CONFIRMED via externalReference (MONTHLY) ativa + estende', async () => {
    const u = await makeUser('conf1')
    const eventId = genEventId('conf1')
    const body = {
      id: eventId,
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_001',
        customer: 'cus_001',
        subscription: 'sub_001',
        value: 149.99,
        billingType: 'CREDIT_CARD',
        status: 'CONFIRMED',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE')
    expect(sub?.currentPeriodEnd).toBeTruthy()
    expect(sub?.gatewaySubscriptionId).toBe('sub_001') // setado lazy
    expect(sub?.canceledAt).toBe(null)

    const event = await prisma.webhookEvent.findUnique({ where: { asaasEventId: eventId } })
    expect(event?.status).toBe('PROCESSED')
    expect(event?.processedAt).toBeTruthy()
    expect(event?.subscriptionId).toBe(sub?.id)
  })

  test('PAYMENT_RECEIVED (Pix) via externalReference YEARLY → +12 meses', async () => {
    const u = await makeUser('recv1')
    const body = {
      id: genEventId('recv1'),
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_y1',
        customer: 'cus_y1',
        subscription: null, // Pix
        value: 1499.99,
        billingType: 'PIX',
        status: 'RECEIVED',
        externalReference: `user:${u.id}|plan:performance|ciclo:YEARLY|dias:365`,
      },
    }
    const before = new Date()
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE')
    expect(sub?.currentPeriodEnd).toBeTruthy()
    // +12 meses → ~365 dias à frente
    const deltaDays =
      (sub!.currentPeriodEnd!.getTime() - before.getTime()) / (24 * 60 * 60 * 1000)
    expect(deltaDays).toBeGreaterThan(360)
    expect(deltaDays).toBeLessThan(370)
  })

  test('renovação: 2ª confirmação estende o período (não retrocede)', async () => {
    const futureEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) // 20d à frente
    const u = await makeUser('renew1', {
      subStatus: 'ACTIVE',
      currentPeriodEnd: futureEnd,
    })
    const body = {
      id: genEventId('renew1'),
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_renew',
        customer: 'cus_renew',
        subscription: 'sub_renew',
        value: 149.99,
        billingType: 'CREDIT_CARD',
        status: 'CONFIRMED',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE')
    // Estendeu a partir do futuro (não retrocedeu pro now+1m)
    expect(sub!.currentPeriodEnd!.getTime()).toBeGreaterThan(
      futureEnd.getTime() + 27 * 24 * 60 * 60 * 1000,
    )
  })

  test('camada 2: identifica via gatewaySubscriptionId', async () => {
    const u = await makeUser('gw1', {
      gatewaySubscriptionId: 'sub_gw_xxx',
    })
    const body = {
      id: genEventId('gw1'),
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_gw1',
        customer: 'cus_gw1',
        subscription: 'sub_gw_xxx',
        value: 149.99,
        billingType: 'CREDIT_CARD',
        status: 'CONFIRMED',
        externalReference: null, // sem externalReference
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE')
  })

  test('camada 3: fallback gatewayCustomerId (Pix)', async () => {
    const u = await makeUser('cust1', {
      gatewayCustomerId: 'cus_pix_xxx',
    })
    const body = {
      id: genEventId('cust1'),
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_pix1',
        customer: 'cus_pix_xxx',
        subscription: null,
        value: 149.99,
        billingType: 'PIX',
        status: 'RECEIVED',
        externalReference: null,
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE')
  })

  test('reativação: status CANCELED → ACTIVE limpa canceledAt', async () => {
    const u = await makeUser('reativ1', {
      subStatus: 'CANCELED',
    })
    await prisma.subscription.update({
      where: { userId: u.id },
      data: { canceledAt: new Date() },
    })
    const body = {
      id: genEventId('reativ1'),
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_reativ',
        customer: 'cus_r',
        subscription: null,
        value: 149.99,
        billingType: 'PIX',
        status: 'CONFIRMED',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    await POST(makeReq(body))
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE')
    expect(sub?.canceledAt).toBe(null)
  })

  test('gatewaySubscriptionId NÃO sobrescreve existente', async () => {
    const u = await makeUser('lazy1', {
      gatewaySubscriptionId: 'sub_OLD',
    })
    const body = {
      id: genEventId('lazy1'),
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_lazy',
        customer: 'cus_x',
        subscription: 'sub_NEW', // tenta sobrescrever
        value: 149.99,
        billingType: 'CREDIT_CARD',
        status: 'CONFIRMED',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    await POST(makeReq(body))
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.gatewaySubscriptionId).toBe('sub_OLD') // preservado
  })
})

// ============================================================
// 5. PAYMENT_OVERDUE → PAST_DUE (sem cortar acesso)
// ============================================================
describe('PAYMENT_OVERDUE → PAST_DUE', () => {
  test('marca PAST_DUE mas NÃO cancela acesso', async () => {
    const u = await makeUser('over1', { subStatus: 'ACTIVE' })
    const body = {
      id: genEventId('over1'),
      event: 'PAYMENT_OVERDUE',
      payment: {
        id: 'pay_over',
        customer: 'cus_o',
        subscription: null,
        value: 149.99,
        billingType: 'CREDIT_CARD',
        status: 'OVERDUE',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('PAST_DUE')
    expect(sub?.canceledAt).toBe(null)
  })
})

// ============================================================
// 6. PAYMENT_REFUNDED / DELETED → CANCEL
// ============================================================
describe('CANCEL events', () => {
  test('PAYMENT_REFUNDED → CANCELED + canceledAt', async () => {
    const u = await makeUser('ref1', { subStatus: 'ACTIVE' })
    const body = {
      id: genEventId('ref1'),
      event: 'PAYMENT_REFUNDED',
      payment: {
        id: 'pay_ref',
        customer: 'cus_r',
        subscription: null,
        value: 149.99,
        billingType: 'PIX',
        status: 'REFUNDED',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    await POST(makeReq(body))
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('CANCELED')
    expect(sub?.canceledAt).toBeTruthy()
  })

  test('PAYMENT_DELETED → CANCELED', async () => {
    const u = await makeUser('del1', { subStatus: 'ACTIVE' })
    const body = {
      id: genEventId('del1'),
      event: 'PAYMENT_DELETED',
      payment: {
        id: 'pay_del',
        customer: 'cus_d',
        subscription: null,
        value: 149.99,
        billingType: 'PIX',
        status: 'PENDING',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    await POST(makeReq(body))
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('CANCELED')
  })
})

// ============================================================
// 7. PAYMENT_CHARGEBACK_REQUESTED → PAST_DUE
// ============================================================
describe('chargeback', () => {
  test('PAYMENT_CHARGEBACK_REQUESTED → PAST_DUE (não cancela)', async () => {
    const u = await makeUser('cbk1', { subStatus: 'ACTIVE' })
    const body = {
      id: genEventId('cbk1'),
      event: 'PAYMENT_CHARGEBACK_REQUESTED',
      payment: {
        id: 'pay_cbk',
        customer: 'cus_c',
        subscription: null,
        value: 149.99,
        billingType: 'CREDIT_CARD',
        status: 'CHARGEBACK_REQUESTED',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    await POST(makeReq(body))
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('PAST_DUE')
  })
})

// ============================================================
// 8. Eventos IGNORADOS (grava mas não afeta)
// ============================================================
describe('IGNORED events', () => {
  test('PAYMENT_CREATED → grava IGNORED, não mexe na Subscription', async () => {
    const u = await makeUser('ign1', { subStatus: 'TRIAL' })
    const eventId = genEventId('ign1')
    const body = {
      id: eventId,
      event: 'PAYMENT_CREATED',
      payment: {
        id: 'pay_ign',
        customer: 'cus_ign',
        subscription: null,
        value: 149.99,
        billingType: 'PIX',
        status: 'PENDING',
        externalReference: `user:${u.id}|plan:inteligencia|ciclo:MONTHLY`,
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.status).toBe('IGNORED')

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('TRIAL') // não mudou

    const event = await prisma.webhookEvent.findUnique({ where: { asaasEventId: eventId } })
    expect(event?.status).toBe('IGNORED')
  })

  test('SUBSCRIPTION_DELETED → IGNORED (decisão de produto)', async () => {
    const u = await makeUser('subdel1', { subStatus: 'ACTIVE' })
    const body = {
      id: genEventId('subdel1'),
      event: 'SUBSCRIPTION_DELETED',
      // SUBSCRIPTION_* não tem campo payment; payload diferente.
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('ACTIVE') // não tocou
  })

  test('evento totalmente desconhecido → IGNORED', async () => {
    const res = await POST(makeReq({
      id: genEventId('unk1'),
      event: 'SOMETHING_NEW_ASAAS_RELEASE',
    }))
    expect(res.status).toBe(200)
  })
})

// ============================================================
// 9. Subscription não localizada → ERROR + 200
// ============================================================
describe('subscription não localizada', () => {
  test('externalReference quebrado + nada bate → ERROR + 200', async () => {
    const eventId = genEventId('err1')
    const body = {
      id: eventId,
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: 'pay_orphan',
        customer: 'cus_inexistente',
        subscription: 'sub_inexistente',
        value: 149.99,
        billingType: 'PIX',
        status: 'CONFIRMED',
        externalReference: 'user:nao_existe_xxx|plan:inteligencia|ciclo:MONTHLY',
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200) // 200 pra Asaas não trava fila
    const j = await res.json()
    expect(j.status).toBe('ERROR')

    const event = await prisma.webhookEvent.findUnique({ where: { asaasEventId: eventId } })
    expect(event?.status).toBe('ERROR')
    expect(event?.errorMessage).toContain('não localizada')
    expect(event?.subscriptionId).toBe(null)
  })

  test('externalReference malformado + sem outros campos → ERROR', async () => {
    const eventId = genEventId('err2')
    const body = {
      id: eventId,
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_bad',
        customer: 'cus_nada',
        subscription: null,
        value: 99,
        billingType: 'PIX',
        status: 'RECEIVED',
        externalReference: 'lixo|sem|formato',
      },
    }
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)
    const event = await prisma.webhookEvent.findUnique({ where: { asaasEventId: eventId } })
    expect(event?.status).toBe('ERROR')
  })
})
