// Sprint post-3B — dev rotas /api/dev/(expire|restore)-trial
// 🚨 Testa que SÓ ativam em sandbox + nunca tocam GRANTED + multi-tenant.

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { checkDevGuard, isDevToolsEnabled } from '@/lib/dev/guard'

// Mock getAuthUser
const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

const { POST: postExpire } = await import('@/app/api/dev/expire-trial/route')
const { POST: postRestore } = await import('@/app/api/dev/restore-trial/route')

const TEST_PREFIX = `devroute-${Date.now()}-${process.pid}`
const createdUserIds: string[] = []

async function makeUserWithSub(opts: {
  email: string
  subStatus: 'TRIAL' | 'ACTIVE' | 'GRANTED' | 'EXPIRED'
}) {
  const u = await prisma.user.create({
    data: {
      name: 'Dev T',
      email: opts.email,
      password: await bcrypt.hash('Senha123!', 10),
    },
  })
  createdUserIds.push(u.id)
  await prisma.subscription.create({
    data: {
      userId: u.id,
      planId: 'inteligencia',
      status: opts.subStatus,
      trialEndsAt:
        opts.subStatus === 'TRIAL'
          ? new Date(Date.now() + 14 * 86400_000)
          : null,
    },
  })
  return u
}

beforeEach(() => {
  vi.clearAllMocks()
  // default: sandbox ativo
  process.env.ASAAS_ENV = 'sandbox'
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

const REQ = new NextRequest('http://localhost/api/dev/test', { method: 'POST' })

/* ===== Guard puro ===== */
describe('checkDevGuard / isDevToolsEnabled', () => {
  test('ASAAS_ENV=sandbox → allow', () => {
    expect(checkDevGuard({ ASAAS_ENV: 'sandbox' }).allow).toBe(true)
    expect(isDevToolsEnabled({ ASAAS_ENV: 'sandbox' })).toBe(true)
  })

  test('ASAAS_ENV=production → BLOCK + reason=NOT_SANDBOX', () => {
    const r = checkDevGuard({ ASAAS_ENV: 'production' })
    expect(r.allow).toBe(false)
    expect(r.reason).toBe('NOT_SANDBOX')
    expect(isDevToolsEnabled({ ASAAS_ENV: 'production' })).toBe(false)
  })

  test('ASAAS_ENV undefined → BLOCK', () => {
    expect(isDevToolsEnabled({})).toBe(false)
  })
})

/* ===== /api/dev/expire-trial ===== */
describe('POST /api/dev/expire-trial', () => {
  test('ambiente NÃO sandbox → 404 (não revela existência)', async () => {
    process.env.ASAAS_ENV = 'production'
    const res = await postExpire(REQ)
    expect(res.status).toBe(404)
  })

  test('sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await postExpire(REQ)
    expect(res.status).toBe(401)
  })

  test('🚨 GRANTED → 403 GRANTED_PROTECTED (NUNCA expira admin)', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-granted@t.dev`,
      subStatus: 'GRANTED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postExpire(REQ)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('GRANTED_PROTECTED')

    // Status NÃO mudou
    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('GRANTED')
  })

  test('TRIAL ativo → vira TRIAL com trialEndsAt no passado', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-trial@t.dev`,
      subStatus: 'TRIAL',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postExpire(REQ)
    expect(res.status).toBe(200)

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('TRIAL')
    expect(sub?.trialEndsAt).not.toBeNull()
    expect(sub!.trialEndsAt!.getTime()).toBeLessThan(Date.now())
  })

  test('🛡️ multi-tenant: só altera o próprio user', async () => {
    const userA = await makeUserWithSub({
      email: `${TEST_PREFIX}-mtA@t.dev`,
      subStatus: 'TRIAL',
    })
    const userB = await makeUserWithSub({
      email: `${TEST_PREFIX}-mtB@t.dev`,
      subStatus: 'TRIAL',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: userA.id,
      email: userA.email,
      name: userA.name,
      role: 'CLIENT',
    })

    await postExpire(REQ)

    // A expirou
    const subA = await prisma.subscription.findUnique({ where: { userId: userA.id } })
    expect(subA!.trialEndsAt!.getTime()).toBeLessThan(Date.now())
    // B INTACTO
    const subB = await prisma.subscription.findUnique({ where: { userId: userB.id } })
    expect(subB!.trialEndsAt!.getTime()).toBeGreaterThan(Date.now())
  })

  test('user sem subscription → 404', async () => {
    const u = await prisma.user.create({
      data: {
        name: 'Orphan',
        email: `${TEST_PREFIX}-orphan@t.dev`,
        password: 'hash',
      },
    })
    createdUserIds.push(u.id)
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postExpire(REQ)
    expect(res.status).toBe(404)
  })
})

/* ===== /api/dev/restore-trial ===== */
describe('POST /api/dev/restore-trial', () => {
  test('ambiente NÃO sandbox → 404', async () => {
    process.env.ASAAS_ENV = 'production'
    const res = await postRestore(REQ)
    expect(res.status).toBe(404)
  })

  test('🚨 GRANTED → 403 GRANTED_PROTECTED', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-rstr-granted@t.dev`,
      subStatus: 'GRANTED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postRestore(REQ)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('GRANTED_PROTECTED')

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('GRANTED')
  })

  test('EXPIRED → restaura pra TRIAL +14d', async () => {
    const u = await makeUserWithSub({
      email: `${TEST_PREFIX}-rstr-exp@t.dev`,
      subStatus: 'EXPIRED',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: 'CLIENT',
    })

    const res = await postRestore(REQ)
    expect(res.status).toBe(200)

    const sub = await prisma.subscription.findUnique({ where: { userId: u.id } })
    expect(sub?.status).toBe('TRIAL')
    const diffDays =
      (sub!.trialEndsAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBeGreaterThan(13)
    expect(diffDays).toBeLessThanOrEqual(14.01)
  })
})
