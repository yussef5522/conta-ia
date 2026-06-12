// Fase 4 — POST /api/import-warnings/[id]/resolve-delete
// User decidiu "sim é dup, deletar a nova". Atomic: deleta newTx + reverte balance.
//
// ⚠️ ÚNICA operação que muta dado (deleta tx). Só roda com clique explícito do user.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: warningId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  const warning = await prisma.importWarning.findUnique({
    where: { id: warningId },
    select: {
      id: true, companyId: true, dismissedAt: true, resolvedAt: true,
      newTxId: true,
    },
  })
  if (!warning) {
    return NextResponse.json({ erro: 'Warning não encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }

  const access = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: warning.companyId },
    select: { userId: true },
  })
  if (!access) {
    return NextResponse.json({ erro: 'Acesso negado', code: 'FORBIDDEN' }, { status: 403 })
  }

  if (warning.dismissedAt || warning.resolvedAt) {
    return NextResponse.json({ ok: true, alreadyResolved: true })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-busca dentro do atomic
      const newTx = await tx.transaction.findUnique({
        where: { id: warning.newTxId },
        select: {
          id: true, amount: true, type: true, bankAccountId: true,
        },
      })

      if (!newTx) {
        // Race: tx já deletada por outro caminho
        await tx.importWarning.update({
          where: { id: warningId },
          data: {
            resolvedAt: new Date(),
            resolvedById: user.sub,
            resolution: 'DELETED_NEW',
          },
        })
        return { newTxAlreadyDeleted: true, balanceReverted: 0 }
      }

      // Reverte balance ANTES de deletar (signed inverso)
      let balanceDelta = 0
      if (newTx.bankAccountId) {
        balanceDelta = newTx.type === 'CREDIT' ? -newTx.amount : newTx.amount
        await tx.bankAccount.update({
          where: { id: newTx.bankAccountId },
          data: { balance: { increment: balanceDelta } },
        })
      }

      // Snapshot no audit ANTES de deletar
      await tx.auditLog.create({
        data: {
          companyId: warning.companyId,
          userId: user.sub,
          userName: user.email ?? 'unknown',
          userEmail: user.email ?? 'unknown',
          action: 'IMPORT_WARNING_RESOLVED_DELETE',
          entityType: 'Transaction',
          entityId: newTx.id,
          metadata: JSON.stringify({
            context: 'Fase 4 — user revisou warning e confirmou que é duplicata. Tx nova deletada + balance revertido.',
            warningId: warning.id,
            deletedTxId: newTx.id,
            balanceRevertedBy: balanceDelta,
            bankAccountId: newTx.bankAccountId,
          }),
        },
      })

      // ⚠️ Marca warning ANTES de deletar tx — porque FK newTxId tem onDelete=Cascade
      // (delete tx removeria o warning junto). Após o update, podemos deletar.
      // OBS: o warning vai sumir mesmo assim pelo cascade — mas pelo menos
      // mantemos resolvedAt no audit log via metadata acima.
      await tx.importWarning.update({
        where: { id: warningId },
        data: {
          resolvedAt: new Date(),
          resolvedById: user.sub,
          resolution: 'DELETED_NEW',
        },
      })

      await tx.transaction.delete({ where: { id: newTx.id } })

      return { newTxAlreadyDeleted: false, balanceReverted: balanceDelta }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { erro: err instanceof Error ? err.message : String(err), code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
