// Sprint PF Fatia 4 — Testes deleteBridge (2 modos + auth).

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { deleteBridge } from '@/lib/bridges/delete'
import { createBridge } from '@/lib/bridges/create'
import { BridgeError } from '@/lib/bridges/types'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'

const PREFIX = `bridge-delete-${Date.now()}-${process.pid}`

let userA: { id: string }
let userB: { id: string }
let companyId: string
let bankAccountId: string
let profileA: { id: string }
let pfAccount: { id: string }
let pfCategory: { id: string }

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
      name: `${PREFIX}-co`, cnpj: `03${Date.now().toString().slice(-12)}`,
      type: 'service',
      users: { create: [{ userId: userA.id, role: 'OWNER' }, { userId: userB.id, role: 'OWNER' }] },
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
    where: { profileId: profileA.id, type: 'INCOME' },
    take: 1,
  })
  pfCategory = { id: cats[0]!.id }
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

async function createOneBridge() {
  const pjTx = await prisma.transaction.create({
    data: {
      bankAccountId, date: new Date('2026-05-28'),
      description: 'Pix Yussef', amount: 5000, type: 'DEBIT', lifecycle: 'EFFECTED',
    },
  })
  const res = await createBridge({
    userId: userA.id, companyId, pjTransactionId: pjTx.id,
    profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
    kind: 'DISTRIBUICAO',
  })
  return { ...res, pjTxId: pjTx.id }
}

describe('deleteBridge — LINK_ONLY', () => {
  test('Deleta bridge mantém as 2 tx', async () => {
    const { bridgeId, pfTransactionId, pjTxId } = await createOneBridge()

    const result = await deleteBridge({
      userId: userA.id, bridgeId, mode: 'LINK_ONLY',
    })
    expect(result.bridgeId).toBe(bridgeId)
    expect(result.pfTransactionDeleted).toBe(false)

    const bridge = await prisma.pJtoPFBridge.findUnique({ where: { id: bridgeId } })
    expect(bridge).toBeNull()
    const pjTx = await prisma.transaction.findUnique({ where: { id: pjTxId } })
    expect(pjTx).not.toBeNull()
    const pfTx = await prisma.personalTransaction.findUnique({ where: { id: pfTransactionId } })
    expect(pfTx).not.toBeNull()

    const audit = await prisma.auditLog.findMany({
      where: { entityType: 'PJtoPFBridge', entityId: bridgeId },
    })
    expect(audit.some((a) => a.action === 'BRIDGE_DELETED_LINK_ONLY')).toBe(true)

    // cleanup
    await prisma.personalTransaction.delete({ where: { id: pfTransactionId } })
    await prisma.transaction.delete({ where: { id: pjTxId } })
  })
})

describe('deleteBridge — WITH_PF_TX', () => {
  test('Deleta bridge + tx PF mantém só PJ', async () => {
    const { bridgeId, pfTransactionId, pjTxId } = await createOneBridge()

    const result = await deleteBridge({
      userId: userA.id, bridgeId, mode: 'WITH_PF_TX',
    })
    expect(result.pfTransactionDeleted).toBe(true)

    const bridge = await prisma.pJtoPFBridge.findUnique({ where: { id: bridgeId } })
    expect(bridge).toBeNull()
    const pjTx = await prisma.transaction.findUnique({ where: { id: pjTxId } })
    expect(pjTx).not.toBeNull()
    const pfTx = await prisma.personalTransaction.findUnique({ where: { id: pfTransactionId } })
    expect(pfTx).toBeNull()

    const audit = await prisma.auditLog.findMany({
      where: { entityType: 'PJtoPFBridge', entityId: bridgeId },
    })
    expect(audit.some((a) => a.action === 'BRIDGE_DELETED_WITH_PF_TX')).toBe(true)

    await prisma.transaction.delete({ where: { id: pjTxId } })
  })
})

describe('deleteBridge — autorização', () => {
  test('🚨 PRIVACIDADE: userB (sócio mesma empresa) tenta deletar bridge do A → BRIDGE_NOT_FOUND', async () => {
    const { bridgeId, pfTransactionId, pjTxId } = await createOneBridge()
    try {
      await deleteBridge({ userId: userB.id, bridgeId, mode: 'LINK_ONLY' })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('BRIDGE_NOT_FOUND')
    }
    // bridge ainda existe
    const b = await prisma.pJtoPFBridge.findUnique({ where: { id: bridgeId } })
    expect(b).not.toBeNull()

    // cleanup
    await prisma.pJtoPFBridge.delete({ where: { id: bridgeId } })
    await prisma.personalTransaction.delete({ where: { id: pfTransactionId } })
    await prisma.transaction.delete({ where: { id: pjTxId } })
  })

  test('bridgeId inexistente → BRIDGE_NOT_FOUND', async () => {
    try {
      await deleteBridge({
        userId: userA.id,
        bridgeId: 'cmfakeXXXXXXXXXXXX',
        mode: 'LINK_ONLY',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('BRIDGE_NOT_FOUND')
    }
  })

  test('Mode inválido → INVALID_MODE', async () => {
    try {
      await deleteBridge({
        userId: userA.id,
        bridgeId: 'whatever',
        // @ts-expect-error testando runtime validation
        mode: 'NOT_A_MODE',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('INVALID_MODE')
    }
  })
})

describe('FK Restrict — tx PJ com bridge não pode ser deletada', () => {
  test('Tentar deletar tx PJ com bridge ativa lança erro de FK', async () => {
    const { bridgeId, pfTransactionId, pjTxId } = await createOneBridge()

    let threw = false
    try {
      await prisma.transaction.delete({ where: { id: pjTxId } })
    } catch (err) {
      threw = true
      expect((err as Error).message.toLowerCase()).toMatch(/foreign|constraint|restrict/)
    }
    expect(threw).toBe(true)

    // cleanup
    await prisma.pJtoPFBridge.delete({ where: { id: bridgeId } })
    await prisma.personalTransaction.delete({ where: { id: pfTransactionId } })
    await prisma.transaction.delete({ where: { id: pjTxId } })
  })

  test('Tentar deletar tx PF com bridge ativa lança erro de FK', async () => {
    const { bridgeId, pfTransactionId, pjTxId } = await createOneBridge()

    let threw = false
    try {
      await prisma.personalTransaction.delete({ where: { id: pfTransactionId } })
    } catch (err) {
      threw = true
      expect((err as Error).message.toLowerCase()).toMatch(/foreign|constraint|restrict/)
    }
    expect(threw).toBe(true)

    await prisma.pJtoPFBridge.delete({ where: { id: bridgeId } })
    await prisma.personalTransaction.delete({ where: { id: pfTransactionId } })
    await prisma.transaction.delete({ where: { id: pjTxId } })
  })
})
