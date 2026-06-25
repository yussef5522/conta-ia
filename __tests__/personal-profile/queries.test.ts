// Sprint PF FATIA 1 — Queries + autorização (integração com SQLite dev).

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  createProfile,
  listProfilesForUser,
  checkProfileAccess,
  createAccount,
  listAccountsForProfile,
  createCategory,
  listCategoriesForProfile,
  createTransaction,
  listTransactions,
  getProfileSummary,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'

const PREFIX = `pf-queries-${Date.now()}-${process.pid}`
let userA: { id: string; email: string }
let userB: { id: string; email: string }

beforeAll(async () => {
  const pwd = await bcrypt.hash('TestPwd123!', 10)
  userA = await prisma.user.create({
    data: { name: 'A', email: `${PREFIX}-a@dev.local`, password: pwd },
  })
  userB = await prisma.user.create({
    data: { name: 'B', email: `${PREFIX}-b@dev.local`, password: pwd },
  })
})

afterAll(async () => {
  await prisma.user
    .deleteMany({ where: { email: { contains: PREFIX } } })
    .catch(() => {})
})

describe('createProfile', () => {
  test('cria perfil + vínculo OWNER + 16 categorias default', async () => {
    const profile = await createProfile({
      userId: userA.id,
      name: 'A1 self',
      type: 'OWN',
    })
    expect(profile.id).toBeTruthy()

    const link = await prisma.userPersonalProfile.findUnique({
      where: {
        userId_profileId: { userId: userA.id, profileId: profile.id },
      },
    })
    expect(link?.role).toBe('OWNER')
    expect(link?.isSelf).toBe(true) // 1º perfil OWN → auto-self

    const cats = await prisma.personalCategory.count({
      where: { profileId: profile.id },
    })
    expect(cats).toBe(16)
  })

  test('2º perfil OWN do mesmo user NÃO marca isSelf (já tem um)', async () => {
    const p1 = await createProfile({ userId: userB.id, name: 'B1', type: 'OWN' })
    const p2 = await createProfile({ userId: userB.id, name: 'B2', type: 'OWN' })

    const l1 = await prisma.userPersonalProfile.findUnique({
      where: { userId_profileId: { userId: userB.id, profileId: p1.id } },
    })
    const l2 = await prisma.userPersonalProfile.findUnique({
      where: { userId_profileId: { userId: userB.id, profileId: p2.id } },
    })
    expect(l1?.isSelf).toBe(true)
    expect(l2?.isSelf).toBe(false)
  })

  test('DEPENDENT nunca marca isSelf', async () => {
    const p = await createProfile({
      userId: userB.id,
      name: 'Filho',
      type: 'DEPENDENT',
    })
    const link = await prisma.userPersonalProfile.findUnique({
      where: { userId_profileId: { userId: userB.id, profileId: p.id } },
    })
    expect(link?.isSelf).toBe(false)
  })
})

describe('checkProfileAccess — multi-tenant rígido', () => {
  let profileA: { id: string }

  beforeAll(async () => {
    profileA = await createProfile({
      userId: userA.id,
      name: 'A2 acesso',
    })
  })

  test('user com vínculo OWNER → passa', async () => {
    const link = await checkProfileAccess(userA.id, profileA.id)
    expect(link.role).toBe('OWNER')
  })

  test('user com vínculo passa em requiredRole OWNER', async () => {
    const link = await checkProfileAccess(userA.id, profileA.id, 'OWNER')
    expect(link.role).toBe('OWNER')
  })

  test('🛡️ user SEM vínculo → ProfileAccessError NO_ACCESS', async () => {
    await expect(
      checkProfileAccess(userB.id, profileA.id),
    ).rejects.toThrow(ProfileAccessError)
    try {
      await checkProfileAccess(userB.id, profileA.id)
    } catch (err) {
      expect((err as ProfileAccessError).code).toBe('NO_ACCESS')
    }
  })

  test('🛡️ user inexistente → NO_ACCESS', async () => {
    await expect(
      checkProfileAccess('user-fake-xxx', profileA.id),
    ).rejects.toThrow(ProfileAccessError)
  })

  test('🛡️ perfil inexistente → NO_ACCESS', async () => {
    await expect(
      checkProfileAccess(userA.id, 'profile-fake-xxx'),
    ).rejects.toThrow(ProfileAccessError)
  })
})

describe('listProfilesForUser', () => {
  test('retorna SOMENTE perfis do user (não vaza de outro)', async () => {
    const pA = await createProfile({ userId: userA.id, name: 'lista-A' })
    const pB = await createProfile({ userId: userB.id, name: 'lista-B' })

    const listA = await listProfilesForUser(userA.id)
    const listB = await listProfilesForUser(userB.id)

    expect(listA.some((p) => p.id === pA.id)).toBe(true)
    expect(listA.some((p) => p.id === pB.id)).toBe(false) // 🛡️
    expect(listB.some((p) => p.id === pB.id)).toBe(true)
    expect(listB.some((p) => p.id === pA.id)).toBe(false) // 🛡️
  })
})

describe('Contas bancárias PF', () => {
  let profileX: { id: string }
  beforeAll(async () => {
    profileX = await createProfile({ userId: userA.id, name: 'contas-X' })
  })

  test('createAccount: requer OWNER do perfil', async () => {
    const acc = await createAccount({
      userId: userA.id,
      profileId: profileX.id,
      name: 'Nubank PF',
      bankName: 'Nubank',
      balance: 1000,
    })
    expect(acc.balance).toBe(1000)
    expect(acc.profileId).toBe(profileX.id)
  })

  test('🛡️ createAccount de OUTRO user → NO_ACCESS', async () => {
    await expect(
      createAccount({
        userId: userB.id,
        profileId: profileX.id,
        name: 'tentativa-vazamento',
      }),
    ).rejects.toThrow(ProfileAccessError)
  })

  test('listAccountsForProfile: só lista do perfil do user', async () => {
    const accs = await listAccountsForProfile(userA.id, profileX.id)
    expect(accs.length).toBeGreaterThan(0)
    expect(accs.every((a) => a.profileId === profileX.id)).toBe(true)
  })

  test('🛡️ listAccountsForProfile de outro user → NO_ACCESS', async () => {
    await expect(
      listAccountsForProfile(userB.id, profileX.id),
    ).rejects.toThrow(ProfileAccessError)
  })
})

describe('Categorias PF', () => {
  let profileY: { id: string }
  beforeAll(async () => {
    profileY = await createProfile({ userId: userA.id, name: 'cats-Y' })
  })

  test('createCategory: nova categoria EXPENSE', async () => {
    const cat = await createCategory({
      userId: userA.id,
      profileId: profileY.id,
      name: 'Pet',
      type: 'EXPENSE',
      color: '#ec4899',
    })
    expect(cat.name).toBe('Pet')
  })

  test('🛡️ createCategory de OUTRO user → NO_ACCESS', async () => {
    await expect(
      createCategory({
        userId: userB.id,
        profileId: profileY.id,
        name: 'invasor',
        type: 'EXPENSE',
      }),
    ).rejects.toThrow(ProfileAccessError)
  })

  test('parentId de outro perfil → INVALID_PARENT', async () => {
    const profileZ = await createProfile({ userId: userA.id, name: 'cats-Z' })
    const catZ = await prisma.personalCategory.create({
      data: { profileId: profileZ.id, name: 'isolada-Z', type: 'EXPENSE' },
    })
    await expect(
      createCategory({
        userId: userA.id,
        profileId: profileY.id,
        name: 'tenta-link-cross',
        type: 'EXPENSE',
        parentId: catZ.id,
      }),
    ).rejects.toThrow(ProfileAccessError)
  })

  test('listCategoriesForProfile: 16 default + customs do perfil', async () => {
    const cats = await listCategoriesForProfile(userA.id, profileY.id)
    expect(cats.length).toBeGreaterThanOrEqual(16)
    expect(cats.every((c) => c.profileId === profileY.id)).toBe(true)
  })
})

describe('Transações PF', () => {
  let profile: { id: string }
  let account: { id: string }
  let category: { id: string }

  beforeAll(async () => {
    profile = await createProfile({ userId: userA.id, name: 'tx-perfil' })
    account = await createAccount({
      userId: userA.id,
      profileId: profile.id,
      name: 'tx-conta',
      balance: 0,
    })
    const cats = await listCategoriesForProfile(userA.id, profile.id)
    category = cats.find((c) => c.type === 'EXPENSE') ?? cats[0]
  })

  test('createTransaction DEBIT diminui saldo da conta', async () => {
    await createTransaction({
      userId: userA.id,
      profileId: profile.id,
      bankAccountId: account.id,
      categoryId: category.id,
      date: new Date(),
      description: 'gasto teste',
      amount: 50,
      type: 'DEBIT',
    })
    const acc = await prisma.personalBankAccount.findUnique({
      where: { id: account.id },
    })
    expect(acc?.balance).toBe(-50)
  })

  test('createTransaction CREDIT aumenta saldo', async () => {
    await createTransaction({
      userId: userA.id,
      profileId: profile.id,
      bankAccountId: account.id,
      categoryId: category.id,
      date: new Date(),
      description: 'entrada',
      amount: 200,
      type: 'CREDIT',
    })
    const acc = await prisma.personalBankAccount.findUnique({
      where: { id: account.id },
    })
    expect(acc?.balance).toBe(150)
  })

  test('🛡️ createTransaction com bankAccountId de OUTRO perfil → INVALID_ACCOUNT', async () => {
    const otherProfile = await createProfile({ userId: userA.id, name: 'outro' })
    const otherAcc = await createAccount({
      userId: userA.id,
      profileId: otherProfile.id,
      name: 'outra-conta',
    })
    await expect(
      createTransaction({
        userId: userA.id,
        profileId: profile.id,
        bankAccountId: otherAcc.id, // conta de OUTRO perfil
        date: new Date(),
        description: 'vaza',
        amount: 10,
        type: 'DEBIT',
      }),
    ).rejects.toThrow(ProfileAccessError)
  })

  test('🛡️ createTransaction com categoryId de OUTRO perfil → INVALID_CATEGORY', async () => {
    const otherProfile = await createProfile({ userId: userA.id, name: 'cat-cross' })
    const otherCats = await listCategoriesForProfile(userA.id, otherProfile.id)
    await expect(
      createTransaction({
        userId: userA.id,
        profileId: profile.id,
        categoryId: otherCats[0].id,
        date: new Date(),
        description: 'cat vaza',
        amount: 10,
        type: 'DEBIT',
      }),
    ).rejects.toThrow(ProfileAccessError)
  })

  test('🛡️ user B tenta criar tx no perfil de A → NO_ACCESS', async () => {
    await expect(
      createTransaction({
        userId: userB.id,
        profileId: profile.id,
        date: new Date(),
        description: 'invasor',
        amount: 10,
        type: 'DEBIT',
      }),
    ).rejects.toThrow(ProfileAccessError)
  })

  test('listTransactions filtra por type', async () => {
    const result = await listTransactions({
      userId: userA.id,
      profileId: profile.id,
      type: 'CREDIT',
    })
    expect(result.items.every((t) => t.type === 'CREDIT')).toBe(true)
  })

  test('listTransactions filtra por date', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const result = await listTransactions({
      userId: userA.id,
      profileId: profile.id,
      startDate: future,
    })
    expect(result.items).toHaveLength(0)
  })

  test('🛡️ listTransactions de OUTRO user → NO_ACCESS', async () => {
    await expect(
      listTransactions({ userId: userB.id, profileId: profile.id }),
    ).rejects.toThrow(ProfileAccessError)
  })
})

describe('getProfileSummary', () => {
  test('soma corretamente saldos + entradas/saídas 30d', async () => {
    const p = await createProfile({ userId: userA.id, name: 'summary' })
    const acc = await createAccount({
      userId: userA.id,
      profileId: p.id,
      name: 'sum-acc',
      balance: 1000,
    })
    await createTransaction({
      userId: userA.id,
      profileId: p.id,
      bankAccountId: acc.id,
      date: new Date(),
      description: 'recebido',
      amount: 500,
      type: 'CREDIT',
    })
    await createTransaction({
      userId: userA.id,
      profileId: p.id,
      bankAccountId: acc.id,
      date: new Date(),
      description: 'gasto',
      amount: 200,
      type: 'DEBIT',
    })

    const sum = await getProfileSummary(userA.id, p.id)
    // saldo: 1000 (inicial) +500 -200 = 1300
    expect(sum.totalBalance).toBe(1300)
    expect(sum.incomes30d).toBe(500)
    expect(sum.expenses30d).toBe(200)
    expect(sum.net30d).toBe(300)
  })

  test('🛡️ getProfileSummary de OUTRO user → NO_ACCESS', async () => {
    const p = await createProfile({ userId: userA.id, name: 'sum-isolated' })
    await expect(
      getProfileSummary(userB.id, p.id),
    ).rejects.toThrow(ProfileAccessError)
  })
})
