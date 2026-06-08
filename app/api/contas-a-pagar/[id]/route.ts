// Sprint 5.0.3.0a-fix — CRUD pra PAYABLE pendente (ou paga).
//
// PATCH — edita campos (incluindo marcar/desmarcar paga via paymentDate).
// DELETE — apaga PAYABLE. Reverte saldo se bankAccount preenchido (efetivada).
//
// Multi-tenant via supplier/employee/category/bankAccount.companyId.
// Audit log em ambos.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit, diffFields } from '@/lib/audit'
import { contaAPagarUpdateSchema } from '@/lib/validations/contas-ap-ar'
import { isInPayableScope } from '@/lib/contas-pagar/lifecycle-scope'

interface Params {
  params: Promise<{ id: string }>
}

async function carregarPayable(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      bankAccount: { select: { id: true, companyId: true, balance: true } },
      supplier: { select: { id: true, companyId: true } },
      employee: { select: { id: true, companyId: true } },
      category: { select: { id: true, companyId: true } },
    },
  })
}


function resolveCompanyId(tx: {
  bankAccount?: { companyId: string } | null
  supplier?: { companyId: string } | null
  employee?: { companyId: string } | null
  category?: { companyId: string } | null
}): string | null {
  return (
    tx.supplier?.companyId ??
    tx.employee?.companyId ??
    tx.category?.companyId ??
    tx.bankAccount?.companyId ??
    null
  )
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const antiga = await carregarPayable(id)
    if (!antiga) {
      return NextResponse.json(
        { erro: 'Conta não encontrada', code: 'TX_NOT_FOUND' },
        { status: 404 },
      )
    }
    // Bug-fix 28/05/2026: aceita EFFECTED que nasceu como PAYABLE (Excel
    // isPaid ou mark_paid após backfill). Veja lib/contas-pagar/lifecycle-scope.ts
    if (!isInPayableScope(antiga)) {
      return NextResponse.json(
        {
          erro: 'Conta fora do escopo de Contas a Pagar',
          code: 'NOT_PAYABLE_SCOPE',
        },
        { status: 422 },
      )
    }
    const companyId = resolveCompanyId(antiga)
    if (!companyId) {
      return NextResponse.json(
        { erro: 'Conta sem empresa identificável', code: 'NO_COMPANY' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const data = contaAPagarUpdateSchema.parse(body)

    // Regra: limpar paymentDate quando JÁ TEM bankAccount é "desfazer efetivação"
    // — requer reverter saldo. Bloqueamos aqui pra forçar fluxo explícito
    // (UI manda chamar endpoint de desfazer efetivação dedicado, futuro).
    const limpandoPagamento =
      data.paymentDate === null && antiga.paymentDate !== null
    if (limpandoPagamento && antiga.bankAccountId) {
      return NextResponse.json(
        {
          erro:
            'Esta conta foi efetivada com saldo bancário. Use "Desfazer efetivação" pra reverter o saldo.',
          code: 'CANNOT_UNMARK_PAID_EFFECTED',
        },
        { status: 422 },
      )
    }

    // Inferir status quando paymentDate muda
    const novoStatus =
      data.paymentDate === undefined
        ? undefined
        : data.paymentDate === null
          ? 'PENDING'
          : 'RECONCILED'

    // Sprint Bug-Desmarcar-Paga (07/06/2026):
    // Quando user desmarca paga (paymentDate=null) numa tx EFFECTED que
    // NUNCA foi efetivada com banco (bankAccountId=null), revertemos o
    // lifecycle pra PAYABLE. Sem isso, a tx fica em estado órfão
    // (EFFECTED+paymentDate=null) — UI mostra "Efetivar com banco" mas o
    // endpoint /efetivar rejeita "tx EFFECTED".
    //
    // 🛡 Segurança preservada: o caso COM bankAccount já é bloqueado acima
    // (CANNOT_UNMARK_PAID_EFFECTED). Aqui só age no caso seguro sem banco.
    const revertendoLifecycle =
      data.paymentDate === null &&
      antiga.paymentDate !== null &&
      !antiga.bankAccountId &&
      antiga.lifecycle === 'EFFECTED'

    const atualizada = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
          ...(data.paymentDate !== undefined
            ? { paymentDate: data.paymentDate, date: data.paymentDate ?? antiga.date }
            : {}),
          ...(data.categoryId !== undefined
            ? { categoryId: data.categoryId }
            : {}),
          ...(data.supplierId !== undefined
            ? { supplierId: data.supplierId }
            : {}),
          ...(data.employeeId !== undefined
            ? { employeeId: data.employeeId }
            : {}),
          ...(data.bankAccountId !== undefined
            ? { bankAccountId: data.bankAccountId }
            : {}),
          ...(data.competenceDate !== undefined
            ? { competenceDate: data.competenceDate }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(novoStatus !== undefined ? { status: novoStatus } : {}),
          ...(revertendoLifecycle ? { lifecycle: 'PAYABLE' } : {}),
        },
      })

      const fieldsChanged = diffFields(
        antiga as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        [
          'description',
          'amount',
          'dueDate',
          'paymentDate',
          'categoryId',
          'supplierId',
          'employeeId',
          'bankAccountId',
          'competenceDate',
          'notes',
          'status',
          // Sprint Bug-Desmarcar-Paga (07/06/2026): rastreia reversão lifecycle
          'lifecycle',
        ],
      )

      if (fieldsChanged) {
        await logAudit(
          ctx,
          {
            action: 'UPDATE',
            entityType: 'Transaction',
            entityId: updated.id,
            fieldsChanged,
            metadata: {
              description: updated.description,
              amount: updated.amount,
              source: 'contas-a-pagar PATCH',
            },
            request,
          },
          tx,
        )
      }

      return updated
    })

    return NextResponse.json({ conta: atualizada })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const tx = await carregarPayable(id)
    if (!tx) {
      return NextResponse.json(
        { erro: 'Conta não encontrada', code: 'TX_NOT_FOUND' },
        { status: 404 },
      )
    }
    // Bug-fix 28/05/2026: aceita EFFECTED que nasceu como PAYABLE
    if (!isInPayableScope(tx)) {
      return NextResponse.json(
        {
          erro: 'Conta fora do escopo de Contas a Pagar',
          code: 'NOT_PAYABLE_SCOPE',
        },
        { status: 422 },
      )
    }
    const companyId = resolveCompanyId(tx)
    if (!companyId) {
      return NextResponse.json(
        { erro: 'Conta sem empresa identificável', code: 'NO_COMPANY' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.delete')

    // Se foi efetivada com saldo bancário, reverter saldo na exclusão
    // (DEBIT então amount FOI subtraído; reverter = somar de volta)
    const reverso =
      tx.bankAccountId && tx.paymentDate
        ? tx.type === 'CREDIT'
          ? -tx.amount
          : tx.amount
        : 0

    await prisma.$transaction(async (innerTx) => {
      await innerTx.transaction.delete({ where: { id } })
      if (reverso !== 0 && tx.bankAccountId) {
        await innerTx.bankAccount.update({
          where: { id: tx.bankAccountId },
          data: { balance: { increment: reverso } },
        })
      }
      await logAudit(
        ctx,
        {
          action: 'DELETE',
          entityType: 'Transaction',
          entityId: id,
          metadata: {
            description: tx.description,
            amount: tx.amount,
            lifecycle: tx.lifecycle,
            wasEffected: !!(tx.bankAccountId && tx.paymentDate),
            balanceReverted: reverso,
            source: 'contas-a-pagar DELETE',
          },
          request,
        },
        innerTx,
      )
    })

    return NextResponse.json({
      mensagem: 'Conta excluída',
      balanceReverted: reverso,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
