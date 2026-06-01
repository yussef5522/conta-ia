// Sprint Gestão de Conta — Endpoints admin (RBAC + auth + audit).
// Testa via fetch direto pros handlers (mocking apenas getAdminSession).

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// ⚠️ Mock getAdminSession + loadGerenciador via vi.mock
const mockSession = vi.fn()
const mockLoadGerenciador = vi.fn()
vi.mock('@/lib/admin-auth/session', () => ({
  getAdminSession: () => mockSession(),
  loadGerenciador: (id: string) => mockLoadGerenciador(id),
}))

// Importação tardia pra pegar os mocks
const { POST: postResetPassword } = await import(
  '@/app/api/admin/clientes/[userId]/reset-password/route'
)
const { PATCH: patchEmail } = await import(
  '@/app/api/admin/clientes/[userId]/email/route'
)
const { DELETE: deleteUser, GET: getDetail } = await import(
  '@/app/api/admin/clientes/[userId]/route'
)

const TEST_PREFIX = `admin-ep-${Date.now()}`
const createdUserIds: string[] = []
const createdGerenciadorIds: string[] = []

async function createCliente(email: string) {
  const user = await prisma.user.create({
    data: {
      name: 'Cliente Test',
      email,
      password: await bcrypt.hash('SenhaCliente123!', 10),
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function createGerenciador(role: 'OPERADOR' | 'OWNER', password: string) {
  const g = await prisma.gerenciador.create({
    data: {
      email: `${TEST_PREFIX}-${role}-${Math.random()}@test.dev`,
      name: `G ${role}`,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      active: true,
    },
  })
  createdGerenciadorIds.push(g.id)
  return g
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await prisma.gerenciadorAuditLog
    .deleteMany({ where: { gerenciadorId: { in: createdGerenciadorIds } } })
    .catch(() => {})
  await prisma.gerenciador
    .deleteMany({ where: { id: { in: createdGerenciadorIds } } })
    .catch(() => {})
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/admin/clientes/[userId]/reset-password', () => {
  test('OPERADOR pode resetar (não exige OWNER)', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const cliente = await createCliente(`${TEST_PREFIX}-r1@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await postResetPassword(
      makeRequest({ gerenciadorPassword: 'GerSenha123!' }),
      { params: Promise.resolve({ userId: cliente.id }) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.tempPassword).toBeDefined()
    expect(data.tempPassword.length).toBe(16)

    // mustChangePassword foi setado
    const updated = await prisma.user.findUnique({
      where: { id: cliente.id },
      select: { mustChangePassword: true },
    })
    expect(updated?.mustChangePassword).toBe(true)
  })

  test('senha re-auth errada retorna 401', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const cliente = await createCliente(`${TEST_PREFIX}-r2@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await postResetPassword(
      makeRequest({ gerenciadorPassword: 'errada' }),
      { params: Promise.resolve({ userId: cliente.id }) },
    )
    expect(res.status).toBe(401)
  })

  test('grava audit ADMIN_RESET_USER_PASSWORD', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const cliente = await createCliente(`${TEST_PREFIX}-r3@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    await postResetPassword(
      makeRequest({ gerenciadorPassword: 'GerSenha123!' }),
      { params: Promise.resolve({ userId: cliente.id }) },
    )

    const audit = await prisma.gerenciadorAuditLog.findFirst({
      where: { action: 'ADMIN_RESET_USER_PASSWORD', entityId: cliente.id },
    })
    expect(audit).not.toBeNull()
    expect(audit?.gerenciadorId).toBe(g.id)
  })

  test('sem session → 401', async () => {
    mockSession.mockResolvedValue(null)
    const res = await postResetPassword(
      makeRequest({ gerenciadorPassword: 'x' }),
      { params: Promise.resolve({ userId: 'qualquer' }) },
    )
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/admin/clientes/[userId]/email', () => {
  test('OPERADOR troca email com sucesso', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const cliente = await createCliente(`${TEST_PREFIX}-e1@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const novoEmail = `${TEST_PREFIX}-e1-novo@test.dev`
    const res = await patchEmail(
      new NextRequest('http://localhost/test', {
        method: 'PATCH',
        body: JSON.stringify({
          gerenciadorPassword: 'GerSenha123!',
          newEmail: novoEmail,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: cliente.id }) },
    )
    expect(res.status).toBe(200)
    const updated = await prisma.user.findUnique({ where: { id: cliente.id } })
    expect(updated?.email).toBe(novoEmail)
  })

  test('rejeita email duplicado (409)', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const c1 = await createCliente(`${TEST_PREFIX}-dup1@test.dev`)
    const c2 = await createCliente(`${TEST_PREFIX}-dup2@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    // Tenta trocar email do c2 pro mesmo do c1
    const res = await patchEmail(
      new NextRequest('http://localhost/test', {
        method: 'PATCH',
        body: JSON.stringify({
          gerenciadorPassword: 'GerSenha123!',
          newEmail: c1.email,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c2.id }) },
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe('EMAIL_ALREADY_EXISTS')
  })

  test('rejeita email com formato inválido', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-fmt@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await patchEmail(
      new NextRequest('http://localhost/test', {
        method: 'PATCH',
        body: JSON.stringify({
          gerenciadorPassword: 'GerSenha123!',
          newEmail: 'sem-arroba',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c.id }) },
    )
    expect(res.status).toBe(400)
  })

  test('grava audit ADMIN_CHANGE_USER_EMAIL com snapshot', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-aud@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    await patchEmail(
      new NextRequest('http://localhost/test', {
        method: 'PATCH',
        body: JSON.stringify({
          gerenciadorPassword: 'GerSenha123!',
          newEmail: `${TEST_PREFIX}-aud-novo@test.dev`,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c.id }) },
    )

    const audit = await prisma.gerenciadorAuditLog.findFirst({
      where: { action: 'ADMIN_CHANGE_USER_EMAIL', entityId: c.id },
    })
    expect(audit).not.toBeNull()
    const metadata = JSON.parse(audit?.metadata ?? '{}')
    expect(metadata.oldEmail).toBe(c.email)
    expect(metadata.newEmail).toContain('novo@test.dev')
  })
})

describe('DELETE /api/admin/clientes/[userId] — RBAC OWNER only', () => {
  test('OPERADOR é bloqueado com 403', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-op@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await deleteUser(
      new NextRequest('http://localhost/test', {
        method: 'DELETE',
        body: JSON.stringify({
          gerenciadorPassword: 'GerSenha123!',
          confirmEmail: c.email,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c.id }) },
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('FORBIDDEN_RBAC')

    // Cliente preservado
    const still = await prisma.user.findUnique({ where: { id: c.id } })
    expect(still).not.toBeNull()
  })

  test('OWNER apaga cliente com confirmação de email correta', async () => {
    const g = await createGerenciador('OWNER', 'OwnerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-del-ok@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await deleteUser(
      new NextRequest('http://localhost/test', {
        method: 'DELETE',
        body: JSON.stringify({
          gerenciadorPassword: 'OwnerSenha123!',
          confirmEmail: c.email,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c.id }) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.result.userEmail).toBe(c.email)

    // Sumiu de verdade
    const still = await prisma.user.findUnique({ where: { id: c.id } })
    expect(still).toBeNull()
  })

  test('OWNER com confirmEmail errado → 400 EMAIL_CONFIRMATION_MISMATCH', async () => {
    const g = await createGerenciador('OWNER', 'OwnerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-conf-bad@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await deleteUser(
      new NextRequest('http://localhost/test', {
        method: 'DELETE',
        body: JSON.stringify({
          gerenciadorPassword: 'OwnerSenha123!',
          confirmEmail: 'outro@email.com',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c.id }) },
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.code).toBe('EMAIL_CONFIRMATION_MISMATCH')

    // Cliente preservado
    const still = await prisma.user.findUnique({ where: { id: c.id } })
    expect(still).not.toBeNull()
  })

  test('OWNER com senha errada → 401 sem deletar', async () => {
    const g = await createGerenciador('OWNER', 'OwnerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-senha-bad@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await deleteUser(
      new NextRequest('http://localhost/test', {
        method: 'DELETE',
        body: JSON.stringify({
          gerenciadorPassword: 'errada',
          confirmEmail: c.email,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c.id }) },
    )
    expect(res.status).toBe(401)

    const still = await prisma.user.findUnique({ where: { id: c.id } })
    expect(still).not.toBeNull()
  })

  test('OWNER apaga + grava audit ADMIN_DELETE_USER com snapshot completo', async () => {
    const g = await createGerenciador('OWNER', 'OwnerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-aud-del@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    await deleteUser(
      new NextRequest('http://localhost/test', {
        method: 'DELETE',
        body: JSON.stringify({
          gerenciadorPassword: 'OwnerSenha123!',
          confirmEmail: c.email,
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ userId: c.id }) },
    )

    const audit = await prisma.gerenciadorAuditLog.findFirst({
      where: { action: 'ADMIN_DELETE_USER', entityId: c.id },
    })
    expect(audit).not.toBeNull()
    const metadata = JSON.parse(audit?.metadata ?? '{}')
    expect(metadata.userEmail).toBe(c.email)
    expect(Array.isArray(metadata.companiesDeleted)).toBe(true)
    expect(Array.isArray(metadata.companiesKept)).toBe(true)
  })
})

describe('GET /api/admin/clientes/[userId] — detalhe', () => {
  test('retorna counts agregados', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    const c = await createCliente(`${TEST_PREFIX}-det@test.dev`)

    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await getDetail(
      new NextRequest('http://localhost/test'),
      { params: Promise.resolve({ userId: c.id }) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.email).toBe(c.email)
    expect(data.counts).toBeDefined()
    expect(typeof data.counts.empresas).toBe('number')
  })

  test('404 se cliente não existe', async () => {
    const g = await createGerenciador('OPERADOR', 'GerSenha123!')
    mockSession.mockResolvedValue({ gerenciadorId: g.id })
    mockLoadGerenciador.mockResolvedValue({ ...g, active: true })

    const res = await getDetail(
      new NextRequest('http://localhost/test'),
      { params: Promise.resolve({ userId: 'inexistente-xyz' }) },
    )
    expect(res.status).toBe(404)
  })
})
