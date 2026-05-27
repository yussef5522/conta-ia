// Sprint 5.0.3.0b — Bulk actions sobre PAYABLE (mark_paid + delete).
//
// POST body:
//   { action: 'mark_paid', transactionIds: string[], paymentDate: ISO }
//   { action: 'delete',    transactionIds: string[] }
//
// Multi-tenant: cada transactionId precisa pertencer a `companyId` via
// supplier/employee/category/bankAccount.companyId.
//
// mark_paid: rejeita 422 se ANY conta já foi efetivada com banco
// (semântica all-or-nothing — caller resolve).
//
// delete: permite tudo; se efetivada com banco, reverte saldo.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'
import {
  bulkActionSchema,
  validateBulkMarkPaid,
  blockedMessage,
} from '@/lib/contas-pagar/bulk-actions'

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Carrega as N transactions com escopo da empresa via OR join.
 * Retorna `{ found, missing }` — IDs que não foram encontrados (ou não
 * pertencem à empresa) ficam em `missing` pra mensagem clara.
 */
async function loadOwnedTxs(
  ids: string[],
  empresaId: string,
): Promise<{
  found: Array<{
    id: string
    bankAccountId: string | null
    paymentDate: Date | null
    amount: number
    type: string
    description: string
    lifecycle: string
  }>
  missing: string[]
}> {
  const txs = await prisma.transaction.findMany({
    where: {
      id: { in: ids },
      lifecycle: 'PAYABLE',
      OR: [
        { supplier: { companyId: empresaId } },
        { employee: { companyId: empresaId } },
        { category: { companyId: empresaId } },
        { bankAccount: { companyId: empresaId } },
      ],
    },
    select: {
      id: true,
      bankAccountId: true,
      paymentDate: true,
      amount: true,
      type: true,
      description: true,
      lifecycle: true,
    },
  })
  const foundIds = new Set(txs.map((t) => t.id))
  const missing = ids.filter((id) => !foundIds.has(id))
  return { found: txs, missing }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    const body = await request.json()
    const parsed = bulkActionSchema.parse(body)

    // Permission por ação (transaction.update / transaction.delete)
    ctx.requirePermission(
      parsed.action === 'delete' ? 'transaction.delete' : 'transaction.update',
    )

    const { found, missing } = await loadOwnedTxs(
      parsed.transactionIds,
      empresaId,
    )

    if (missing.length > 0) {
      return NextResponse.json(
        {
          erro: `${missing.length} contas não encontradas ou não pertencem a esta empresa`,
          code: 'BULK_MISSING_TXS',
          missingIds: missing,
        },
        { status: 404 },
      )
    }

    // ──── mark_paid ─────────────────────────────────────────────────────
    if (parsed.action === 'mark_paid') {
      const validation = validateBulkMarkPaid(found)
      if (validation.blocked.length > 0) {
        return NextResponse.json(
          {
            erro: blockedMessage(validation.blocked.length, found.length),
            code: 'BULK_BLOCKED_BY_EFFECTED',
            blockedTransactionIds: validation.blocked,
          },
          { status: 422 },
        )
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.transaction.updateMany({
          where: { id: { in: validation.allowed } },
          data: {
            paymentDate: parsed.paymentDate,
            status: 'RECONCILED',
            date: parsed.paymentDate,
          },
        })
        await logAudit(
          ctx,
          {
            action: 'UPDATE',
            entityType: 'Transaction',
            entityId: validation.allowed[0], // representative
            metadata: {
              bulkAction: 'mark_paid',
              count: validation.allowed.length,
              ids: validation.allowed,
              paymentDate: parsed.paymentDate.toISOString(),
            },
            request,
          },
          tx,
        )
        return { updated: validation.allowed.length }
      })

      console.log(
        `[BULK-MARK-PAID] empresa=${empresaId} count=${result.updated} ` +
          `paymentDate=${parsed.paymentDate.toISOString().slice(0, 10)}`,
      )

      return NextResponse.json({
        success: result.updated,
        action: 'mark_paid',
      })
    }

    // ──── delete ────────────────────────────────────────────────────────
    if (parsed.action === 'delete') {
      const result = await prisma.$transaction(async (tx) => {
        // Calcula reverso por bankAccount agregado
        const reverseByBank = new Map<string, number>()
        for (const t of found) {
          if (t.bankAccountId && t.paymentDate) {
            // Foi efetivada — reverter saldo
            const delta = t.type === 'CREDIT' ? -t.amount : t.amount
            reverseByBank.set(
              t.bankAccountId,
              (reverseByBank.get(t.bankAccountId) ?? 0) + delta,
            )
          }
        }

        await tx.transaction.deleteMany({
          where: { id: { in: found.map((t) => t.id) } },
        })

        for (const [bankId, delta] of reverseByBank) {
          if (delta === 0) continue
          await tx.bankAccount.update({
            where: { id: bankId },
            data: { balance: { increment: delta } },
          })
        }

        await logAudit(
          ctx,
          {
            action: 'DELETE',
            entityType: 'Transaction',
            entityId: found[0].id,
            metadata: {
              bulkAction: 'delete',
              count: found.length,
              ids: found.map((t) => t.id),
              balanceRevertedByBank: Object.fromEntries(reverseByBank),
            },
            request,
          },
          tx,
        )

        return { deleted: found.length }
      })

      console.log(
        `[BULK-DELETE] empresa=${empresaId} count=${result.deleted}`,
      )

      return NextResponse.json({
        success: result.deleted,
        action: 'delete',
      })
    }

    // unreachable — Zod já validou
    return NextResponse.json({ erro: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    return handleApiError(error)
  }
}
