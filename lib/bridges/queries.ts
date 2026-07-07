// Sprint PF Fatia 4 — Queries de listagem + detalhe + summary.
//
// 🔒 PRIVACIDADE MULTI-SÓCIO:
// - listBridgesForCompany: filtra profileId IN owned_by_user
// - listBridgesForProfile: checkProfileAccess garante user é dono
// - getBridgeDetail: 404 se user não é dono nem criador

import { prisma } from '@/lib/db'
import { checkProfileAccess, ProfileAccessError } from '@/lib/personal-profile/queries'
import { BridgeError, type BridgeKind, type BridgeListItem, type BridgeDetail } from './types'

/** Retorna profileIds dos perfis OWN do user logado. */
export async function getUserOwnedProfileIds(userId: string): Promise<string[]> {
  const links = await prisma.userPersonalProfile.findMany({
    where: { userId, role: 'OWNER' },
    select: { profileId: true },
  })
  return links.map((l) => l.profileId)
}

export interface ListBridgesInput {
  userId: string
  companyId?: string
  profileId?: string
  kind?: BridgeKind
  dateFrom?: Date
  dateTo?: Date
  page?: number
  pageSize?: number
}

export interface ListBridgesResult {
  bridges: BridgeListItem[]
  total: number
  page: number
  pageSize: number
}

export async function listBridges(
  input: ListBridgesInput,
): Promise<ListBridgesResult> {
  const page = input.page ?? 1
  const pageSize = Math.min(input.pageSize ?? 20, 100)
  const skip = (page - 1) * pageSize

  // 🔒 Privacidade: SEMPRE filtra por perfis do user
  const ownedProfileIds = await getUserOwnedProfileIds(input.userId)
  if (ownedProfileIds.length === 0) {
    return { bridges: [], total: 0, page, pageSize }
  }

  const where: Record<string, unknown> = {
    profileId: { in: ownedProfileIds },
  }
  if (input.companyId) where.companyId = input.companyId
  if (input.profileId) {
    // Se passou profileId, ele DEVE estar em ownedProfileIds.
    if (!ownedProfileIds.includes(input.profileId)) {
      return { bridges: [], total: 0, page, pageSize }
    }
    where.profileId = input.profileId
  }
  if (input.kind) where.kind = input.kind
  if (input.dateFrom || input.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (input.dateFrom) dateFilter.gte = input.dateFrom
    if (input.dateTo) dateFilter.lte = input.dateTo
    where.date = dateFilter
  }

  const [bridges, total] = await Promise.all([
    prisma.pJtoPFBridge.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: pageSize,
      include: {
        company: { select: { name: true } },
        profile: { select: { name: true } },
        socioPF: { select: { nome: true } },
        pjTransaction: {
          select: {
            id: true,
            bankAccount: { select: { name: true } },
          },
        },
        pfTransaction: {
          select: {
            id: true,
            bankAccount: { select: { name: true } },
          },
        },
      },
    }),
    prisma.pJtoPFBridge.count({ where }),
  ])

  const items: BridgeListItem[] = bridges.map((b) => ({
    id: b.id,
    kind: b.kind as BridgeKind,
    amount: b.amount,
    date: b.date,
    createdVia: b.createdVia as 'CREATED_MANUAL' | 'CREATED_FROM_DETECTION',
    companyId: b.companyId,
    companyName: b.company.name,
    pjTransactionId: b.pjTransactionId,
    pjBankAccountName: b.pjTransaction.bankAccount?.name ?? null,
    profileId: b.profileId,
    profileName: b.profile.name,
    pfTransactionId: b.pfTransactionId,
    pfBankAccountName: b.pfTransaction.bankAccount?.name ?? null,
    socioPFName: b.socioPF?.nome ?? null,
  }))

  return { bridges: items, total, page, pageSize }
}

/** Detalhe completo da ponte (404 se user não tem acesso). */
export async function getBridgeDetail(
  userId: string,
  bridgeId: string,
): Promise<BridgeDetail> {
  const bridge = await prisma.pJtoPFBridge.findUnique({
    where: { id: bridgeId },
    include: {
      pjTransaction: true,
      pfTransaction: true,
      socioPF: true,
    },
  })

  if (!bridge) {
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }

  // 🔒 Autorização: dono do perfil OU criador.
  const isCreator = bridge.createdById === userId
  let isOwner = false
  try {
    await checkProfileAccess(userId, bridge.profileId, 'OWNER')
    isOwner = true
  } catch (err) {
    if (!(err instanceof ProfileAccessError)) throw err
  }

  if (!isOwner && !isCreator) {
    // Mesma mensagem do "não existe" pra não revelar
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }

  return {
    bridge,
    pjTransaction: bridge.pjTransaction,
    pfTransaction: bridge.pfTransaction,
    socioPF: bridge.socioPF,
  }
}

/**
 * Sprint Redesign-Ponte-Detalhe (06/07/2026): loader enriquecido pro
 * detalhe da ponte (`/pontes/[id]` client redesenhado como "linha do
 * tempo do dinheiro").
 *
 * Difere de `getBridgeDetail` (mantido intocado por backward-compat com
 * callers antigos + testes) por trazer as relações que a nova tela usa:
 *   - `pjTransaction.bankAccount.company` (empresa de origem — "Cacula")
 *   - `pjTransaction.category` (dreGroup + nome — "Distribuição de Lucros")
 *   - `pfTransaction.bankAccount` (conta de destino — "Banrisul PF")
 *   - `pfTransaction.category` (categoria da entrada PF)
 *   - `spendTransaction { category, bankAccount }` (fluxo B — se já gasto)
 *   - `createdBy` (autor da ponte)
 *
 * Mesmo guard OWNER-ou-CREATOR do original — 404 anonimizado.
 */
export interface BridgeDetailForPage {
  bridge: {
    id: string
    kind: string
    amount: number
    date: Date
    createdAt: Date
    createdVia: string
    companyId: string
    profileId: string
    notes: string | null
    socioPFId: string | null
    spendTransactionId: string | null
    spendAcknowledged: boolean
    createdBy: { name: string; email: string } | null
  }
  pjTransaction: {
    id: string
    description: string
    amount: number
    date: Date
    bankAccountId: string | null
    bankAccount: {
      id: string
      name: string
      company: { id: string; name: string; tradeName: string | null }
    } | null
    category: { id: string; name: string; dreGroup: string | null } | null
  }
  pfTransaction: {
    id: string
    description: string
    amount: number
    date: Date
    bankAccountId: string | null
    bankAccount: { id: string; name: string } | null
    category: { id: string; name: string; color: string | null } | null
  }
  spendTransaction: {
    id: string
    description: string
    amount: number
    date: Date
    bankAccount: { id: string; name: string } | null
    category: { id: string; name: string; color: string | null } | null
  } | null
  socioPF: {
    id: string
    nome: string
    cpf: string | null
    papel: string
  } | null
}

export async function getBridgeDetailForPage(
  userId: string,
  bridgeId: string,
): Promise<BridgeDetailForPage> {
  const bridge = await prisma.pJtoPFBridge.findUnique({
    where: { id: bridgeId },
    include: {
      pjTransaction: {
        include: {
          bankAccount: {
            include: {
              company: { select: { id: true, name: true, tradeName: true } },
            },
          },
          category: { select: { id: true, name: true, dreGroup: true } },
        },
      },
      pfTransaction: {
        include: {
          bankAccount: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, color: true } },
        },
      },
      spendTransaction: {
        include: {
          bankAccount: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, color: true } },
        },
      },
      socioPF: true,
      createdBy: { select: { name: true, email: true } },
    },
  })

  if (!bridge) {
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }

  const isCreator = bridge.createdById === userId
  let isOwner = false
  try {
    await checkProfileAccess(userId, bridge.profileId, 'OWNER')
    isOwner = true
  } catch (err) {
    if (!(err instanceof ProfileAccessError)) throw err
  }

  if (!isOwner && !isCreator) {
    // Mesma mensagem do "não existe" pra não revelar existência.
    throw new BridgeError('Ponte não encontrada', 'BRIDGE_NOT_FOUND')
  }

  return {
    bridge: {
      id: bridge.id,
      kind: bridge.kind,
      amount: bridge.amount,
      date: bridge.date,
      createdAt: bridge.createdAt,
      createdVia: bridge.createdVia,
      companyId: bridge.companyId,
      profileId: bridge.profileId,
      notes: bridge.notes,
      socioPFId: bridge.socioPFId,
      spendTransactionId: bridge.spendTransactionId,
      spendAcknowledged: bridge.spendAcknowledged,
      createdBy: bridge.createdBy
        ? { name: bridge.createdBy.name, email: bridge.createdBy.email }
        : null,
    },
    pjTransaction: {
      id: bridge.pjTransaction.id,
      description: bridge.pjTransaction.description,
      amount: bridge.pjTransaction.amount,
      date: bridge.pjTransaction.date,
      bankAccountId: bridge.pjTransaction.bankAccountId,
      bankAccount: bridge.pjTransaction.bankAccount
        ? {
            id: bridge.pjTransaction.bankAccount.id,
            name: bridge.pjTransaction.bankAccount.name,
            company: bridge.pjTransaction.bankAccount.company,
          }
        : null,
      category: bridge.pjTransaction.category,
    },
    pfTransaction: {
      id: bridge.pfTransaction.id,
      description: bridge.pfTransaction.description,
      amount: bridge.pfTransaction.amount,
      date: bridge.pfTransaction.date,
      bankAccountId: bridge.pfTransaction.bankAccountId,
      bankAccount: bridge.pfTransaction.bankAccount,
      category: bridge.pfTransaction.category,
    },
    spendTransaction: bridge.spendTransaction
      ? {
          id: bridge.spendTransaction.id,
          description: bridge.spendTransaction.description,
          amount: bridge.spendTransaction.amount,
          date: bridge.spendTransaction.date,
          bankAccount: bridge.spendTransaction.bankAccount,
          category: bridge.spendTransaction.category,
        }
      : null,
    socioPF: bridge.socioPF,
  }
}

/** Verifica se uma tx PJ específica tem ponte que PERTENCE ao user logado. */
export async function checkPjTxBridgeForUser(
  userId: string,
  pjTransactionId: string,
): Promise<{ hasBridge: boolean; bridgeId: string | null; belongsToMe: boolean }> {
  const bridge = await prisma.pJtoPFBridge.findUnique({
    where: { pjTransactionId },
    select: { id: true, profileId: true, createdById: true },
  })
  if (!bridge) {
    return { hasBridge: false, bridgeId: null, belongsToMe: false }
  }
  // Privacidade: belongsToMe é true SE user é dono do perfil OU criador.
  const ownedProfileIds = await getUserOwnedProfileIds(userId)
  const belongsToMe =
    ownedProfileIds.includes(bridge.profileId) || bridge.createdById === userId
  return {
    hasBridge: true,
    bridgeId: belongsToMe ? bridge.id : null,
    belongsToMe,
  }
}

/** Summary pra dashboard (totais por tipo, contagem). */
export interface BridgeSummaryInput {
  userId: string
  companyId?: string
  profileId?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface BridgeSummary {
  totalCount: number
  totalAmount: number
  byKind: Record<string, { count: number; amount: number }>
}

export async function getBridgeSummary(
  input: BridgeSummaryInput,
): Promise<BridgeSummary> {
  const ownedProfileIds = await getUserOwnedProfileIds(input.userId)
  if (ownedProfileIds.length === 0) {
    return { totalCount: 0, totalAmount: 0, byKind: {} }
  }
  const where: Record<string, unknown> = {
    profileId: { in: ownedProfileIds },
  }
  if (input.companyId) where.companyId = input.companyId
  if (input.profileId) {
    if (!ownedProfileIds.includes(input.profileId)) {
      return { totalCount: 0, totalAmount: 0, byKind: {} }
    }
    where.profileId = input.profileId
  }
  if (input.dateFrom || input.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (input.dateFrom) dateFilter.gte = input.dateFrom
    if (input.dateTo) dateFilter.lte = input.dateTo
    where.date = dateFilter
  }

  const grouped = await prisma.pJtoPFBridge.groupBy({
    by: ['kind'],
    where,
    _count: { _all: true },
    _sum: { amount: true },
  })

  const byKind: BridgeSummary['byKind'] = {}
  let totalCount = 0
  let totalAmount = 0
  for (const g of grouped) {
    byKind[g.kind] = { count: g._count._all, amount: g._sum.amount ?? 0 }
    totalCount += g._count._all
    totalAmount += g._sum.amount ?? 0
  }

  return { totalCount, totalAmount, byKind }
}
