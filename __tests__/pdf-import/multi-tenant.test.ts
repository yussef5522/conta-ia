// Sprint PF Fatia 3.5 — Isolamento multi-tenant nos endpoints PDF.

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  createProfile,
} from '@/lib/personal-profile/queries'
import { createCreditCard } from '@/lib/credit-card/queries'

const FIXTURE = readFileSync(
  join(__dirname, '..', 'fixtures', 'nubank-mai-2026.json'),
  'utf-8',
)
const PREFIX = `pdf-mt-${Date.now()}-${process.pid}`

process.env.PDF_IMPORT_ENABLED = 'true'

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

const { GET: getStatus } = await import('@/app/api/perfis/[id]/pdf-import/status/route')
const { POST: postPreview } = await import('@/app/api/perfis/[id]/pdf-import/preview/route')
const { POST: postConfirm } = await import('@/app/api/perfis/[id]/pdf-import/confirm/route')
const { GET: getCacheList } = await import('@/app/api/auth/me/pdf-cache/route')
const { DELETE: deleteCacheEp } = await import('@/app/api/auth/me/pdf-cache/[sha256]/route')

let userA: { id: string }
let userB: { id: string }
let profileA: { id: string }
let profileB: { id: string }
let cardA: { id: string }
let cardB: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({ data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd } })
  userB = await prisma.user.create({ data: { name: 'B', email: `${PREFIX}-b@dev.local`, password: pwd } })
  profileA = await createProfile({ userId: userA.id, name: 'A1' })
  profileB = await createProfile({ userId: userB.id, name: 'B1' })
  cardA = await createCreditCard({ userId: userA.id, profileId: profileA.id, name: 'CardA', creditLimit: 5000, closingDay: 14, dueDay: 20 })
  cardB = await createCreditCard({ userId: userB.id, profileId: profileB.id, name: 'CardB', creditLimit: 5000, closingDay: 14, dueDay: 20 })

  // Pré-popula cache pra userA
  await prisma.personalPdfExtractCache.create({
    data: {
      pdfSha256: 'e'.repeat(64),
      modelVersion: 'sonnet',
      resultJson: FIXTURE,
      inputTokens: 100,
      outputTokens: 50,
      costCentsUsdX100: 10,
      ownerUserId: userA.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await prisma.personalPdfExtractCache
    .deleteMany({ where: { ownerUserId: { in: [userA.id, userB.id] } } })
    .catch(() => {})
  await prisma.user.deleteMany({ where: { email: { contains: PREFIX } } }).catch(() => {})
})

function asUser(userId: string) {
  mockGetAuthUser.mockResolvedValue({ sub: userId, email: 'x', role: 'CLIENT', name: 'x' })
}
function jsonReq(method: string, body?: unknown) {
  const headers = { 'content-type': 'application/json' }
  if (method === 'GET' || method === 'HEAD' || body === undefined || body === null) {
    return new NextRequest('http://localhost/api/test', { method, headers })
  }
  return new NextRequest('http://localhost/api/test', {
    method,
    headers,
    body: JSON.stringify(body),
  })
}

describe('🛡️ ISOLAMENTO multi-tenant (Fatia 3.5 PDF)', () => {
  test('status sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await getStatus(jsonReq('GET'))
    expect(res.status).toBe(401)
  })

  test('status com auth retorna allowed=true (test env)', async () => {
    asUser(userA.id)
    const res = await getStatus(jsonReq('GET'))
    const data = await res.json()
    expect(data.allowed).toBe(true)
  })

  test('🚨 confirm userB → importA → 404', async () => {
    asUser(userB.id)
    const res = await postConfirm(
      jsonReq('POST', {
        importId: 'fake-id',
        decisions: [],
      }),
      { params: Promise.resolve({ id: profileA.id }) },
    )
    expect([404, 400]).toContain(res.status)
  })

  test('🚨 listCacheList userB NÃO vê cache de A', async () => {
    asUser(userB.id)
    const res = await getCacheList(jsonReq('GET'))
    const data = await res.json()
    expect(data.caches.some((c: { pdfSha256: string }) => c.pdfSha256 === 'e'.repeat(64))).toBe(false)
  })

  test('userA vê SEUS caches', async () => {
    asUser(userA.id)
    const res = await getCacheList(jsonReq('GET'))
    const data = await res.json()
    expect(data.caches.some((c: { pdfSha256: string }) => c.pdfSha256 === 'e'.repeat(64))).toBe(true)
  })

  test('🚨 DELETE cache de outro user → 404', async () => {
    asUser(userB.id)
    const res = await deleteCacheEp(jsonReq('DELETE'), {
      params: Promise.resolve({ sha256: 'e'.repeat(64) }),
    })
    expect(res.status).toBe(404)
    // cache continua existindo
    const still = await prisma.personalPdfExtractCache.findUnique({
      where: { pdfSha256: 'e'.repeat(64) },
    })
    expect(still).not.toBeNull()
  })

  test('DELETE cache do próprio user → 200 + deletado', async () => {
    asUser(userA.id)
    const res = await deleteCacheEp(jsonReq('DELETE'), {
      params: Promise.resolve({ sha256: 'e'.repeat(64) }),
    })
    expect(res.status).toBe(200)
    const gone = await prisma.personalPdfExtractCache.findUnique({
      where: { pdfSha256: 'e'.repeat(64) },
    })
    expect(gone).toBeNull()
  })

  test('🚨 DELETE sha256 inválido (não-hex) → 400', async () => {
    asUser(userA.id)
    const res = await deleteCacheEp(jsonReq('DELETE'), {
      params: Promise.resolve({ sha256: 'NOT-A-HASH' }),
    })
    expect(res.status).toBe(400)
  })

  test('🚨 preview sem multipart → 400', async () => {
    asUser(userA.id)
    const res = await postPreview(
      jsonReq('POST', { creditCardId: cardA.id }),
      { params: Promise.resolve({ id: profileA.id }) },
    )
    expect(res.status).toBe(400)
  })
})
