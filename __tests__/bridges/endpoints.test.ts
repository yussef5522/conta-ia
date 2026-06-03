// Sprint PF Fatia 4 — Testes integration dos 6 endpoints REST.
// Cobre: auth, RBAC, privacidade multi-sócio, error mapping.

import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'
import { ForbiddenError, AuthenticationError } from '@/lib/auth/rbac'

const PREFIX = `bridge-ep-${Date.now()}-${process.pid}`

// === Auth mock (mesmo padrão dos outros testes de endpoint) ===
const mockGetAuthUser = vi.fn()
const mockGetAuthContext = vi.fn()

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

vi.mock('@/lib/auth/rbac', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/rbac')>()
  return {
    ...actual,
    getAuthContext: (req: NextRequest, companyId?: string) => mockGetAuthContext(req, companyId),
  }
})

const { POST: postPonte } = await import('@/app/api/pontes/route')
const { GET: getPonteDetail, DELETE: deletePonte } = await import('@/app/api/pontes/[id]/route')
const { GET: getEmpresaPontes } = await import('@/app/api/empresas/[id]/pontes/route')
const { GET: getPerfilPontes } = await import('@/app/api/perfis/[id]/pontes/route')
const { GET: getSummary } = await import('@/app/api/pontes/summary/route')

let userA: { id: string }
let userB: { id: string }
let companyId: string
let bankAccountId: string
let profileA: { id: string }
let pfAccount: { id: string }
let pfCategory: { id: string }
let pjTx: { id: string }
let createdBridgeId: string | null = null

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@x.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@x.local`, password: pwd },
  })

  const c = await prisma.company.create({
    data: {
      name: `${PREFIX}-co`, cnpj: `05${Date.now().toString().slice(-12)}`,
      type: 'service',
      users: {
        create: [{ userId: userA.id, role: 'OWNER' }, { userId: userB.id, role: 'OWNER' }],
      },
    },
  })
  companyId = c.id
  const ba = await prisma.bankAccount.create({
    data: { companyId, name: 'Banrisul', accountType: 'CHECKING' },
  })
  bankAccountId = ba.id

  profileA = await createProfile({
    userId: userA.id, name: 'A PF', cpf: '60025889060',
  })
  const acc = await createAccount({
    userId: userA.id, profileId: profileA.id,
    name: 'Nubank PF', accountType: 'CHECKING',
  })
  pfAccount = { id: acc.id }
  const cats = await prisma.personalCategory.findMany({
    where: { profileId: profileA.id, type: 'INCOME' }, take: 1,
  })
  pfCategory = { id: cats[0]!.id }

  pjTx = await prisma.transaction.create({
    data: {
      bankAccountId, date: new Date(),
      description: 'Pix Yussef', amount: 5000, type: 'DEBIT', lifecycle: 'EFFECTED',
    },
  })
})

afterAll(async () => {
  await prisma.pJtoPFBridge.deleteMany({ where: { companyId } })
  await prisma.personalTransaction.deleteMany({ where: { profileId: profileA.id } })
  await prisma.transaction.deleteMany({ where: { bankAccountId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.personalCategory.deleteMany({ where: { profileId: profileA.id } })
  await prisma.personalBankAccount.deleteMany({ where: { profileId: profileA.id } })
  await prisma.userPersonalProfile.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await prisma.personalProfile.deleteMany({ where: { id: profileA.id } })
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
})

function authedReq(method: string, body?: unknown, urlExtras = '') {
  const headers = { 'content-type': 'application/json' }
  const url = `http://localhost/api/test${urlExtras}`
  if (method === 'GET' || method === 'HEAD' || body === undefined) {
    return new NextRequest(url, { method, headers })
  }
  return new NextRequest(url, {
    method, headers, body: JSON.stringify(body),
  })
}

function asUserCtx(userId: string, permissions: string[] = ['transaction.view', 'transaction.create', 'transaction.delete']) {
  mockGetAuthContext.mockResolvedValue({
    user: { id: userId, name: 'X', email: 'x' },
    company: { id: companyId },
    role: { id: 'r', name: 'R', isSystemDefault: false },
    permissions,
    hasPermission: (k: string) => permissions.includes(k),
    requirePermission: (k: string) => {
      if (!permissions.includes(k)) {
        throw new ForbiddenError(`Permissão necessária: ${k}`)
      }
    },
  })
  mockGetAuthUser.mockResolvedValue({ sub: userId, email: 'x', role: 'CLIENT', name: 'X' })
}

describe('POST /api/pontes', () => {
  test('Sem auth → 401', async () => {
    mockGetAuthContext.mockRejectedValueOnce(new AuthenticationError())
    const res = await postPonte(authedReq('POST', {
      companyId, pjTransactionId: pjTx.id, profileId: profileA.id,
      pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id, kind: 'DISTRIBUICAO',
    }))
    expect(res.status).toBe(401)
  })

  test('Sem RBAC transaction.create → 403', async () => {
    asUserCtx(userA.id, ['transaction.view']) // só view
    const res = await postPonte(authedReq('POST', {
      companyId, pjTransactionId: pjTx.id, profileId: profileA.id,
      pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id, kind: 'DISTRIBUICAO',
    }))
    expect(res.status).toBe(403)
  })

  test('Caminho feliz → 201 + bridgeId', async () => {
    asUserCtx(userA.id)
    const res = await postPonte(authedReq('POST', {
      companyId, pjTransactionId: pjTx.id, profileId: profileA.id,
      pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
      kind: 'DISTRIBUICAO', createdVia: 'CREATED_MANUAL',
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.bridgeId).toBeTruthy()
    createdBridgeId = json.bridgeId
  })

  test('Payload inválido (kind faltando) → 400', async () => {
    asUserCtx(userA.id)
    const res = await postPonte(authedReq('POST', {
      companyId, pjTransactionId: pjTx.id, profileId: profileA.id,
      pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
    }))
    expect(res.status).toBe(400)
  })

  test('🚨 PRIVACIDADE: userB com profileId de A → 404', async () => {
    asUserCtx(userB.id)
    const pjTx2 = await prisma.transaction.create({
      data: {
        bankAccountId, date: new Date(),
        description: 'Pix outra', amount: 100, type: 'DEBIT', lifecycle: 'EFFECTED',
      },
    })
    const res = await postPonte(authedReq('POST', {
      companyId, pjTransactionId: pjTx2.id, profileId: profileA.id,
      pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id, kind: 'DISTRIBUICAO',
    }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.code).toBe('PF_PROFILE_NOT_FOUND')
    await prisma.transaction.delete({ where: { id: pjTx2.id } })
  })
})

describe('GET /api/pontes/[id]', () => {
  test('🚨 PRIVACIDADE: userB GET bridge de A → 404', async () => {
    asUserCtx(userB.id)
    expect(createdBridgeId).toBeTruthy()
    const res = await getPonteDetail(authedReq('GET'), {
      params: Promise.resolve({ id: createdBridgeId! }),
    })
    expect(res.status).toBe(404)
  })

  test('Dono do perfil A → 200', async () => {
    asUserCtx(userA.id)
    const res = await getPonteDetail(authedReq('GET'), {
      params: Promise.resolve({ id: createdBridgeId! }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.bridge.id).toBe(createdBridgeId)
  })

  test('Bridge inexistente → 404', async () => {
    asUserCtx(userA.id)
    const res = await getPonteDetail(authedReq('GET'), {
      params: Promise.resolve({ id: 'cmfakeXXXX' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/pontes/[id]', () => {
  test('Sem mode → 400', async () => {
    asUserCtx(userA.id)
    const res = await deletePonte(authedReq('DELETE'), {
      params: Promise.resolve({ id: createdBridgeId! }),
    })
    expect(res.status).toBe(400)
  })

  test('Mode inválido → 400', async () => {
    asUserCtx(userA.id)
    const req = new NextRequest('http://localhost/api/test?mode=XX', { method: 'DELETE' })
    const res = await deletePonte(req, {
      params: Promise.resolve({ id: createdBridgeId! }),
    })
    expect(res.status).toBe(400)
  })

  test('🚨 PRIVACIDADE: userB tenta DELETE → 404', async () => {
    asUserCtx(userB.id)
    const req = new NextRequest('http://localhost/api/test?mode=LINK_ONLY', { method: 'DELETE' })
    const res = await deletePonte(req, {
      params: Promise.resolve({ id: createdBridgeId! }),
    })
    expect(res.status).toBe(404)
  })

  test('LINK_ONLY do dono → 200', async () => {
    asUserCtx(userA.id)
    const req = new NextRequest('http://localhost/api/test?mode=LINK_ONLY', { method: 'DELETE' })
    const res = await deletePonte(req, {
      params: Promise.resolve({ id: createdBridgeId! }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.pfTransactionDeleted).toBe(false)
  })
})

describe('GET /api/empresas/[id]/pontes', () => {
  test('Sem RBAC → 403', async () => {
    asUserCtx(userA.id, []) // zero permissions
    const res = await getEmpresaPontes(authedReq('GET'), {
      params: Promise.resolve({ id: companyId }),
    })
    expect(res.status).toBe(403)
  })

  test('Com auth + RBAC → 200 com lista', async () => {
    asUserCtx(userA.id)
    const res = await getEmpresaPontes(authedReq('GET'), {
      params: Promise.resolve({ id: companyId }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.bridges).toBeDefined()
    expect(Array.isArray(json.bridges)).toBe(true)
  })

  test('🚨 PRIVACIDADE: userB vê SUAS pontes (zero quando não tem perfil)', async () => {
    asUserCtx(userB.id)
    const res = await getEmpresaPontes(authedReq('GET'), {
      params: Promise.resolve({ id: companyId }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.bridges).toEqual([])
  })
})

describe('GET /api/perfis/[id]/pontes', () => {
  test('🚨 PRIVACIDADE: userB com profileId de A → 404', async () => {
    mockGetAuthUser.mockResolvedValue({ sub: userB.id, email: 'b', role: 'CLIENT', name: 'B' })
    const res = await getPerfilPontes(authedReq('GET'), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(404)
  })

  test('Dono → 200', async () => {
    mockGetAuthUser.mockResolvedValue({ sub: userA.id, email: 'a', role: 'CLIENT', name: 'A' })
    const res = await getPerfilPontes(authedReq('GET'), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(200)
  })

  test('Sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await getPerfilPontes(authedReq('GET'), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/pontes/summary', () => {
  test('Sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await getSummary(authedReq('GET'))
    expect(res.status).toBe(401)
  })

  test('Com auth → 200', async () => {
    mockGetAuthUser.mockResolvedValue({ sub: userA.id, email: 'a', role: 'CLIENT', name: 'A' })
    const res = await getSummary(authedReq('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalCount).toBeDefined()
    expect(json.byKind).toBeDefined()
  })

  test('🚨 PRIVACIDADE: userB sem perfil → totalCount=0', async () => {
    mockGetAuthUser.mockResolvedValue({ sub: userB.id, email: 'b', role: 'CLIENT', name: 'B' })
    const res = await getSummary(authedReq('GET'))
    const json = await res.json()
    expect(json.totalCount).toBe(0)
    expect(json.byKind).toEqual({})
  })
})
