// Sprint 5.0.2.p — Aplica seleção do preview de Auto-categorizar.
//
// Body:
//   {
//     items: [
//       { transactionId, categoryId, source, linkedTransactionId?,
//         relatedPartyType?, relatedPartyId? }
//     ]
//   }
//
// Roda updateMany agrupado por categoryId pra performance. PIX_DETECTION e
// SAME_COMPANY_TRANSFER têm tx pareada que também precisa update — passamos
// linkedTransactionId no item.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const itemSchema = z.object({
  transactionId: z.string().cuid(),
  categoryId: z.string().cuid(),
  source: z
    .enum([
      'SAME_COMPANY_TRANSFER',
      'PIX_DETECTION',
      'RULE_EXACT_NORMALIZED',
      'RULE_CONTAINS',
      'SETOR_PATTERN',
    ])
    .optional(),
  linkedTransactionId: z.string().cuid().optional(),
  relatedPartyType: z.string().optional(),
  relatedPartyId: z.string().optional(),
})

const bodySchema = z.object({
  items: z.array(itemSchema).max(3000),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const { items } = bodySchema.parse(await request.json())
    if (items.length === 0) {
      return NextResponse.json({ aplicadas: 0, mensagem: 'Nenhuma seleção' })
    }

    const t0 = Date.now()

    // Defesa multi-tenant: confere que todas as tx pertencem à empresa
    const txIds = Array.from(
      new Set(
        items
          .flatMap((i) => [i.transactionId, i.linkedTransactionId ?? null])
          .filter((x): x is string => x !== null),
      ),
    )
    const owned = await prisma.transaction.findMany({
      where: {
        id: { in: txIds },
        bankAccount: { companyId },
      },
      select: { id: true },
    })
    const ownedSet = new Set(owned.map((t) => t.id))

    // Filtra apenas items cuja tx-base é da empresa
    const validItems = items.filter((i) => ownedSet.has(i.transactionId))

    // Agrupa por (categoryId, source) pra updateMany batch
    type Group = {
      categoryId: string
      source: string | null
      classificationSource: string
      txIds: string[]
    }
    const groups = new Map<string, Group>()
    for (const item of validItems) {
      const key = `${item.categoryId}|${item.source ?? ''}`
      const classificationSource = sourceToClassificationSource(item.source)
      if (!groups.has(key)) {
        groups.set(key, {
          categoryId: item.categoryId,
          source: item.source ?? null,
          classificationSource,
          txIds: [],
        })
      }
      groups.get(key)!.txIds.push(item.transactionId)
      // Adiciona tx pareada (Pix/Same-company) ao mesmo update
      if (item.linkedTransactionId && ownedSet.has(item.linkedTransactionId)) {
        groups.get(key)!.txIds.push(item.linkedTransactionId)
      }
    }

    let aplicadas = 0
    const breakdownPorFonte: Record<string, number> = {}

    for (const g of groups.values()) {
      const r = await prisma.transaction.updateMany({
        where: {
          id: { in: Array.from(new Set(g.txIds)) },
          bankAccount: { companyId },
        },
        data: {
          categoryId: g.categoryId,
          status: 'RECONCILED',
          classificationSource: g.classificationSource,
          aiConfidence: 1.0,
        },
      })
      aplicadas += r.count
      const k = g.source ?? 'OTHER'
      breakdownPorFonte[k] = (breakdownPorFonte[k] ?? 0) + r.count
    }

    // PIX_DETECTION também grava relatedPartyType/Id na tx-base
    // (em sequência separada pra não inflar o updateMany acima)
    for (const item of validItems) {
      if (item.source === 'PIX_DETECTION' && item.relatedPartyType && item.relatedPartyId) {
        await prisma.transaction.update({
          where: { id: item.transactionId },
          data: {
            relatedPartyType: item.relatedPartyType,
            relatedPartyId: item.relatedPartyId,
          },
        })
      }
    }

    const elapsedMs = Date.now() - t0
    console.log(
      `[AUTO-CATEGORIZE-APPLY] company=${companyId} items=${items.length} ` +
        `aplicadas=${aplicadas} elapsed=${elapsedMs}ms breakdown=${JSON.stringify(breakdownPorFonte)}`,
    )

    return NextResponse.json({
      aplicadas,
      breakdownPorFonte,
      elapsedMs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function sourceToClassificationSource(source: string | null | undefined): string {
  switch (source) {
    case 'SAME_COMPANY_TRANSFER':
      return 'AI'
    case 'PIX_DETECTION':
      return 'AI'
    case 'RULE_EXACT_NORMALIZED':
    case 'RULE_CONTAINS':
      return 'RULE'
    case 'SETOR_PATTERN':
      return 'SETOR_PATTERN'
    default:
      return 'MANUAL'
  }
}
