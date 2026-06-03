// Sprint Unificar Sócios — agregador SocioPF + pontes privadas + tx Pix detectadas.
//
// 🔒 PRIVACIDADE:
// - SocioPF + tx Pix detectadas = público (todos da empresa veem)
// - Pontes + agregados = filtrados por owned_by_user (decisão A Fatia 4)
//
// Cache 60s. Chave inclui userId pra não vazar entre sócios.

import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { getUserOwnedProfileIds } from '@/lib/bridges/queries'
import type { BridgeListItem } from '@/lib/bridges/types'

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  throw err
}

interface DetectedTx {
  id: string
  date: Date
  description: string
  amount: number
  bankAccountName: string | null
  hasBridge: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; socioId: string }> },
) {
  try {
    const { id: companyId, socioId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const userId = ctx.user.id

    const cached = unstable_cache(
      async () => {
        // Sócio (público — qualquer um da empresa que tem transaction.view vê)
        const socio = await prisma.socioPF.findFirst({
          where: { id: socioId, companyId },
        })
        if (!socio) return null

        // Pontes filtradas (privacidade decisão A): só perfis do user
        // E só pontes ligadas a esse socioPF específico (socioPFId match).
        const ownedProfileIds = await getUserOwnedProfileIds(userId)
        let bridges: BridgeListItem[] = []
        let totalCount = 0
        let totalAmount = 0
        const byKind: Record<string, { count: number; amount: number }> = {}

        if (ownedProfileIds.length > 0) {
          const rawBridges = await prisma.pJtoPFBridge.findMany({
            where: {
              companyId,
              socioPFId: socioId,
              profileId: { in: ownedProfileIds },
            },
            orderBy: { date: 'desc' },
            take: 100,
            include: {
              company: { select: { name: true } },
              profile: { select: { name: true } },
              socioPF: { select: { nome: true } },
              pjTransaction: {
                select: { id: true, bankAccount: { select: { name: true } } },
              },
              pfTransaction: {
                select: { id: true, bankAccount: { select: { name: true } } },
              },
            },
          })

          bridges = rawBridges.map((b) => ({
            id: b.id,
            kind: b.kind as BridgeListItem['kind'],
            amount: b.amount,
            date: b.date,
            createdVia: b.createdVia as BridgeListItem['createdVia'],
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

          totalCount = bridges.length
          totalAmount = bridges.reduce((s, b) => s + b.amount, 0)
          for (const b of bridges) {
            byKind[b.kind] = byKind[b.kind] ?? { count: 0, amount: 0 }
            byKind[b.kind].count++
            byKind[b.kind].amount += b.amount
          }
        }

        // Tx Pix detectadas (público — mesma info que /transacoes mostra)
        const detectedTxs = await prisma.transaction.findMany({
          where: {
            bankAccount: { companyId },
            relatedPartyType: 'SOCIO_PF',
            relatedPartyId: socioId,
            type: 'DEBIT',
          },
          select: {
            id: true,
            date: true,
            description: true,
            amount: true,
            bankAccount: { select: { name: true } },
            bridge: { select: { id: true } },
          },
          orderBy: { date: 'desc' },
          take: 50,
        })

        const txPixDetected: DetectedTx[] = detectedTxs.map((t) => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          bankAccountName: t.bankAccount?.name ?? null,
          hasBridge: t.bridge !== null,
        }))

        return {
          socio: {
            id: socio.id,
            nome: socio.nome,
            cpf: socio.cpf,
            papel: socio.papel,
            pixKeys: socio.pixKeys,
            createdAt: socio.createdAt,
          },
          suasPontes: bridges,
          agregados: {
            totalCount,
            totalAmount,
            byKind,
          },
          txPixDetected,
        }
      },
      [`socio-aggregated-${companyId}-${socioId}-${userId}`],
      { revalidate: 60, tags: [`socio-aggregated:${companyId}:${socioId}`] },
    )

    const data = await cached()
    if (!data) {
      return NextResponse.json({ erro: 'Sócio não encontrado' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}

// Marker: força revalidate quando bridge é criada/deletada — futura.
export type SocioAggregatedResponse = {
  socio: {
    id: string
    nome: string
    cpf: string | null
    papel: string
    pixKeys: string
    createdAt: Date
  }
  suasPontes: BridgeListItem[]
  agregados: {
    totalCount: number
    totalAmount: number
    byKind: Record<string, { count: number; amount: number }>
  }
  txPixDetected: DetectedTx[]
}
