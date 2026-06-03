// Sprint Dashboard PF — Testes integração endpoint /perfis/[id]/evolucao-mensal.

import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'

const PREFIX = `evo-mensal-${Date.now()}-${process.pid}`

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})

const { GET: getEvolucao } = await import(
  '@/app/api/perfis/[id]/evolucao-mensal/route'
)

let userA: { id: string }
let userB: { id: string }
let profileA: { id: string }
let accountA: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@x.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@x.local`, password: pwd },
  })

  profileA = await createProfile({
    userId: userA.id, name: 'A PF', cpf: '60025889060',
  })
  const acc = await createAccount({
    userId: userA.id, profileId: profileA.id,
    name: 'Nubank A', accountType: 'CHECKING', balance: 1000,
  })
  accountA = { id: acc.id }

  // Cria 3 tx em 3 meses
  await prisma.personalTransaction.createMany({
    data: [
      {
        profileId: profileA.id,
        bankAccountId: accountA.id,
        date: new Date('2026-05-15'),
        description: 'Salário',
        amount: 5000,
        type: 'CREDIT',
        status: 'RECONCILED',
        origin: 'MANUAL',
      },
      {
        profileId: profileA.id,
        bankAccountId: accountA.id,
        date: new Date('2026-05-20'),
        description: 'iFood',
        amount: 100,
        type: 'DEBIT',
        status: 'RECONCILED',
        origin: 'MANUAL',
      },
      {
        profileId: profileA.id,
        bankAccountId: accountA.id,
        date: new Date('2026-04-10'),
        description: 'Salário',
        amount: 4500,
        type: 'CREDIT',
        status: 'RECONCILED',
        origin: 'MANUAL',
      },
    ],
  })
})

afterAll(async () => {
  await prisma.personalTransaction.deleteMany({ where: { profileId: profileA.id } })
  await prisma.personalBankAccount.deleteMany({ where: { profileId: profileA.id } })
  await prisma.personalCategory.deleteMany({ where: { profileId: profileA.id } })
  await prisma.userPersonalProfile.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await prisma.personalProfile.deleteMany({ where: { id: profileA.id } })
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
})

const req = () => new NextRequest('http://localhost/api/test', { method: 'GET' })

describe('GET /perfis/[id]/evolucao-mensal', () => {
  test('Sem auth → 401', async () => {
    mockGetAuthUser.mockResolvedValueOnce(null)
    const res = await getEvolucao(req(), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(401)
  })

  test('🚨 PRIVACIDADE: userB com profileId de A → 404', async () => {
    mockGetAuthUser.mockResolvedValueOnce({
      sub: userB.id, email: 'b', role: 'CLIENT', name: 'B',
    })
    const res = await getEvolucao(req(), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(404)
  })

  test('Caminho feliz → 200 + 12 meses default', async () => {
    mockGetAuthUser.mockResolvedValueOnce({
      sub: userA.id, email: 'a', role: 'CLIENT', name: 'A',
    })
    const res = await getEvolucao(req(), {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.months).toHaveLength(12)
    expect(j.finalBalance).toBe(1000)
    expect(j.maxIncome).toBeGreaterThanOrEqual(5000)
    expect(j.maxExpense).toBeGreaterThanOrEqual(100)
  })

  test('Query ?months=6 retorna 6 pontos', async () => {
    mockGetAuthUser.mockResolvedValueOnce({
      sub: userA.id, email: 'a', role: 'CLIENT', name: 'A',
    })
    const r = new NextRequest('http://localhost/api/test?months=6', { method: 'GET' })
    const res = await getEvolucao(r, {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.months).toHaveLength(6)
  })

  test('months=99 → 400 (cap em 36)', async () => {
    mockGetAuthUser.mockResolvedValueOnce({
      sub: userA.id, email: 'a', role: 'CLIENT', name: 'A',
    })
    const r = new NextRequest('http://localhost/api/test?months=99', { method: 'GET' })
    const res = await getEvolucao(r, {
      params: Promise.resolve({ id: profileA.id }),
    })
    expect(res.status).toBe(400)
  })

  test('Resposta tem month, label, income, expense, net, cumulativeBalance', async () => {
    mockGetAuthUser.mockResolvedValueOnce({
      sub: userA.id, email: 'a', role: 'CLIENT', name: 'A',
    })
    const res = await getEvolucao(req(), {
      params: Promise.resolve({ id: profileA.id }),
    })
    const j = await res.json()
    const p = j.months[0]
    expect(p).toHaveProperty('month')
    expect(p).toHaveProperty('label')
    expect(p).toHaveProperty('income')
    expect(p).toHaveProperty('expense')
    expect(p).toHaveProperty('net')
    expect(p).toHaveProperty('cumulativeBalance')
  })
})
