// Sprint PF Fatia 4 — Testes queries (list, detail, summary, checkPjTxBridge).

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  listBridges,
  getBridgeDetail,
  getBridgeSummary,
  checkPjTxBridgeForUser,
  getUserOwnedProfileIds,
} from '@/lib/bridges/queries'
import { createBridge } from '@/lib/bridges/create'
import { BridgeError } from '@/lib/bridges/types'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'

const PREFIX = `bridge-q-${Date.now()}-${process.pid}`

let userA: { id: string }
let userB: { id: string }
let userC: { id: string }
let companyId: string
let bankAccountId: string
let profileA: { id: string }
let profileB: { id: string }
let pfAccountA: { id: string }
let pfAccountB: { id: string }
let pfCategoryA: { id: string }
let pfCategoryB: { id: string }
const bridgeIdsCreated: string[] = []
const pfTxIdsCreated: string[] = []
const pjTxIdsCreated: string[] = []

async function createBridgeFor(
  userId: string,
  profileId: string,
  pfAccountId: string,
  pfCategoryId: string,
  kind: 'PRO_LABORE' | 'DISTRIBUICAO' | 'REEMBOLSO' = 'DISTRIBUICAO',
  amount = 1000,
) {
  const pjTx = await prisma.transaction.create({
    data: {
      bankAccountId, date: new Date(),
      description: 'Pix x', amount, type: 'DEBIT', lifecycle: 'EFFECTED',
    },
  })
  const r = await createBridge({
    userId, companyId, pjTransactionId: pjTx.id,
    profileId, pfBankAccountId: pfAccountId, pfCategoryId, kind,
  })
  bridgeIdsCreated.push(r.bridgeId)
  pfTxIdsCreated.push(r.pfTransactionId)
  pjTxIdsCreated.push(pjTx.id)
  return r
}

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@x.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@x.local`, password: pwd },
  })
  userC = await prisma.user.create({
    data: { name: 'C', email: `${PREFIX}-c@x.local`, password: pwd },
  })

  const c = await prisma.company.create({
    data: {
      name: `${PREFIX}-co`, cnpj: `04${Date.now().toString().slice(-12)}`,
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

  profileA = await createProfile({
    userId: userA.id, name: 'A PF', cpf: '60025889060',
  })
  profileB = await createProfile({
    userId: userB.id, name: 'B PF', cpf: '11122233344',
  })

  const accA = await createAccount({
    userId: userA.id, profileId: profileA.id,
    name: 'Nubank A', accountType: 'CHECKING',
  })
  const accB = await createAccount({
    userId: userB.id, profileId: profileB.id,
    name: 'Nubank B', accountType: 'CHECKING',
  })
  pfAccountA = { id: accA.id }
  pfAccountB = { id: accB.id }

  const catsA = await prisma.personalCategory.findMany({
    where: { profileId: profileA.id, type: 'INCOME' }, take: 1,
  })
  const catsB = await prisma.personalCategory.findMany({
    where: { profileId: profileB.id, type: 'INCOME' }, take: 1,
  })
  pfCategoryA = { id: catsA[0]!.id }
  pfCategoryB = { id: catsB[0]!.id }
})

afterAll(async () => {
  await prisma.pJtoPFBridge.deleteMany({ where: { companyId } })
  await prisma.personalTransaction.deleteMany({
    where: { profileId: { in: [profileA.id, profileB.id] } },
  })
  await prisma.transaction.deleteMany({ where: { bankAccountId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.personalCategory.deleteMany({
    where: { profileId: { in: [profileA.id, profileB.id] } },
  })
  await prisma.personalBankAccount.deleteMany({
    where: { profileId: { in: [profileA.id, profileB.id] } },
  })
  await prisma.userPersonalProfile.deleteMany({
    where: { userId: { in: [userA.id, userB.id, userC.id] } },
  })
  await prisma.personalProfile.deleteMany({
    where: { id: { in: [profileA.id, profileB.id] } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: [userA.id, userB.id, userC.id] } },
  })
})

describe('getUserOwnedProfileIds', () => {
  test('Retorna só perfis OWNER do user', async () => {
    const idsA = await getUserOwnedProfileIds(userA.id)
    expect(idsA).toContain(profileA.id)
    expect(idsA).not.toContain(profileB.id)
    const idsC = await getUserOwnedProfileIds(userC.id)
    expect(idsC).toEqual([])
  })
})

describe('listBridges — PRIVACIDADE MULTI-SÓCIO', () => {
  test('🚨 userB lista pontes da MESMA empresa → vê SUAS pontes (zero das de A)', async () => {
    await createBridgeFor(userA.id, profileA.id, pfAccountA.id, pfCategoryA.id, 'DISTRIBUICAO', 100)
    await createBridgeFor(userA.id, profileA.id, pfAccountA.id, pfCategoryA.id, 'PRO_LABORE', 200)
    await createBridgeFor(userB.id, profileB.id, pfAccountB.id, pfCategoryB.id, 'DISTRIBUICAO', 300)

    const listA = await listBridges({ userId: userA.id, companyId })
    expect(listA.bridges.every((b) => b.profileId === profileA.id)).toBe(true)

    const listB = await listBridges({ userId: userB.id, companyId })
    expect(listB.bridges.every((b) => b.profileId === profileB.id)).toBe(true)
    expect(listB.bridges.some((b) => b.profileId === profileA.id)).toBe(false)
  })

  test('🚨 userC (sem perfil) → lista vazia', async () => {
    const list = await listBridges({ userId: userC.id, companyId })
    expect(list.bridges).toEqual([])
    expect(list.total).toBe(0)
  })

  test('🚨 userB com profileId=profileA → lista vazia (filtro implícito)', async () => {
    const list = await listBridges({
      userId: userB.id, companyId, profileId: profileA.id,
    })
    expect(list.bridges).toEqual([])
  })
})

describe('listBridges — filtros', () => {
  test('Filtra por kind', async () => {
    const list = await listBridges({
      userId: userA.id, companyId, kind: 'PRO_LABORE',
    })
    expect(list.bridges.every((b) => b.kind === 'PRO_LABORE')).toBe(true)
  })

  test('Inclui companyName + nomes das contas + socioPFName', async () => {
    const list = await listBridges({ userId: userA.id, companyId })
    if (list.bridges.length > 0) {
      const first = list.bridges[0]
      expect(first.companyName).toContain(PREFIX)
      expect(first.pjBankAccountName).toBeTruthy()
      expect(first.pfBankAccountName).toBeTruthy()
    }
  })
})

describe('getBridgeDetail — PRIVACIDADE', () => {
  test('🚨 Dono do perfil (userA) → 200 com dados', async () => {
    const { bridgeId } = await createBridgeFor(userA.id, profileA.id, pfAccountA.id, pfCategoryA.id)
    const detail = await getBridgeDetail(userA.id, bridgeId)
    expect(detail.bridge.id).toBe(bridgeId)
    expect(detail.pjTransaction).toBeTruthy()
    expect(detail.pfTransaction).toBeTruthy()
  })

  test('🚨 Sócio B com bridge de A → 404 BRIDGE_NOT_FOUND', async () => {
    const list = await listBridges({ userId: userA.id, companyId })
    const aBridge = list.bridges[0]
    try {
      await getBridgeDetail(userB.id, aBridge.id)
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('BRIDGE_NOT_FOUND')
    }
  })

  test('🚨 User C (zero perfis) → 404', async () => {
    const list = await listBridges({ userId: userA.id, companyId })
    const aBridge = list.bridges[0]
    try {
      await getBridgeDetail(userC.id, aBridge.id)
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('BRIDGE_NOT_FOUND')
    }
  })

  test('Bridge inexistente → 404 (não revela)', async () => {
    try {
      await getBridgeDetail(userA.id, 'cmfakeXXXXXXXXXXXXX')
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('BRIDGE_NOT_FOUND')
    }
  })
})

describe('checkPjTxBridgeForUser — badge anônimo pra terceiros', () => {
  test('Dono do perfil vê belongsToMe=true + bridgeId', async () => {
    const r = await createBridgeFor(userA.id, profileA.id, pfAccountA.id, pfCategoryA.id)
    // pegar pjTxId do último pj criado
    const pjId = pjTxIdsCreated[pjTxIdsCreated.length - 1]
    const check = await checkPjTxBridgeForUser(userA.id, pjId)
    expect(check.hasBridge).toBe(true)
    expect(check.belongsToMe).toBe(true)
    expect(check.bridgeId).toBe(r.bridgeId)
  })

  test('🚨 Sócio terceiro vê belongsToMe=false + bridgeId=null', async () => {
    const pjId = pjTxIdsCreated[pjTxIdsCreated.length - 1]
    const check = await checkPjTxBridgeForUser(userB.id, pjId)
    expect(check.hasBridge).toBe(true)
    expect(check.belongsToMe).toBe(false)
    expect(check.bridgeId).toBeNull() // anonimizado!
  })

  test('Sem bridge → hasBridge=false', async () => {
    const pj = await prisma.transaction.create({
      data: {
        bankAccountId, date: new Date(),
        description: 'X', amount: 100, type: 'DEBIT', lifecycle: 'EFFECTED',
      },
    })
    const check = await checkPjTxBridgeForUser(userA.id, pj.id)
    expect(check.hasBridge).toBe(false)
    expect(check.bridgeId).toBeNull()
    expect(check.belongsToMe).toBe(false)
    await prisma.transaction.delete({ where: { id: pj.id } })
  })
})

describe('getBridgeSummary', () => {
  test('Agrega por kind + privado por user', async () => {
    const sumA = await getBridgeSummary({ userId: userA.id, companyId })
    expect(sumA.totalCount).toBeGreaterThan(0)
    // userB tem pelo menos 1 ponte (a primeira do create), summary do B isolado
    const sumB = await getBridgeSummary({ userId: userB.id, companyId })
    // somas separadas — totalAmount do A nunca inclui valores do B
    expect(sumA.byKind['DISTRIBUICAO']?.amount).not.toBe(sumB.byKind['DISTRIBUICAO']?.amount)
  })

  test('Sem perfis → totais zero', async () => {
    const sum = await getBridgeSummary({ userId: userC.id, companyId })
    expect(sum.totalCount).toBe(0)
    expect(sum.totalAmount).toBe(0)
    expect(sum.byKind).toEqual({})
  })
})
