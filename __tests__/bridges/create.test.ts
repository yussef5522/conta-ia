// Sprint PF Fatia 4 — Testes integração createBridge.

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createBridge } from '@/lib/bridges/create'
import { BridgeError } from '@/lib/bridges/types'
import { createProfile, createAccount } from '@/lib/personal-profile/queries'

const PREFIX = `bridge-create-${Date.now()}-${process.pid}`

let userA: { id: string }  // dono
let userB: { id: string }  // sócio sem perfil PF próprio (privacy)
let companyId: string
let companyId2: string  // pra testar COMPANY_MISMATCH
let bankAccountId: string
let bankAccountId2: string
let socioA: { id: string }
let profileA: { id: string }
let pfAccount: { id: string }
let pfCategory: { id: string }
let pfExpenseCat: { id: string } // category EXPENSE pra testar invalid
let pjTx1: { id: string }
let pjTx2: { id: string }
let pjTx3PayableNot: { id: string }
let pjTxCredit: { id: string }
let pjTxOtherCompany: { id: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@x.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@x.local`, password: pwd },
  })

  const c1 = await prisma.company.create({
    data: {
      name: `${PREFIX}-profit`, cnpj: `01${Date.now().toString().slice(-12)}`,
      type: 'service',
      users: { create: [{ userId: userA.id, role: 'OWNER' }, { userId: userB.id, role: 'OWNER' }] },
    },
  })
  companyId = c1.id
  const c2 = await prisma.company.create({
    data: {
      name: `${PREFIX}-cacula`, cnpj: `02${Date.now().toString().slice(-12)}`,
      type: 'service',
      users: { create: [{ userId: userA.id, role: 'OWNER' }] },
    },
  })
  companyId2 = c2.id

  const ba1 = await prisma.bankAccount.create({
    data: { companyId, name: 'Banrisul', accountType: 'CHECKING' },
  })
  bankAccountId = ba1.id
  const ba2 = await prisma.bankAccount.create({
    data: { companyId: companyId2, name: 'Sicredi', accountType: 'CHECKING' },
  })
  bankAccountId2 = ba2.id

  socioA = await prisma.socioPF.create({
    data: { companyId, nome: 'Yussef', cpf: '60025889060', papel: 'SOCIO' },
  })

  profileA = await createProfile({
    userId: userA.id, name: 'Yussef PF', cpf: '60025889060',
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

  const expCats = await prisma.personalCategory.findMany({
    where: { profileId: profileA.id, type: 'EXPENSE' },
    take: 1,
  })
  pfExpenseCat = { id: expCats[0]!.id }

  pjTx1 = await prisma.transaction.create({
    data: {
      bankAccountId, date: new Date('2026-05-28'),
      description: 'Pix Yussef Musa CPF 600.258.890-60',
      amount: 10000, type: 'DEBIT', lifecycle: 'EFFECTED',
      relatedPartyType: 'SOCIO_PF', relatedPartyId: socioA.id,
    },
  })
  pjTx2 = await prisma.transaction.create({
    data: {
      bankAccountId, date: new Date('2026-05-22'),
      description: 'Pix Yussef Musa', amount: 5000, type: 'DEBIT', lifecycle: 'EFFECTED',
    },
  })
  pjTx3PayableNot = await prisma.transaction.create({
    data: {
      bankAccountId, date: new Date(),
      description: 'Aluguel previsto', amount: 3000, type: 'DEBIT', lifecycle: 'PAYABLE',
      dueDate: new Date('2026-06-15'),
    },
  })
  pjTxCredit = await prisma.transaction.create({
    data: {
      bankAccountId, date: new Date(),
      description: 'Recebimento', amount: 5000, type: 'CREDIT', lifecycle: 'EFFECTED',
    },
  })
  pjTxOtherCompany = await prisma.transaction.create({
    data: {
      bankAccountId: bankAccountId2, date: new Date(),
      description: 'Pix em outra empresa', amount: 7000, type: 'DEBIT', lifecycle: 'EFFECTED',
    },
  })
})

afterAll(async () => {
  // Order matters por causa de FK Restrict
  await prisma.pJtoPFBridge.deleteMany({
    where: { companyId: { in: [companyId, companyId2] } },
  })
  await prisma.personalTransaction.deleteMany({
    where: { profileId: profileA.id },
  })
  await prisma.transaction.deleteMany({
    where: { bankAccountId: { in: [bankAccountId, bankAccountId2] } },
  })
  await prisma.bankAccount.deleteMany({
    where: { companyId: { in: [companyId, companyId2] } },
  })
  await prisma.socioPF.deleteMany({
    where: { companyId: { in: [companyId, companyId2] } },
  })
  await prisma.auditLog.deleteMany({
    where: { companyId: { in: [companyId, companyId2] } },
  })
  await prisma.company.deleteMany({
    where: { id: { in: [companyId, companyId2] } },
  })
  await prisma.personalCategory.deleteMany({ where: { profileId: profileA.id } })
  await prisma.personalBankAccount.deleteMany({ where: { profileId: profileA.id } })
  await prisma.userPersonalProfile.deleteMany({
    where: { userId: { in: [userA.id, userB.id] } },
  })
  await prisma.personalProfile.deleteMany({ where: { id: profileA.id } })
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
})

describe('createBridge — caminho feliz', () => {
  test('Cria atomic + audit log + tx PF CREDIT correta', async () => {
    const result = await createBridge({
      userId: userA.id,
      companyId,
      pjTransactionId: pjTx1.id,
      profileId: profileA.id,
      pfBankAccountId: pfAccount.id,
      pfCategoryId: pfCategory.id,
      kind: 'DISTRIBUICAO',
      createdVia: 'CREATED_FROM_DETECTION',
      socioPFId: socioA.id,
    })
    expect(result.bridgeId).toBeTruthy()
    expect(result.pfTransactionId).toBeTruthy()

    const bridge = await prisma.pJtoPFBridge.findUnique({
      where: { id: result.bridgeId },
    })
    expect(bridge).not.toBeNull()
    expect(bridge!.kind).toBe('DISTRIBUICAO')
    expect(bridge!.amount).toBe(10000)
    expect(bridge!.companyId).toBe(companyId)
    expect(bridge!.profileId).toBe(profileA.id)
    expect(bridge!.createdById).toBe(userA.id)
    expect(bridge!.socioPFId).toBe(socioA.id)
    expect(bridge!.createdVia).toBe('CREATED_FROM_DETECTION')

    const pfTx = await prisma.personalTransaction.findUnique({
      where: { id: result.pfTransactionId },
    })
    expect(pfTx).not.toBeNull()
    expect(pfTx!.type).toBe('CREDIT')
    expect(pfTx!.amount).toBe(10000)
    expect(pfTx!.profileId).toBe(profileA.id)
    expect(pfTx!.bankAccountId).toBe(pfAccount.id)
    expect(pfTx!.categoryId).toBe(pfCategory.id)
    expect(pfTx!.origin).toBe('AI') // CREATED_FROM_DETECTION → AI
    expect(pfTx!.description).toContain('Distribuição de Lucros')
    expect(pfTx!.description).toContain(`${PREFIX}-profit`)

    const audit = await prisma.auditLog.findMany({
      where: { entityType: 'PJtoPFBridge', entityId: result.bridgeId },
    })
    expect(audit).toHaveLength(1)
    expect(audit[0].action).toBe('BRIDGE_CREATED')

    // cleanup pra próximos testes
    await prisma.pJtoPFBridge.delete({ where: { id: result.bridgeId } })
    await prisma.personalTransaction.delete({ where: { id: result.pfTransactionId } })
  })

  test('Cria com kind PRO_LABORE → origin MANUAL', async () => {
    const result = await createBridge({
      userId: userA.id, companyId, pjTransactionId: pjTx2.id,
      profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
      kind: 'PRO_LABORE',
    })
    const pfTx = await prisma.personalTransaction.findUnique({
      where: { id: result.pfTransactionId },
    })
    expect(pfTx!.origin).toBe('MANUAL')
    expect(pfTx!.description).toContain('Pró-labore')

    await prisma.pJtoPFBridge.delete({ where: { id: result.bridgeId } })
    await prisma.personalTransaction.delete({ where: { id: result.pfTransactionId } })
  })
})

describe('createBridge — bloqueios', () => {
  test('🚨 PRIVACIDADE: userB com profileId de A → 404 PF_PROFILE_NOT_FOUND', async () => {
    try {
      await createBridge({
        userId: userB.id, companyId, pjTransactionId: pjTx1.id,
        profileId: profileA.id,
        pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
        kind: 'DISTRIBUICAO',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('PF_PROFILE_NOT_FOUND')
    }
  })

  test('Tx CREDIT → PJ_WRONG_TYPE', async () => {
    try {
      await createBridge({
        userId: userA.id, companyId, pjTransactionId: pjTxCredit.id,
        profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
        kind: 'DISTRIBUICAO',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('PJ_WRONG_TYPE')
    }
  })

  test('Tx lifecycle=PAYABLE → PJ_INVALID_LIFECYCLE', async () => {
    try {
      await createBridge({
        userId: userA.id, companyId, pjTransactionId: pjTx3PayableNot.id,
        profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
        kind: 'DISTRIBUICAO',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('PJ_INVALID_LIFECYCLE')
    }
  })

  test('Tx de outra empresa (companyId mismatch) → COMPANY_MISMATCH', async () => {
    try {
      await createBridge({
        userId: userA.id, companyId, // companyId=PROFIT
        pjTransactionId: pjTxOtherCompany.id, // tx é da CACULA
        profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
        kind: 'DISTRIBUICAO',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('COMPANY_MISMATCH')
    }
  })

  test('Tx PJ já tem bridge → PJ_ALREADY_BRIDGED', async () => {
    const result = await createBridge({
      userId: userA.id, companyId, pjTransactionId: pjTx1.id,
      profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
      kind: 'DISTRIBUICAO',
    })
    try {
      await createBridge({
        userId: userA.id, companyId, pjTransactionId: pjTx1.id,
        profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
        kind: 'PRO_LABORE',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('PJ_ALREADY_BRIDGED')
    }
    await prisma.pJtoPFBridge.delete({ where: { id: result.bridgeId } })
    await prisma.personalTransaction.delete({ where: { id: result.pfTransactionId } })
  })

  test('Categoria EXPENSE no PF → PF_CATEGORY_INVALID', async () => {
    try {
      await createBridge({
        userId: userA.id, companyId, pjTransactionId: pjTx1.id,
        profileId: profileA.id, pfBankAccountId: pfAccount.id,
        pfCategoryId: pfExpenseCat.id,
        kind: 'DISTRIBUICAO',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('PF_CATEGORY_INVALID')
    }
  })

  test('Kind inválido → INVALID_KIND', async () => {
    try {
      await createBridge({
        userId: userA.id, companyId, pjTransactionId: pjTx1.id,
        profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
        // @ts-expect-error testando runtime validation
        kind: 'NOT_A_KIND',
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('INVALID_KIND')
    }
  })

  test('SocioPFId de outra empresa → COMPANY_MISMATCH', async () => {
    const socioOther = await prisma.socioPF.create({
      data: { companyId: companyId2, nome: 'X', cpf: '00000000000', papel: 'SOCIO' },
    })
    try {
      await createBridge({
        userId: userA.id, companyId, pjTransactionId: pjTx2.id,
        profileId: profileA.id, pfBankAccountId: pfAccount.id, pfCategoryId: pfCategory.id,
        kind: 'DISTRIBUICAO',
        socioPFId: socioOther.id,
      })
      throw new Error('Deveria ter lançado')
    } catch (err) {
      expect((err as BridgeError).code).toBe('COMPANY_MISMATCH')
    }
    await prisma.socioPF.delete({ where: { id: socioOther.id } })
  })
})
