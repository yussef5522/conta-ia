// Sprint PF FATIA 1 — Isolamento multi-tenant nos ENDPOINTS REST.
// Estes são os "10+ testes de isolamento" — confirmam que vazamentos
// entre users são impossíveis via API HTTP.

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'

const PREFIX = `pf-endpoint-${Date.now()}-${process.pid}`

// Mock getAuthUser pra controlar qual user "está logado"
const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

const { GET: getPerfis, POST: postPerfis } = await import('@/app/api/perfis/route')
const {
  GET: getPerfilDetail,
  PATCH: patchPerfil,
  DELETE: deletePerfil,
} = await import('@/app/api/perfis/[id]/route')
const { GET: getContas, POST: postConta } = await import(
  '@/app/api/perfis/[id]/contas/route'
)
const { POST: postTx, GET: getTx } = await import(
  '@/app/api/perfis/[id]/transacoes/route'
)
const { POST: postAtual } = await import('@/app/api/perfis/atual/route')

let userA: { id: string }
let userB: { id: string }
let perfilA: { id: string }
let perfilB: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@dev.local`, password: pwd },
  })
  perfilA = await createProfile({ userId: userA.id, name: 'A self' })
  perfilB = await createProfile({ userId: userB.id, name: 'B self' })
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

function req(method = 'GET', body?: unknown) {
  return new NextRequest('http://localhost/api/test', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })
}

// ============================================================
// ISOLAMENTO MULTI-TENANT — 12 testes críticos
// ============================================================
describe('🛡️ ISOLAMENTO multi-tenant (PF Fatia 1)', () => {
  test('GET /api/perfis sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await getPerfis(req())
    expect(res.status).toBe(401)
  })

  test('GET /api/perfis lista SÓ perfis do user logado', async () => {
    asUser(userA.id)
    const res = await getPerfis(req())
    const data = await res.json()
    expect(data.profiles.some((p: { id: string }) => p.id === perfilA.id)).toBe(true)
    expect(data.profiles.some((p: { id: string }) => p.id === perfilB.id)).toBe(false)
  })

  test('🚨 GET /api/perfis/[id] userB → perfilA → 404 NO_ACCESS', async () => {
    asUser(userB.id)
    const res = await getPerfilDetail(req(), { params: Promise.resolve({ id: perfilA.id }) })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.code).toBe('NO_ACCESS')
  })

  test('🚨 PATCH /api/perfis/[id] userB → perfilA → 404', async () => {
    asUser(userB.id)
    const res = await patchPerfil(req('PATCH', { name: 'hacked' }), {
      params: Promise.resolve({ id: perfilA.id }),
    })
    expect(res.status).toBe(404)
    // Confirma que NÃO mudou
    const p = await prisma.personalProfile.findUnique({ where: { id: perfilA.id } })
    expect(p?.name).toBe('A self')
  })

  test('🚨 DELETE /api/perfis/[id] userB → perfilA → 404', async () => {
    asUser(userB.id)
    const res = await deletePerfil(req('DELETE'), {
      params: Promise.resolve({ id: perfilA.id }),
    })
    expect(res.status).toBe(404)
    const p = await prisma.personalProfile.findUnique({ where: { id: perfilA.id } })
    expect(p?.isActive).toBe(true) // não foi soft-deleted
  })

  test('🚨 GET /api/perfis/[id]/contas userB → perfilA → 404', async () => {
    asUser(userB.id)
    const res = await getContas(req(), { params: Promise.resolve({ id: perfilA.id }) })
    expect(res.status).toBe(404)
  })

  test('🚨 POST /api/perfis/[id]/contas userB → perfilA → 404 + nada criado', async () => {
    asUser(userB.id)
    const before = await prisma.personalBankAccount.count({
      where: { profileId: perfilA.id },
    })
    const res = await postConta(req('POST', { name: 'invasor' }), {
      params: Promise.resolve({ id: perfilA.id }),
    })
    expect(res.status).toBe(404)
    const after = await prisma.personalBankAccount.count({
      where: { profileId: perfilA.id },
    })
    expect(after).toBe(before)
  })

  test('🚨 POST tx userB → perfilA → 404 + nada criado', async () => {
    asUser(userB.id)
    const before = await prisma.personalTransaction.count({
      where: { profileId: perfilA.id },
    })
    const res = await postTx(
      req('POST', {
        date: new Date().toISOString(),
        description: 'invasor',
        amount: 1000,
        type: 'CREDIT',
      }),
      { params: Promise.resolve({ id: perfilA.id }) },
    )
    expect(res.status).toBe(404)
    const after = await prisma.personalTransaction.count({
      where: { profileId: perfilA.id },
    })
    expect(after).toBe(before)
  })

  test('🚨 GET tx userB → perfilA → 404', async () => {
    asUser(userB.id)
    const res = await getTx(req(), { params: Promise.resolve({ id: perfilA.id }) })
    expect(res.status).toBe(404)
  })

  test('🚨 cross-account: POST tx com bankAccountId de OUTRO perfil DO MESMO USER → INVALID_ACCOUNT', async () => {
    // userA tem perfilA. Vamos criar OUTRO perfil dele, com conta própria.
    const perfilA2 = await createProfile({ userId: userA.id, name: 'A2' })
    const accA2 = await createAccount({
      userId: userA.id,
      profileId: perfilA2.id,
      name: 'acc A2',
    })
    asUser(userA.id)
    // Tenta lançar transação no perfilA usando conta do perfilA2
    const res = await postTx(
      req('POST', {
        date: new Date().toISOString(),
        description: 'cross-account vazamento',
        amount: 100,
        type: 'DEBIT',
        bankAccountId: accA2.id,
      }),
      { params: Promise.resolve({ id: perfilA.id }) },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.code).toBe('INVALID_ACCOUNT')
  })

  test('🚨 POST /api/perfis/atual com profileId de OUTRO user → 404', async () => {
    asUser(userB.id)
    const res = await postAtual(req('POST', { profileId: perfilA.id }))
    expect(res.status).toBe(404)
  })

  test('user B só vê SEUS próprios perfis em GET /api/perfis', async () => {
    asUser(userB.id)
    const res = await getPerfis(req())
    const data = await res.json()
    expect(data.profiles.some((p: { id: string }) => p.id === perfilB.id)).toBe(true)
    expect(data.profiles.some((p: { id: string }) => p.id === perfilA.id)).toBe(false)
    expect(data.profiles.every((p: { id: string }) => p.id !== perfilA.id)).toBe(true)
  })

  test('user A só vê SEUS próprios perfis', async () => {
    asUser(userA.id)
    const res = await getPerfis(req())
    const data = await res.json()
    expect(data.profiles.some((p: { id: string }) => p.id === perfilA.id)).toBe(true)
    expect(data.profiles.some((p: { id: string }) => p.id === perfilB.id)).toBe(false)
  })
})

// ============================================================
// CRUD básico do user logado (sanity checks)
// ============================================================
describe('CRUD básico', () => {
  test('POST /api/perfis cria perfil pro user logado', async () => {
    asUser(userA.id)
    const res = await postPerfis(
      req('POST', { name: 'novo perfil', type: 'OWN' }),
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.profile.name).toBe('novo perfil')
  })

  test('POST /api/perfis validation: nome vazio → 400', async () => {
    asUser(userA.id)
    const res = await postPerfis(req('POST', { name: '' }))
    expect(res.status).toBe(400)
  })

  test('GET /api/perfis/[id] retorna summary', async () => {
    asUser(userA.id)
    const res = await getPerfilDetail(req(), {
      params: Promise.resolve({ id: perfilA.id }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile.id).toBe(perfilA.id)
    expect(data.summary).toBeDefined()
    expect(typeof data.summary.totalBalance).toBe('number')
  })
})
