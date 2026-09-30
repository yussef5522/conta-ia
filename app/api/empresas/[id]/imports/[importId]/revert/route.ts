// POST /api/empresas/[id]/imports/[importId]/revert — Sprint 2.3.
//
// Reverter um import:
//   1. Bloqueia se status != SUCCESS (já revertido ou nem foi).
//   2. Atomic transaction:
//      - delete TODAS as transações com importId = X (FK SetNull = não deleta,
//        precisamos deletar de fato pra liberar dedupHash)
//      - reverte saldo da conta (subtrai o que somou)
//      - atualiza OfxImport.status=REVERTED + revertedAt + revertedById
//   3. Mantém o registro do import (pra audit).
//
// IMPORTANTE: re-importar o mesmo OFX após revert FUNCIONA porque
// dedupHash fica livre (transações deletadas, não REVERTED).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { reAncorarContas } from '@/lib/balance/recalcular'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string; importId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, importId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.delete')

    const imp = await prisma.ofxImport.findFirst({
      where: { id: importId, bankAccount: { companyId: empresaId } },
    })
    if (!imp) {
      return NextResponse.json(
        { erro: 'Import não encontrado' },
        { status: 404 },
      )
    }

    if (imp.status === 'REVERTED') {
      return NextResponse.json(
        { erro: 'Import já está revertido' },
        { status: 409 },
      )
    }
    if (imp.status !== 'SUCCESS') {
      return NextResponse.json(
        {
          erro: `Não dá pra reverter um import com status ${imp.status}.`,
        },
        { status: 409 },
      )
    }

    // Calcula ajuste de saldo a reverter:
    // soma assinada das transações desse import.
    const transacoes = await prisma.transaction.findMany({
      where: { importId, bankAccountId: imp.bankAccountId },
      select: { id: true, amount: true, type: true, transferGroupId: true },
    })

    const transferGroupIds = Array.from(
      new Set(
        transacoes
          .map((t) => t.transferGroupId)
          .filter((g): g is string => g !== null),
      ),
    )

    /**
     * ⭐ item 4 (30/09) — a última porta. Reverter um import inteiro decrementando a soma
     * das linhas era o delta de maior alcance da casa (centenas de linhas de uma vez);
     * uma única fora da janela da âncora e o saldo ficava errado sem ninguém saber qual.
     *
     * ⚠️ Os deletes vêm ANTES da derivação, de propósito — ela lê o ledger final.
     */
    await prisma.$transaction(async (tx) => {
      // Se há transferências vinculadas, deletamos o par inteiro (preserva
      // consistência: não pode ficar "meia transferência")
      if (transferGroupIds.length > 0) {
        await tx.transaction.deleteMany({ where: { transferGroupId: { in: transferGroupIds } } })
      }
      await tx.transaction.deleteMany({ where: { importId } })
      await reAncorarContas(tx, [imp.bankAccountId])
      await tx.ofxImport.update({
        where: { id: importId },
        data: {
          status: 'REVERTED',
          revertedAt: new Date(),
          revertedById: ctx.user.id,
        },
      })
    })

    await logAudit(ctx, {
      action: 'OFX_IMPORT_REVERTED',
      entityType: 'OfxImport',
      entityId: importId,
      metadata: {
        fileName: imp.fileName,
        bankAccountId: imp.bankAccountId,
        transacoesDeletadas: transacoes.length,
        transferenciasDeletadas: transferGroupIds.length,
        // ⭐ o audit guarda o que as linhas VALIAM (o fato), não o delta aplicado no cache —
        // o cache virou derivação e não tem mais delta pra registrar.
        valorDasLinhasRemovidas: transacoes.reduce(
          (acc, t) => acc + (t.type === 'CREDIT' ? t.amount : -t.amount),
          0,
        ),
      },
      request,
    })

    return NextResponse.json({
      success: true,
      transacoesDeletadas: transacoes.length,
      transferenciasDeletadas: transferGroupIds.length,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
