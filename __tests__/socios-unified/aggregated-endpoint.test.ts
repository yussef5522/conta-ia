// Sprint Unificar Sócios — Testes do endpoint /socios/[socioId]/aggregated.
// Cobre privacidade: cada user vê SÓ as próprias pontes ligadas ao sócio.

import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'
import { createBridge } from '@/lib/bridges/create'
import { ForbiddenError, AuthenticationError } from '@/lib/auth/rbac'

const PREFIX = `socios-agg-${Date.now()}-${process.pid}`

const mockGetAuthContext = vi.fn()
vi.mock('@/lib/auth/rbac', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/rbac')>()
  return {
    ...actual,
    getAuthContext: (req: NextRequest, companyId?: string) =>
      mockGetAuthContext(req, companyId),
  }
})

// unstable_cache não funciona fora do runtime Next — mock no-op
vi.mock('next/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/cache')>()
  return {
    ...actual,
    unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  }
})

const { GET: getAggregated } = await import(
  '@/app/api/empresas/[id]/socios/[socioId]/aggregated/route'
)

let userA: { id: string }
let userB: { id: string }
let companyId: string
let bankAccountId: string
let socioA: { id: string; nome: string }
let socioOrphan: { id: string; nome: string } // sem CPF (sem ponte)
let profileA: { id: string }
let pfAccount: { id: string }
let pfCategory: { id: string }
let bridgeIds: string[] = []
let pfTxIds: string[] = []
let pjTxIds: string[] = []

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
      name: `${PREFIX}-co`,
      cnpj: `99${Date.now().toString().slice(-12)}`,
      type: 'service',
      users: {
        create: [
          { userId: userA.id, role: 'OWNER' },
          { userId: userB.id, role: 'OWNER' },
        ],
      },
    },
  })
  companyId = c.id
  const ba = await prisma.bankAccount.create({
    data: { companyId, name: 'Banrisul', accountType: 'CHECKING' },
  })
  bankAccountId = ba.id

  socioA = await prisma.socioPF.create({
    data: { companyId, nome: 'Yussef SocioA', cpf: '60025889060', papel: 'SOCIO' },
  })
  socioOrphan = await prisma.socioPF.create({
    data: { companyId, nome: 'Outra Pessoa', cpf: '11122233344', papel: 'FAMILIAR' },
  })

  profileA = await createProfile({
    userId: userA.id, name: 'A PF', cpf: '60025889060',
  })
  const acc = await createAccount({
    userId: userA.id, profileId: profileA.id,
    name: 'Nubank A', accountType: 'CHECKING',
  })
  pfAccount = { id: acc.id }
  const cats = await prisma.personalCategory.findMany({
    where: { profileId: profileA.id, type: 'INCOME' }, take: 1,
  })
  pfCategory = { id: cats[0]!.id }

  // Cria 2 bridges com socioA pra userA
  for (const amt of [10000, 5000]) {
    const pjTx = await prisma.transaction.create({
      data: {
        bankAccountId, date: new Date('2026-05-15'),
        description: 'Pix Yussef', amount: amt, type: 'DEBIT', lifecycle: 'EFFECTED',
        relatedPartyType: 'SOCIO_PF',
        relatedPartyId: socioA.id,
      },
    })
    pjTxIds.push(pjTx.id)
    const r = await createBridge({
      userId: userA.id, companyId, pjTransactionId: pjTx.id,
      profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
      kind: amt === 10000 ? 'DISTRIBUICAO' : 'PRO_LABORE',
      socioPFId: socioA.id,
    })
    bridgeIds.push(r.bridgeId)
    pfTxIds.push(r.pfTransactionId)
  }
})

afterAll(async () => {
  await prisma.pJtoPFBridge.deleteMany({ where: { companyId } })
  await prisma.personalTransaction.deleteMany({ where: { profileId: profileA.id } })
  await prisma.transaction.deleteMany({ where: { bankAccountId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.socioPF.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.personalCategory.deleteMany({ where: { profileId: profileA.id } })
  await prisma.personalBankAccount.deleteMany({ where: { profileId: profileA.id } })
  await prisma.userPersonalProfile.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await prisma.personalProfile.deleteMany({ where: { id: profileA.id } })
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
})

function asUserCtx(userId: string, permissions = ['transaction.view']) {
  mockGetAuthContext.mockResolvedValue({
    user: { id: userId, name: 'X', email: 'x' },
    company: { id: companyId },
    role: { id: 'r', name: 'R', isSystemDefault: false },
    permissions,
    hasPermission: (k: string) => permissions.includes(k),
    requirePermission: (k: string) => {
      if (!permissions.includes(k)) throw new ForbiddenError(`Permissão necessária: ${k}`)
    },
  })
}

const req = () => new NextRequest('http://localhost/api/test', { method: 'GET' })

describe('GET /socios/[socioId]/aggregated — privacidade', () => {
  test('Sem auth → 401', async () => {
    mockGetAuthContext.mockRejectedValueOnce(new AuthenticationError())
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    expect(res.status).toBe(401)
  })

  test('Sem RBAC transaction.view → 403', async () => {
    asUserCtx(userA.id, [])
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    expect(res.status).toBe(403)
  })

  test('userA (dono perfil + tem pontes) → totais corretos', async () => {
    asUserCtx(userA.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.socio.id).toBe(socioA.id)
    expect(j.agregados.totalCount).toBe(2)
    expect(j.agregados.totalAmount).toBe(15000)
    expect(j.agregados.byKind.DISTRIBUICAO?.amount).toBe(10000)
    expect(j.agregados.byKind.PRO_LABORE?.amount).toBe(5000)
    expect(j.suasPontes).toHaveLength(2)
  })

  test('🚨 PRIVACIDADE: userB (sem perfil) → totais zerados (vê só dados públicos)', async () => {
    asUserCtx(userB.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    // Dados do sócio (público) — userB pode ver
    expect(j.socio.id).toBe(socioA.id)
    expect(j.socio.nome).toBe(socioA.nome)
    // Pontes (privado) — userB NÃO vê as do userA
    expect(j.agregados.totalCount).toBe(0)
    expect(j.agregados.totalAmount).toBe(0)
    expect(j.suasPontes).toEqual([])
    expect(j.agregados.byKind).toEqual({})
  })

  test('🚨 Tx Pix detectadas SÃO públicas (mesma info que /transacoes)', async () => {
    asUserCtx(userB.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    const j = await res.json()
    // userB vê as 2 tx PJ que foram detectadas pra socioA (público)
    expect(j.txPixDetected).toHaveLength(2)
    // userB vê QUE existem bridges, mas NÃO o bridgeId nem detalhes
    expect(j.txPixDetected.every((t: { hasBridge: boolean }) => t.hasBridge === true)).toBe(true)
  })

  test('Sócio sem pontes → todos os agregados zerados', async () => {
    asUserCtx(userA.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioOrphan.id }),
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.socio.id).toBe(socioOrphan.id)
    expect(j.agregados.totalCount).toBe(0)
    expect(j.suasPontes).toEqual([])
    expect(j.txPixDetected).toEqual([])
  })

  test('SocioId inexistente → 404', async () => {
    asUserCtx(userA.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: 'cmfakeXXXXXXXXXX' }),
    })
    expect(res.status).toBe(404)
  })

  test('🚨 SocioId de outra empresa → 404', async () => {
    // Cria empresa C com sócio próprio
    const c2 = await prisma.company.create({
      data: {
        name: `${PREFIX}-other`, cnpj: `88${Date.now().toString().slice(-12)}`,
        type: 'service',
        users: { create: [{ userId: userA.id, role: 'OWNER' }] },
      },
    })
    const socioAlheio = await prisma.socioPF.create({
      data: { companyId: c2.id, nome: 'X', cpf: '00011122233', papel: 'SOCIO' },
    })
    asUserCtx(userA.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioAlheio.id }),
    })
    expect(res.status).toBe(404)
    await prisma.socioPF.delete({ where: { id: socioAlheio.id } })
    await prisma.company.delete({ where: { id: c2.id } })
  })
})

describe('Estrutura do payload', () => {
  test('Inclui socio.nome / cpf / papel / pixKeys / createdAt', async () => {
    asUserCtx(userA.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    const j = await res.json()
    expect(j.socio).toHaveProperty('nome')
    expect(j.socio).toHaveProperty('cpf')
    expect(j.socio).toHaveProperty('papel')
    expect(j.socio).toHaveProperty('pixKeys')
    expect(j.socio).toHaveProperty('createdAt')
  })

  test('Pontes incluem pjBankAccountName + pfBankAccountName + companyName', async () => {
    asUserCtx(userA.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    const j = await res.json()
    expect(j.suasPontes.length).toBeGreaterThan(0)
    const b = j.suasPontes[0]
    expect(b.pjBankAccountName).toBe('Banrisul')
    expect(b.pfBankAccountName).toBe('Nubank A')
    expect(b.companyName).toContain(PREFIX)
  })

  test('Tx Pix detectadas têm shape correto', async () => {
    asUserCtx(userA.id)
    const res = await getAggregated(req(), {
      params: Promise.resolve({ id: companyId, socioId: socioA.id }),
    })
    const j = await res.json()
    expect(j.txPixDetected.length).toBeGreaterThan(0)
    const t = j.txPixDetected[0]
    expect(t).toHaveProperty('id')
    expect(t).toHaveProperty('date')
    expect(t).toHaveProperty('description')
    expect(t).toHaveProperty('amount')
    expect(t).toHaveProperty('hasBridge')
  })
})
