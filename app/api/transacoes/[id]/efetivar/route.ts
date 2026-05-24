// Sprint 4.0.1.a — Efetivar PAYABLE/RECEIVABLE (pagamento manual sem conciliar OFX).
//
// Marca lifecycle=EFFECTED + setpaymentDate + setbankAccountId.
// Atualiza balance da conta (entrada/saída efetiva). Audit log preservado.
//
// Conciliação OFX (linkar com tx OFX) é Sprint 4.0.2 — endpoint separado.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { efetivarSchema } from '@/lib/validations/contas-ap-ar'
import { buildEffectivePatch, canTransition, LifecycleValidationError, type Lifecycle } from '@/lib/lifecycle'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = efetivarSchema.parse(body)

    // Carrega tx + valida que é PAYABLE/RECEIVABLE
    const tx = await prisma.transaction.findUnique({
      where: { id },
      include: {
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    })
    if (!tx) {
      return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    }

    const currentLifecycle = tx.lifecycle as Lifecycle
    if (!canTransition(currentLifecycle, 'EFFECTED')) {
      return NextResponse.json(
        {
          erro: `Não é possível efetivar tx ${currentLifecycle} (apenas PAYABLE/RECEIVABLE)`,
        },
        { status: 422 },
      )
    }

    // Multi-tenant: resolve companyId via qualquer relação (PAYABLE pode não ter bankAccount)
    const companyId =
      tx.bankAccount?.companyId ??
      tx.supplier?.companyId ??
      tx.customer?.companyId ??
      tx.category?.companyId
    if (!companyId) {
      return NextResponse.json(
        { erro: 'Não foi possível resolver empresa da transação' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    // Valida que a conta de efetivação pertence à mesma empresa
    const bank = await prisma.bankAccount.findFirst({
      where: { id: data.bankAccountId, companyId },
      select: { id: true },
    })
    if (!bank) {
      return NextResponse.json(
        { erro: 'Conta bancária não pertence à empresa' },
        { status: 404 },
      )
    }

    let patch
    try {
      patch = buildEffectivePatch(data.paymentDate, data.bankAccountId)
    } catch (e) {
      if (e instanceof LifecycleValidationError) {
        return NextResponse.json({ erro: e.reason }, { status: 422 })
      }
      throw e
    }

    // Efetivação atômica: atualiza tx + ajusta balance
    const result = await prisma.$transaction(async (trx) => {
      const updated = await trx.transaction.update({
        where: { id },
        data: {
          ...patch,
          date: data.paymentDate, // date passa a refletir caixa real
        },
        include: {
          category: { select: { id: true, name: true, color: true } },
          supplier: { select: { id: true, razaoSocial: true } },
          customer: { select: { id: true, razaoSocial: true } },
          bankAccount: { select: { id: true, name: true, bankName: true } },
        },
      })

      // Ajusta balance: CREDIT entra, DEBIT sai
      const delta = updated.type === 'CREDIT' ? updated.amount : -updated.amount
      await trx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { balance: { increment: delta } },
      })

      await logAudit(
        ctx,
        {
          action: 'UPDATE',
          entityType: 'Transaction',
          entityId: id,
          fieldsChanged: {
            lifecycle: { before: currentLifecycle, after: 'EFFECTED' },
            paymentDate: { before: null, after: data.paymentDate.toISOString() },
            bankAccountId: { before: tx.bankAccountId, after: data.bankAccountId },
          },
          metadata: { effectivated: true, amount: updated.amount },
          request,
        },
        trx,
      )

      return updated
    })

    return NextResponse.json({ transaction: result })
  } catch (error) {
    return handleApiError(error)
  }
}
