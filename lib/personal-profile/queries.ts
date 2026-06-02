// Sprint PF FATIA 1 — Queries Prisma + autorização multi-tenant.
//
// 🛡️ MULTI-TENANT RÍGIDO: TODA query passa por checkProfileAccess que
// confirma que o user TEM UserPersonalProfile ativo pro perfil. Sem
// vínculo → NO_ACCESS. Sem exceção.

import { prisma } from '@/lib/db'
import type {
  PersonalProfile,
  UserPersonalProfile,
  PersonalBankAccount,
  PersonalCategory,
  PersonalTransaction,
} from '@prisma/client'
import { PF_DEFAULT_CATEGORIES } from './default-categories'

export class ProfileAccessError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'ProfileAccessError'
  }
}

/**
 * Verifica que o user tem acesso ao perfil. Retorna o link ativo.
 * 🚨 USAR EM TODA query antes de retornar dados.
 */
export async function checkProfileAccess(
  userId: string,
  profileId: string,
  requiredRole: 'OWNER' | 'VIEWER' | null = null,
): Promise<UserPersonalProfile> {
  const link = await prisma.userPersonalProfile.findUnique({
    where: {
      userId_profileId: { userId, profileId },
    },
  })
  if (!link) {
    throw new ProfileAccessError(
      'Perfil não encontrado ou sem acesso',
      'NO_ACCESS',
    )
  }
  if (requiredRole === 'OWNER' && link.role !== 'OWNER') {
    throw new ProfileAccessError(
      'Apenas OWNER pode realizar esta operação',
      'INSUFFICIENT_ROLE',
    )
  }
  return link
}

/** Lista perfis PF a que o user tem acesso. */
export async function listProfilesForUser(
  userId: string,
): Promise<Array<PersonalProfile & { role: string; isSelf: boolean }>> {
  const links = await prisma.userPersonalProfile.findMany({
    where: { userId },
    include: { profile: true },
    orderBy: [{ isSelf: 'desc' }, { createdAt: 'asc' }],
  })
  return links
    .filter((l) => l.profile.isActive)
    .map((l) => ({
      ...l.profile,
      role: l.role,
      isSelf: l.isSelf,
    }))
}

export interface CreateProfileInput {
  userId: string
  name: string
  cpf?: string | null
  type?: 'OWN' | 'DEPENDENT'
  birthDate?: Date | null
  /** Se true, marca como perfil próprio do user (auto-set se for o 1º perfil) */
  isSelf?: boolean
}

/**
 * Cria perfil PF + vínculo OWNER + 15 categorias default em transaction.
 */
export async function createProfile(
  input: CreateProfileInput,
): Promise<PersonalProfile> {
  const type = input.type ?? 'OWN'

  // Auto-detecta isSelf: se for o 1º perfil OWN do user, marca self.
  let isSelf = input.isSelf ?? false
  if (!isSelf && type === 'OWN') {
    const hasSelf = await prisma.userPersonalProfile.findFirst({
      where: { userId: input.userId, isSelf: true },
      select: { id: true },
    })
    if (!hasSelf) isSelf = true
  }

  return prisma.$transaction(async (tx) => {
    const profile = await tx.personalProfile.create({
      data: {
        name: input.name,
        cpf: input.cpf ?? null,
        type,
        birthDate: input.birthDate ?? null,
      },
    })
    await tx.userPersonalProfile.create({
      data: {
        userId: input.userId,
        profileId: profile.id,
        role: 'OWNER',
        isSelf,
      },
    })
    // Aplica 15 categorias default
    await tx.personalCategory.createMany({
      data: PF_DEFAULT_CATEGORIES.map((c) => ({
        profileId: profile.id,
        name: c.name,
        type: c.type,
        color: c.color,
        icon: c.icon,
        isDefault: true,
      })),
    })
    return profile
  })
}

// ============================================================
// PersonalBankAccount
// ============================================================

export async function listAccountsForProfile(
  userId: string,
  profileId: string,
): Promise<PersonalBankAccount[]> {
  await checkProfileAccess(userId, profileId)
  return prisma.personalBankAccount.findMany({
    where: { profileId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  })
}

export interface CreateAccountInput {
  userId: string
  profileId: string
  name: string
  bankName?: string | null
  bankCode?: string | null
  agency?: string | null
  accountNumber?: string | null
  accountType?: string
  balance?: number
  allowNegativeBalance?: boolean
  creditLimit?: number
  lowBalanceThreshold?: number | null
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<PersonalBankAccount> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  return prisma.personalBankAccount.create({
    data: {
      profileId: input.profileId,
      name: input.name,
      bankName: input.bankName ?? null,
      bankCode: input.bankCode ?? null,
      agency: input.agency ?? null,
      accountNumber: input.accountNumber ?? null,
      accountType: input.accountType ?? 'CHECKING',
      balance: input.balance ?? 0,
      allowNegativeBalance: input.allowNegativeBalance ?? true,
      creditLimit: input.creditLimit ?? 0,
      lowBalanceThreshold: input.lowBalanceThreshold ?? null,
    },
  })
}

// ============================================================
// PersonalCategory
// ============================================================

export async function listCategoriesForProfile(
  userId: string,
  profileId: string,
): Promise<PersonalCategory[]> {
  await checkProfileAccess(userId, profileId)
  return prisma.personalCategory.findMany({
    where: { profileId, isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
}

export interface CreateCategoryInput {
  userId: string
  profileId: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color?: string | null
  icon?: string | null
  parentId?: string | null
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<PersonalCategory> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  // Se parentId for fornecido, valida que pertence ao mesmo perfil
  if (input.parentId) {
    const parent = await prisma.personalCategory.findUnique({
      where: { id: input.parentId },
      select: { profileId: true },
    })
    if (!parent || parent.profileId !== input.profileId) {
      throw new ProfileAccessError('parentId inválido', 'INVALID_PARENT')
    }
  }
  return prisma.personalCategory.create({
    data: {
      profileId: input.profileId,
      name: input.name,
      type: input.type,
      color: input.color ?? null,
      icon: input.icon ?? null,
      parentId: input.parentId ?? null,
    },
  })
}

// ============================================================
// PersonalTransaction
// ============================================================

export interface ListTransactionsFilter {
  userId: string
  profileId: string
  startDate?: Date | null
  endDate?: Date | null
  type?: 'CREDIT' | 'DEBIT' | null
  categoryId?: string | null
  bankAccountId?: string | null
  search?: string | null
  page?: number
  pageSize?: number
}

export async function listTransactions(filter: ListTransactionsFilter) {
  await checkProfileAccess(filter.userId, filter.profileId)
  const pageSize = filter.pageSize ?? 50
  const page = filter.page ?? 1
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = { profileId: filter.profileId }
  if (filter.startDate || filter.endDate) {
    const dateFilter: Record<string, Date> = {}
    if (filter.startDate) dateFilter.gte = filter.startDate
    if (filter.endDate) dateFilter.lte = filter.endDate
    where.date = dateFilter
  }
  if (filter.type) where.type = filter.type
  if (filter.categoryId) where.categoryId = filter.categoryId
  if (filter.bankAccountId) where.bankAccountId = filter.bankAccountId
  if (filter.search) {
    where.description = { contains: filter.search }
  }

  const [items, total] = await Promise.all([
    prisma.personalTransaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: pageSize,
      skip,
      include: { category: true, bankAccount: true },
    }),
    prisma.personalTransaction.count({ where }),
  ])
  return { items, total, page, pageSize }
}

export interface CreateTransactionInput {
  userId: string
  profileId: string
  bankAccountId?: string | null
  categoryId?: string | null
  date: Date
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  notes?: string | null
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<PersonalTransaction> {
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')

  // Valida que bankAccountId pertence ao perfil (anti-leak)
  if (input.bankAccountId) {
    const acc = await prisma.personalBankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: { profileId: true },
    })
    if (!acc || acc.profileId !== input.profileId) {
      throw new ProfileAccessError('bankAccountId inválido', 'INVALID_ACCOUNT')
    }
  }
  // Valida que categoryId pertence ao perfil
  if (input.categoryId) {
    const cat = await prisma.personalCategory.findUnique({
      where: { id: input.categoryId },
      select: { profileId: true },
    })
    if (!cat || cat.profileId !== input.profileId) {
      throw new ProfileAccessError('categoryId inválido', 'INVALID_CATEGORY')
    }
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.personalTransaction.create({
      data: {
        profileId: input.profileId,
        bankAccountId: input.bankAccountId ?? null,
        categoryId: input.categoryId ?? null,
        date: input.date,
        description: input.description,
        amount: Math.abs(input.amount),
        type: input.type,
        notes: input.notes ?? null,
        status: 'RECONCILED',
        origin: 'MANUAL',
      },
    })
    // Atualiza saldo da conta (se vinculada)
    if (input.bankAccountId) {
      const delta = input.type === 'CREDIT' ? input.amount : -input.amount
      await tx.personalBankAccount.update({
        where: { id: input.bankAccountId },
        data: { balance: { increment: delta } },
      })
    }
    return created
  })
}

/**
 * Dashboard summary do perfil — saldo total, entradas/saídas últimos 30d,
 * top 5 categorias de despesa, número de contas/tx.
 */
export async function getProfileSummary(userId: string, profileId: string) {
  await checkProfileAccess(userId, profileId)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [accounts, txLast30d, totalTx] = await Promise.all([
    prisma.personalBankAccount.findMany({
      where: { profileId, isActive: true },
      select: { balance: true, name: true, id: true },
    }),
    prisma.personalTransaction.findMany({
      where: { profileId, date: { gte: thirtyDaysAgo } },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    prisma.personalTransaction.count({ where: { profileId } }),
  ])

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const incomes30d = txLast30d
    .filter((t) => t.type === 'CREDIT')
    .reduce((s, t) => s + t.amount, 0)
  const expenses30d = txLast30d
    .filter((t) => t.type === 'DEBIT')
    .reduce((s, t) => s + t.amount, 0)

  // Top 5 categorias EXPENSE últimos 30d
  const expenseByCategory = new Map<
    string,
    { id: string; name: string; color: string | null; total: number }
  >()
  for (const t of txLast30d) {
    if (t.type !== 'DEBIT' || !t.category) continue
    const existing = expenseByCategory.get(t.category.id)
    if (existing) {
      existing.total += t.amount
    } else {
      expenseByCategory.set(t.category.id, {
        id: t.category.id,
        name: t.category.name,
        color: t.category.color,
        total: t.amount,
      })
    }
  }
  const topCategories = [...expenseByCategory.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    totalBalance,
    accountsCount: accounts.length,
    totalTransactions: totalTx,
    incomes30d,
    expenses30d,
    net30d: incomes30d - expenses30d,
    topExpenseCategories: topCategories,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, balance: a.balance })),
  }
}
