// POST /api/empresas/[id]/transferencias/sugestoes/confirmar
// Body: { fromTxId, toTxId }
//
// Confirma um par sugerido pela varredura retroativa. Atualiza as 2 tx
// existentes pra type=TRANSFER + mesmo transferGroupId (não deleta, não
// cria — preserva ID/audit das tx originais).

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  fromTxId: z.string().cuid(),
  toTxId: z.string().cuid(),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const { fromTxId, toTxId } = schema.parse(body)

    const [fromTx, toTx] = await Promise.all([
      prisma.transaction.findUnique({
        where: { id: fromTxId },
        include: {
          bankAccount: { select: { id: true, companyId: true, name: true } },
        },
      }),
      prisma.transaction.findUnique({
        where: { id: toTxId },
        include: {
          bankAccount: { select: { id: true, companyId: true, name: true } },
        },
      }),
    ])

    if (!fromTx || !toTx) {
      return NextResponse.json(
        { erro: 'Transação não encontrada', code: 'TX_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (
      fromTx.bankAccount?.companyId !== empresaId ||
      toTx.bankAccount?.companyId !== empresaId
    ) {
      return NextResponse.json(
        { erro: 'Transação de outra empresa', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }
    if (fromTx.transferGroupId || toTx.transferGroupId) {
      return NextResponse.json(
        {
          erro: 'Uma das transações já está pareada como transferência',
          code: 'ALREADY_PAIRED',
        },
        { status: 409 },
      )
    }
    if (fromTx.type !== 'DEBIT' || toTx.type !== 'CREDIT') {
      return NextResponse.json(
        {
          erro: 'fromTx precisa ser DEBIT (saída) e toTx CREDIT (entrada)',
          code: 'INVALID_DIRECTION',
        },
        { status: 400 },
      )
    }
    if (Math.abs(fromTx.amount - toTx.amount) > 0.015) {
      return NextResponse.json(
        { erro: 'Valores diferentes', code: 'AMOUNT_MISMATCH' },
        { status: 400 },
      )
    }
    if (fromTx.bankAccount.id === toTx.bankAccount.id) {
      return NextResponse.json(
        { erro: 'Mesma conta — não pode ser transferência interna', code: 'SAME_ACCOUNT' },
        { status: 400 },
      )
    }

    const groupId = randomUUID()
    const fromAccountName = fromTx.bankAccount!.name
    const toAccountName = toTx.bankAccount!.name

    await prisma.$transaction(async (tx) => {
      // Atualiza as 2 tx pra TRANSFER + mesmo groupId.
      // NÃO toca em amount/date/description/bankAccountId — preserva tudo.
      // Limpa categoryId pra não confundir (transferências não têm categoria).
      await tx.transaction.update({
        where: { id: fromTx.id },
        data: {
          type: 'TRANSFER',
          transferGroupId: groupId,
          categoryId: null,
        },
      })
      await tx.transaction.update({
        where: { id: toTx.id },
        data: {
          type: 'TRANSFER',
          transferGroupId: groupId,
          categoryId: null,
        },
      })
    })

    // Audit fora da $transaction (best-effort — failure não rollback o par)
    void logAudit(ctx, {
      action: 'CREATE',
      entityType: 'Transfer',
      entityId: groupId,
      fieldsChanged: {
        type: { before: 'DEBIT/CREDIT', after: 'TRANSFER' },
        transferGroupId: { before: null, after: groupId },
      },
      metadata: {
        mode: 'RETROACTIVE_CONFIRM',
        fromTxId: fromTx.id,
        toTxId: toTx.id,
        fromAccount: fromAccountName,
        toAccount: toAccountName,
        amount: fromTx.amount,
        date: fromTx.date.toISOString(),
      },
    })

    return NextResponse.json({
      ok: true,
      transferGroupId: groupId,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
