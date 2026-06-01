// Sprint Gestão de Conta — Autoatendimento (Parte B) e Force Change (Parte C).

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    getAuthUser: (req: NextRequest) => mockGetAuthUser(req),
  }
})

const { PATCH: patchPerfil } = await import('@/app/api/auth/me/perfil/route')
const { POST: postChangePassword } = await import(
  '@/app/api/auth/me/change-password/route'
)
const { DELETE: deleteMe, GET: getMe } = await import(
  '@/app/api/auth/me/route'
)

const TEST_PREFIX = `selfsvc-${Date.now()}-${process.pid}`
const createdUserIds: string[] = []

async function createUser(opts: {
  email: string
  password: string
  mustChange?: boolean
}) {
  const u = await prisma.user.create({
    data: {
      name: 'Self Test',
      email: opts.email,
      password: await bcrypt.hash(opts.password, 10),
      mustChangePassword: opts.mustChange ?? false,
    },
  })
  createdUserIds.push(u.id)
  return u
}

function makeReq(method: string, body?: unknown) {
  return new NextRequest('http://localhost/t', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: TEST_PREFIX } } })
    .catch(() => {})
})

/* ===== PARTE B — perfil ===== */

describe('PATCH /api/auth/me/perfil', () => {
  test('cliente edita o próprio nome', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-pn1@t.dev`,
      password: 'Senha123!',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    })

    const res = await patchPerfil(makeReq('PATCH', { name: 'Novo Nome' }))
    expect(res.status).toBe(200)

    const after = await prisma.user.findUnique({ where: { id: u.id } })
    expect(after?.name).toBe('Novo Nome')
  })

  test('rejeita nome muito curto', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-pn2@t.dev`,
      password: 'Senha123!',
    })
    mockGetAuthUser.mockResolvedValue({
      sub: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    })

    const res = await patchPerfil(makeReq('PATCH', { name: 'X' }))
    expect(res.status).toBe(400)
  })

  test('sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await patchPerfil(makeReq('PATCH', { name: 'Tentando' }))
    expect(res.status).toBe(401)
  })

  test('multi-tenant: PATCH NÃO aceita userId no body — só edita o session.sub', async () => {
    // Mesmo se o body trouxesse "userId: outro", o endpoint usa sub do JWT.
    // Validamos que apenas o user da sessão muda.
    const userA = await createUser({
      email: `${TEST_PREFIX}-A@t.dev`,
      password: 'Senha123!',
    })
    const userB = await createUser({
      email: `${TEST_PREFIX}-B@t.dev`,
      password: 'Senha123!',
    })

    mockGetAuthUser.mockResolvedValue({
      sub: userA.id,
      email: userA.email,
      name: userA.name,
      role: userA.role,
    })

    // Tenta "smuggle" userId no body — schema só lê name, ignora resto
    await patchPerfil(
      makeReq('PATCH', { name: 'Hacker A→B', userId: userB.id } as object),
    )

    const aAfter = await prisma.user.findUnique({ where: { id: userA.id } })
    const bAfter = await prisma.user.findUnique({ where: { id: userB.id } })
    expect(aAfter?.name).toBe('Hacker A→B')
    expect(bAfter?.name).toBe('Self Test') // ← inalterado
  })
})

/* ===== PARTE B — change password ===== */

describe('POST /api/auth/me/change-password (autoatendimento)', () => {
  test('troca senha com senha atual correta', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-cp1@t.dev`,
      password: 'Atual123!',
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    const res = await postChangePassword(
      makeReq('POST', {
        currentPassword: 'Atual123!',
        novaSenha: 'NovaSenhaForte9!',
      }),
    )
    expect(res.status).toBe(200)

    const after = await prisma.user.findUnique({ where: { id: u.id } })
    const stillOld = await bcrypt.compare('Atual123!', after?.password ?? '')
    const newWorks = await bcrypt.compare('NovaSenhaForte9!', after?.password ?? '')
    expect(stillOld).toBe(false)
    expect(newWorks).toBe(true)
  })

  test('rejeita senha atual errada (401)', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-cp2@t.dev`,
      password: 'Atual123!',
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    const res = await postChangePassword(
      makeReq('POST', {
        currentPassword: 'errada',
        novaSenha: 'NovaSenhaForte9!',
      }),
    )
    expect(res.status).toBe(401)
  })

  test('rejeita nova senha fraca (< 8 chars)', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-cp3@t.dev`,
      password: 'Atual123!',
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    const res = await postChangePassword(
      makeReq('POST', { currentPassword: 'Atual123!', novaSenha: 'abc' }),
    )
    expect(res.status).toBe(400)
  })

  test('autoatendimento exige currentPassword', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-cp4@t.dev`,
      password: 'Atual123!',
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    // Sem currentPassword, em fluxo autoatendimento
    const res = await postChangePassword(
      makeReq('POST', { novaSenha: 'NovaSenhaForte9!' }),
    )
    expect(res.status).toBe(400)
  })
})

/* ===== PARTE C — force change (mustChangePassword=true) ===== */

describe('Force-change senha (mustChangePassword=true)', () => {
  test('PULA currentPassword quando mustChangePassword=true', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-fc1@t.dev`,
      password: 'TempGeradoAdmin1!',
      mustChange: true,
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    // Sem currentPassword — autorizado porque login já validou
    const res = await postChangePassword(
      makeReq('POST', { novaSenha: 'MinhaNovaSenha9!' }),
    )
    expect(res.status).toBe(200)
  })

  test('após trocar, mustChangePassword vira false', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-fc2@t.dev`,
      password: 'TempGeradoAdmin1!',
      mustChange: true,
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    await postChangePassword(makeReq('POST', { novaSenha: 'NovaForte9!' }))

    const after = await prisma.user.findUnique({ where: { id: u.id } })
    expect(after?.mustChangePassword).toBe(false)
  })

  test('change-password regenera cookie auth_token (sem flag)', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-fc3@t.dev`,
      password: 'TempAdmin1!',
      mustChange: true,
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    const res = await postChangePassword(
      makeReq('POST', { novaSenha: 'NovaSenha9!' }),
    )
    expect(res.status).toBe(200)
    // Cookie auth_token foi setado no response
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('auth_token=')
  })
})

/* ===== PARTE B — DELETE me ===== */

describe('DELETE /api/auth/me (excluir própria conta)', () => {
  test('exige currentPassword + confirmText=EXCLUIR', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-d1@t.dev`,
      password: 'MinhaSenha1!',
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    // Sem confirmText certo
    const res1 = await deleteMe(
      makeReq('DELETE', {
        currentPassword: 'MinhaSenha1!',
        confirmText: 'apagar',
      }),
    )
    expect(res1.status).toBe(400)

    // Cliente preservado
    const still = await prisma.user.findUnique({ where: { id: u.id } })
    expect(still).not.toBeNull()
  })

  test('rejeita senha atual errada', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-d2@t.dev`,
      password: 'MinhaSenha1!',
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    const res = await deleteMe(
      makeReq('DELETE', {
        currentPassword: 'errada',
        confirmText: 'EXCLUIR',
      }),
    )
    expect(res.status).toBe(401)

    const still = await prisma.user.findUnique({ where: { id: u.id } })
    expect(still).not.toBeNull()
  })

  test('sucesso: senha correta + EXCLUIR → user apagado + cookie limpo', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-d3@t.dev`,
      password: 'OK123Senha!',
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    const res = await deleteMe(
      makeReq('DELETE', {
        currentPassword: 'OK123Senha!',
        confirmText: 'EXCLUIR',
      }),
    )
    expect(res.status).toBe(200)

    const still = await prisma.user.findUnique({ where: { id: u.id } })
    expect(still).toBeNull()

    // Cookie de auth limpo
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('auth_token=')
    expect(setCookie).toMatch(/auth_token=;|Max-Age=0/i)
  })

  test('multi-tenant: NUNCA aceita userId no body — só apaga session.sub', async () => {
    const userA = await createUser({
      email: `${TEST_PREFIX}-mt-A@t.dev`,
      password: 'SenhaA1!',
    })
    const userB = await createUser({
      email: `${TEST_PREFIX}-mt-B@t.dev`,
      password: 'SenhaB1!',
    })

    // Logado como A, tenta apagar B via body
    mockGetAuthUser.mockResolvedValue({ sub: userA.id, email: userA.email, name: userA.name, role: userA.role })

    await deleteMe(
      makeReq('DELETE', {
        currentPassword: 'SenhaA1!',
        confirmText: 'EXCLUIR',
        userId: userB.id, // ← smuggle
      } as object),
    )

    // A foi apagado, B SOBREVIVE
    const aAfter = await prisma.user.findUnique({ where: { id: userA.id } })
    const bAfter = await prisma.user.findUnique({ where: { id: userB.id } })
    expect(aAfter).toBeNull()
    expect(bAfter).not.toBeNull()
  })
})

/* ===== GET /api/auth/me ===== */

describe('GET /api/auth/me retorna mustChangePassword', () => {
  test('inclui flag mustChangePassword no payload', async () => {
    const u = await createUser({
      email: `${TEST_PREFIX}-getme@t.dev`,
      password: 'X9Senha!',
      mustChange: true,
    })
    mockGetAuthUser.mockResolvedValue({ sub: u.id, email: u.email, name: u.name, role: u.role })

    const res = await getMe(makeReq('GET'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.usuario.mustChangePassword).toBe(true)
    expect(data.usuario.email).toBe(u.email)
  })
})
