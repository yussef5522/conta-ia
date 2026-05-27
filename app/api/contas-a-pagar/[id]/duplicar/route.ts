// Sprint 5.0.3.0a-fix — Duplicar PAYABLE.
//
// Cria nova PAYABLE com mesmos campos da original, exceto:
//   - paymentDate = null (sempre vira pendente)
//   - status = 'PENDING'
//   - dueDate = original.dueDate + 1 mês (default — user pode editar depois)
//   - dedupHash = null (não pareia com import OFX)
//   - origin = 'MANUAL' (perde traço de IMPORT_EXCEL/OFX)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

function addOneMonth(d: Date): Date {
  const next = new Date(d)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const original = await prisma.transaction.findUnique({
      where: { id },
      include: {
        supplier: { select: { companyId: true } },
        employee: { select: { companyId: true } },
        category: { select: { companyId: true } },
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!original) {
      return NextResponse.json(
        { erro: 'Conta não encontrada', code: 'TX_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (original.lifecycle !== 'PAYABLE') {
      return NextResponse.json(
        { erro: 'Só duplicamos lifecycle=PAYABLE', code: 'NOT_PAYABLE' },
        { status: 422 },
      )
    }
    const companyId =
      original.supplier?.companyId ??
      original.employee?.companyId ??
      original.category?.companyId ??
      original.bankAccount?.companyId
    if (!companyId) {
      return NextResponse.json(
        { erro: 'Conta sem empresa identificável', code: 'NO_COMPANY' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const novaDueDate = original.dueDate
      ? addOneMonth(original.dueDate)
      : new Date()

    const nova = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          // bankAccountId fica NULL (PAYABLE pendente)
          categoryId: original.categoryId,
          supplierId: original.supplierId,
          employeeId: original.employeeId,
          date: novaDueDate,
          description: original.description,
          amount: original.amount,
          type: original.type, // DEBIT
          status: 'PENDING',
          origin: 'MANUAL',
          lifecycle: 'PAYABLE',
          dueDate: novaDueDate,
          paymentDate: null,
          competenceDate: null,
          notes: original.notes ? `${original.notes} (duplicada)` : 'duplicada',
          dedupHash: null,
          classificationSource: 'MANUAL',
        },
      })
      await logAudit(
        ctx,
        {
          action: 'CREATE',
          entityType: 'Transaction',
          entityId: created.id,
          metadata: {
            duplicatedFrom: id,
            description: created.description,
            amount: created.amount,
            source: 'contas-a-pagar duplicar',
          },
          request,
        },
        tx,
      )
      return created
    })

    return NextResponse.json({ conta: nova }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
