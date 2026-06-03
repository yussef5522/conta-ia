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
