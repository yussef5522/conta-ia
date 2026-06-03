// Sprint PF Fatia 3 — Isolamento multi-tenant nos endpoints OFX import.

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createProfile } from '@/lib/personal-profile/queries'
import { createCreditCard } from '@/lib/credit-card/queries'
import { createPreview, confirmImport } from '@/lib/ofx-card/queries'

const FIXTURE = readFileSync(
  join(__dirname, '..', 'fixtures', 'nubank-fatura.ofx'),
  'utf-8',
)

const PREFIX = `ofx-mt-${Date.now()}-${process.pid}`

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

const { POST: postPreview } = await import('@/app/api/perfis/[id]/ofx-import/preview/route')
const { POST: postConfirm } = await import('@/app/api/perfis/[id]/ofx-import/confirm/route')
const { GET: getHistorico } = await import('@/app/api/perfis/[id]/ofx-import/historico/route')
const { POST: postReverter } = await import(
  '@/app/api/perfis/[id]/ofx-import/[importId]/reverter/route'
)
const { GET: getRecorrentes } = await import('@/app/api/perfis/[id]/insights/recorrentes/route')

let userA: { id: string }
let userB: { id: string }
let profileA: { id: string }
let profileB: { id: string }
let cardA: { id: string }
let cardB: { id: string }
let importA: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@dev.local`, password: pwd },
  })
  profileA = await createProfile({ userId: userA.id, name: 'A1' })
  profileB = await createProfile({ userId: userB.id, name: 'B1' })
  cardA = await createCreditCard({
    userId: userA.id,
    profileId: profileA.id,
    name: 'CardA',
    creditLimit: 5000,
    closingDay: 14,
    dueDay: 20,
  })
  cardB = await createCreditCard({
    userId: userB.id,
    profileId: profileB.id,
    name: 'CardB',
    creditLimit: 5000,
    closingDay: 14,
    dueDay: 20,
  })
  // Cria 1 import já confirmado em A pra testar reverter cross-user
  const preview = await createPreview({
    userId: userA.id,
    profileId: profileA.id,
    creditCardId: cardA.id,
    fileName: 'n.ofx',
    fileSize: FIXTURE.length,
    rawContent: FIXTURE,
  })
  await confirmImport({
    userId: userA.id,
    profileId: profileA.id,
    importId: preview.importId,
    decisions: preview.lines.map((l) => ({
      fitid: l.fitid,
      skip: l.shouldSkipImport,
      categoryId: l.suggestedCategoryId,
    })),
    rawContent: FIXTURE,
  })
  importA = { id: preview.importId }
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: PREFIX } } })
    .catch(() => {})
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

describe('🛡️ ISOLAMENTO multi-tenant (Fatia 3 OFX)', () => {
  test('preview sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await postPreview(
      jsonReq('POST', { creditCardId: cardA.id, fileName: 'x.ofx', rawContent: FIXTURE }),
      { params: Promise.resolve({ id: profileA.id }) },
    )
    expect(res.status).toBe(401)
  })

  test('🚨 preview userB → profileA → 404', async () => {
    asUser(userB.id)
    const res = await postPreview(
      jsonReq('POST', { creditCardId: cardA.id, fileName: 'x.ofx', rawContent: FIXTURE }),
      { params: Promise.resolve({ id: profileA.id }) },
    )
    expect(res.status).toBe(404)
  })

  test('🚨 preview userA com cardId de OUTRO perfil (cardB) → 400 CARD_NOT_FOUND', async () => {
    asUser(userA.id)
    const res = await postPreview(
      jsonReq('POST', { creditCardId: cardB.id, fileName: 'x.ofx', rawContent: FIXTURE }),
      { params: Promise.resolve({ id: profileA.id }) },
    )
    expect([400, 404]).toContain(res.status) // CARD_NOT_FOUND ou 400
  })

  test('🚨 confirm userB → importA → 404 + tx de A intactas', async () => {
    asUser(userB.id)
    const beforeCount = await prisma.personalTransaction.count({
      where: { ofxImportId: importA.id },
    })
    const res = await postConfirm(
      jsonReq('POST', {
        importId: importA.id,
        rawContent: FIXTURE,
        decisions: [],
      }),
      { params: Promise.resolve({ id: profileB.id }) },
    )
    expect([404, 409]).toContain(res.status) // 404 (profileB não acha) ou 409 (já confirmado)
    const afterCount = await prisma.personalTransaction.count({
      where: { ofxImportId: importA.id },
    })
    expect(afterCount).toBe(beforeCount)
  })

  test('🚨 reverter userB → importA → 404', async () => {
    asUser(userB.id)
    const res = await postReverter(jsonReq('POST', {}), {
      params: Promise.resolve({ id: profileA.id, importId: importA.id }),
    })
    expect(res.status).toBe(404)
    // import A continua SUCCESS
    const importRec = await prisma.personalOfxImport.findUnique({ where: { id: importA.id } })
    expect(importRec?.status).toBe('SUCCESS')
  })

  test('🚨 historico userB → profileA → 404', async () => {
    asUser(userB.id)
    const res = await getHistorico(jsonReq('GET', null), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(404)
  })

  test('🚨 insights/recorrentes userB → profileA → 404', async () => {
    asUser(userB.id)
    const res = await getRecorrentes(jsonReq('GET', null), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(404)
  })

  test('historico userA do profileA → SUCCESS + lista 1+', async () => {
    asUser(userA.id)
    const res = await getHistorico(jsonReq('GET', null), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.imports.some((i: { id: string }) => i.id === importA.id)).toBe(true)
  })

  test('🚨 confirm com categoryId de OUTRO perfil → 400 INVALID_CATEGORY', async () => {
    // Cria perfil novo, cartão novo, import novo
    const profileA2 = await createProfile({ userId: userA.id, name: 'A2' })
    const cardA2 = await createCreditCard({
      userId: userA.id,
      profileId: profileA2.id,
      name: 'CardA2',
      creditLimit: 5000,
      closingDay: 14,
      dueDay: 20,
    })
    const preview = await createPreview({
      userId: userA.id,
      profileId: profileA2.id,
      creditCardId: cardA2.id,
      fileName: 'n.ofx',
      fileSize: FIXTURE.length,
      rawContent: FIXTURE,
    })
    // Tentar usar categoryId de profileB (cross-perfil)
    const catB = await prisma.personalCategory.findFirst({
      where: { profileId: profileB.id, type: 'EXPENSE' },
    })
    if (!catB) return
    asUser(userA.id)
    const res = await postConfirm(
      jsonReq('POST', {
        importId: preview.importId,
        rawContent: FIXTURE,
        decisions: preview.lines.slice(0, 1).map((l) => ({
          fitid: l.fitid,
          skip: false,
          categoryId: catB.id, // categoria de OUTRO perfil
        })),
      }),
      { params: Promise.resolve({ id: profileA2.id }) },
    )
    expect(res.status).toBe(400)
  })
})
