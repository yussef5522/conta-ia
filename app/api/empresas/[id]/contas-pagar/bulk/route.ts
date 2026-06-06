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
      // Bug-fix 28/05/2026: aceita PAYABLE OR EFFECTED-que-nasceu-PAYABLE.
      // Mas mark_paid SÓ deve operar sobre PAYABLE (validation depois detecta).
      OR: [
        { supplier: { companyId: empresaId } },
        { employee: { companyId: empresaId } },
        { category: { companyId: empresaId } },
        { bankAccount: { companyId: empresaId } },
      ],
      AND: {
        OR: [
          { lifecycle: 'PAYABLE' },
          {
            lifecycle: 'EFFECTED',
            dueDate: { not: null },
            type: 'DEBIT',
            reconciledWithId: null,
          },
        ],
      },
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

      // Sprint Caixa — Validação de conta de pagamento (opcional).
      // Se passada, valida que pertence à empresa, calcula saldo necessário
      // e (se conta com trava `allowNegativeBalance=false`) bloqueia se
      // estouraria. Aplica também a conta CASH automaticamente.
      const allowedTxs = found.filter((t) => validation.allowed.includes(t.id))
      let payAccount: {
        id: string
        balance: number
        accountType: string
        allowNegativeBalance: boolean
        creditLimit: number
        companyId: string
      } | null = null
      if (parsed.bankAccountId) {
        payAccount = await prisma.bankAccount.findUnique({
          where: { id: parsed.bankAccountId },
          select: {
            id: true,
            balance: true,
            accountType: true,
            allowNegativeBalance: true,
            creditLimit: true,
            companyId: true,
          },
        })
        if (!payAccount || payAccount.companyId !== empresaId) {
          return NextResponse.json(
            { erro: 'Conta de pagamento não encontrada nesta empresa', code: 'PAY_ACCOUNT_NOT_FOUND' },
            { status: 404 },
          )
        }
        // Soma de TODAS as despesas (DEBIT) a sair desta conta
        const totalDebit = allowedTxs
          .filter((t) => t.type === 'DEBIT')
          .reduce((s, t) => s + t.amount, 0)
        const projected = payAccount.balance - totalDebit
        const floor = payAccount.allowNegativeBalance ? -payAccount.creditLimit : 0
        if (projected < floor - 0.005) {
          const isCash = payAccount.accountType === 'CASH'
          return NextResponse.json(
            {
              erro: isCash
                ? `Caixa não tem dinheiro suficiente. Saldo atual: ${payAccount.balance.toFixed(2)} · A pagar: ${totalDebit.toFixed(2)} (resultaria em ${projected.toFixed(2)})`
                : `Pagamento estouraria o limite. Saldo após: ${projected.toFixed(2)} · Mínimo permitido: ${floor.toFixed(2)}`,
              code: isCash ? 'CASH_INSUFFICIENT' : 'BALANCE_EXCEEDED',
              projectedBalance: projected,
              floor,
            },
            { status: 422 },
          )
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const updateData: {
          paymentDate: Date
          status: string
          date: Date
          lifecycle: string
          bankAccountId?: string
        } = {
          paymentDate: parsed.paymentDate,
          status: 'RECONCILED',
          date: parsed.paymentDate,
          // Bug-fix 28/05/2026: transição PAYABLE → EFFECTED ao marcar como
          // paga. Antes mantinha PAYABLE+paymentDate (inválido per
          // lib/lifecycle/index.ts:60-69 e invisível aos relatórios).
          // Veja docs/sprints/bug-despesas-relatorios-audit.md.
          lifecycle: 'EFFECTED',
        }
        if (payAccount) updateData.bankAccountId = payAccount.id

        await tx.transaction.updateMany({
          where: { id: { in: validation.allowed } },
          data: updateData,
        })

        // Sprint Caixa — Atualiza balance da conta de pagamento
        if (payAccount) {
          const delta = allowedTxs.reduce(
            (s, t) => s + (t.type === 'DEBIT' ? -t.amount : t.amount),
            0,
          )
          if (delta !== 0) {
            await tx.bankAccount.update({
              where: { id: payAccount.id },
              data: { balance: { increment: delta } },
            })
          }
        }

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
              ...(payAccount
                ? {
                    payBankAccountId: payAccount.id,
                    payAccountType: payAccount.accountType,
                  }
                : {}),
            },
            request,
          },
          tx,
        )
        return { updated: validation.allowed.length }
      })

      console.log(
        `[BULK-MARK-PAID] empresa=${empresaId} count=${result.updated} ` +
          `paymentDate=${parsed.paymentDate.toISOString().slice(0, 10)}` +
          (payAccount ? ` payAccount=${payAccount.id} (${payAccount.accountType})` : ''),
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
