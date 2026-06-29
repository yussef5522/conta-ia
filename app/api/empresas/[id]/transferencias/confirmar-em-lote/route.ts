// Sprint Transferências Redesign (28/06/2026).
//
// POST /api/empresas/[id]/transferencias/confirmar-em-lote
// Body: { txIds: string[] }
//
// Recebe lista de IDs de tx em pendingTransfer que TÊM sugestão de par
// SEGURA (alta confiança). Pra cada uma, busca a melhor sugestão (mesma
// lógica do endpoint /aguardando-par GET) e dispara o pareamento via
// classifyTransferPair. Idempotente: pula tx já pareadas.
//
// SEGURANÇA: o endpoint só age sobre os IDs explicitamente passados. O
// UI envia só os IDs com sinal de match seguro (mesmo dia, valor exato,
// ambas PJ — calculado client-side via dashboard-summary + aguardando-par).
//
// Reusa toda a logica de classifyTransferPair (Sprint Account Kind PJ/PF).

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { classifyTransferPair, normalizeAccountKind } from '@/lib/accounts/kind'

interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({
  pares: z
    .array(
      z.object({
        txId: z.string().cuid(),
        pairTxId: z.string().cuid(),
      }),
    )
    .min(1)
    .max(50),
})

const AMOUNT_TOL = 0.01

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const body = bodySchema.parse(await request.json())

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    // Pre-load categorias equity (1 query) pra casos PJ+PF
    const equityCats = await prisma.category.findMany({
      where: {
        companyId: empresaId,
        isActive: true,
        OR: [
          { name: 'Aporte de Capital', dreGroup: 'APORTES_CAPITAL' },
          { name: 'Retirada de Lucros / Pró-labore', dreGroup: 'DISTRIBUICAO_LUCROS' },
        ],
      },
      select: { id: true, dreGroup: true },
    })
    const aporteId = equityCats.find((c) => c.dreGroup === 'APORTES_CAPITAL')?.id ?? null
    const retiradaId = equityCats.find((c) => c.dreGroup === 'DISTRIBUICAO_LUCROS')?.id ?? null

    const results = {
      paired: 0,
      skipped: 0,
      failed: [] as Array<{ txId: string; pairTxId: string; reason: string }>,
    }

    for (const par of body.pares) {
      try {
        const [pending, pair] = await prisma.$transaction([
          prisma.transaction.findUnique({
            where: { id: par.txId },
            select: {
              id: true,
              type: true,
              amount: true,
              date: true,
              pendingTransfer: true,
              transferGroupId: true,
              bankAccountId: true,
              notes: true,
              bankAccount: { select: { companyId: true, accountKind: true } },
            },
          }),
          prisma.transaction.findUnique({
            where: { id: par.pairTxId },
            select: {
              id: true,
              type: true,
              amount: true,
              date: true,
              pendingTransfer: true,
              transferGroupId: true,
              bankAccountId: true,
              categoryId: true,
              notes: true,
              bankAccount: { select: { companyId: true, accountKind: true } },
            },
          }),
        ])

        // Validações (mesmo guard do /pair single)
        if (!pending || !pair || !pending.bankAccount || !pair.bankAccount) {
          results.failed.push({ ...par, reason: 'tx não encontrada' })
          continue
        }
        if (pending.bankAccount.companyId !== empresaId || pair.bankAccount.companyId !== empresaId) {
          results.failed.push({ ...par, reason: 'cross-empresa' })
          continue
        }
        if (pending.bankAccountId === pair.bankAccountId) {
          results.failed.push({ ...par, reason: 'mesma conta' })
          continue
        }
        if (Math.abs(pending.amount - pair.amount) > AMOUNT_TOL) {
          results.failed.push({ ...par, reason: 'valores diferentes' })
          continue
        }
        const opposite =
          (pending.type === 'DEBIT' && pair.type === 'CREDIT') ||
          (pending.type === 'CREDIT' && pair.type === 'DEBIT')
        if (!opposite) {
          results.failed.push({ ...par, reason: 'sinais não opostos' })
          continue
        }
        if (!pending.pendingTransfer) {
          results.skipped += 1
          continue
        }
        if (pending.transferGroupId || pair.transferGroupId) {
          results.skipped += 1
          continue
        }

        const pendingKind = normalizeAccountKind(pending.bankAccount.accountKind)
        const pairKind = normalizeAccountKind(pair.bankAccount.accountKind)
        const classification = classifyTransferPair(
          pendingKind,
          pending.type as 'DEBIT' | 'CREDIT',
          pairKind,
        )

        if (classification.kind === 'OUT_OF_SCOPE') {
          results.skipped += 1
          continue
        }

        if (classification.kind === 'TRANSFER_INTERNAL') {
          const pendingDirection: 'IN' | 'OUT' = pending.type === 'DEBIT' ? 'OUT' : 'IN'
          const pairDirection: 'IN' | 'OUT' = pair.type === 'DEBIT' ? 'OUT' : 'IN'
          const groupId = crypto.randomUUID()
          await prisma.$transaction(async (tx) => {
            await tx.transaction.update({
              where: { id: pending.id },
              data: {
                type: 'TRANSFER',
                transferGroupId: groupId,
                transferDirection: pendingDirection,
                status: 'RECONCILED',
                pendingTransfer: false,
                pendingTransferDirection: null,
                pendingTransferSince: null,
                notes: pending.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() || null,
              },
            })
            await tx.transaction.update({
              where: { id: pair.id },
              data: {
                type: 'TRANSFER',
                transferGroupId: groupId,
                transferDirection: pairDirection,
                status: 'RECONCILED',
                pendingTransfer: false,
                pendingTransferDirection: null,
                pendingTransferSince: null,
                categoryId: null,
                notes: pair.notes?.replace('[V3:AGUARDANDO_PAR_TRANSFERENCIA]', '').trim() || null,
              },
            })
          })
          results.paired += 1
          continue
        }

        // PJ + PF: equity
        const equityCatId =
          classification.kind === 'APORTE_CAPITAL' ? aporteId : retiradaId
        if (!equityCatId) {
          results.failed.push({ ...par, reason: 'categoria equity ausente' })
          continue
        }
        await prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: pending.id },
            data: {
              categoryId: equityCatId,
              status: 'RECONCILED',
              cashCoded: true,
              cashCodedAt: new Date(),
              pendingTransfer: false,
              pendingTransferDirection: null,
              pendingTransferSince: null,
              notes: `[PJ↔PF:${classification.kind}]`,
            },
          })
          await tx.transaction.update({
            where: { id: pair.id },
            data: {
              categoryId: equityCatId,
              status: 'RECONCILED',
              cashCoded: true,
              cashCodedAt: new Date(),
              pendingTransfer: false,
              pendingTransferDirection: null,
              pendingTransferSince: null,
              notes: `[PJ↔PF:${classification.kind}]`,
            },
          })
        })
        results.paired += 1
      } catch (err) {
        results.failed.push({
          ...par,
          reason: err instanceof Error ? err.message : 'erro desconhecido',
        })
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    return handleApiError(error)
  }
}
