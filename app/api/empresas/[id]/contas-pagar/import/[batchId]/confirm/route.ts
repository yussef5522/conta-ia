// Sprint 5.0.2.0 — Confirma import Excel → cria Transactions PAYABLE.
//
// Body opcional: { rowOverrides?: Array<{ rowId, decision?, categoryId?, ... }> }
// Sem body: aplica decisões atuais do staging (INCLUDE → cria; EXCLUDE / NEEDS_REVIEW
// quando confidence baixo → pula).
//
// Fluxo:
//   1. Pra cada linha INCLUDE:
//      a. Resolve supplier (existente OU cria novo)
//      b. Resolve employee (existente OU cria novo)
//      c. Resolve category (existente OU cria nova com proposedCategoryName)
//      d. Cria Transaction lifecycle=PAYABLE + origin=IMPORT_EXCEL
//   2. Marca batch como CONFIRMED + importedAt
//   3. Retorna stats e summary pro banner de pós-import (Sprint 5.0.2.0)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const overrideSchema = z.object({
  rowId: z.string().cuid(),
  decision: z.enum(['INCLUDE', 'EXCLUDE']).optional(),
  categoryId: z.string().cuid().optional(),
  supplierId: z.string().cuid().optional(),
  employeeId: z.string().cuid().optional(),
})
type RowOverride = z.infer<typeof overrideSchema>

const schema = z.object({
  rowOverrides: z.array(overrideSchema).optional(),
})

interface Params {
  params: Promise<{ id: string; batchId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, batchId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const body = await request.json().catch(() => ({}))
    const parsed = schema.parse(body)
    const overridesById = new Map<string, RowOverride>()
    for (const ov of parsed.rowOverrides ?? []) {
      overridesById.set(ov.rowId, ov)
    }

    const batch = await prisma.excelImportBatch.findFirst({
      where: { id: batchId, companyId },
    })
    if (!batch) {
      return NextResponse.json({ erro: 'Batch não encontrado' }, { status: 404 })
    }
    if (batch.status === 'CONFIRMED') {
      return NextResponse.json(
        { erro: 'Batch já foi importado anteriormente' },
        { status: 409 },
      )
    }

    const rows = await prisma.stagedPayableRow.findMany({
      where: { batchId },
      orderBy: { rowIndex: 'asc' },
    })

    const t0 = Date.now()

    // Caches in-memory pra não criar duplicate Supplier/Employee/Category
    // durante o mesmo confirm
    const supplierByName = new Map<string, string>() // nome → id (criado nesta sessão)
    const employeeByName = new Map<string, string>()
    const categoryByName = new Map<string, string>()

    let createdTransactions = 0
    let createdSuppliers = 0
    let createdEmployees = 0
    let createdCategories = 0
    let skipped = 0
    let paid = 0
    let pending = 0
    let totalAmountCents = 0

    for (const row of rows) {
      const override = overridesById.get(row.id)
      const decision = override?.decision ?? row.userDecision
      if (decision === 'EXCLUDE') {
        skipped++
        continue
      }
      if (!row.rawFavorecido) {
        skipped++
        continue
      }
      // NEEDS_REVIEW sem override explícito → pula (user decide depois)
      if (decision === 'NEEDS_REVIEW' && !override?.decision) {
        skipped++
        continue
      }

      // ─── Resolve supplier OU employee ──────────────────────────────
      let supplierId: string | null = override?.supplierId ?? row.matchedSupplierId
      let employeeId: string | null = override?.employeeId ?? row.matchedEmployeeId

      if (!supplierId && !employeeId) {
        const favName = row.rawFavorecido.trim()
        if (row.favorecidoType === 'EMPLOYEE') {
          const cached = employeeByName.get(favName.toLowerCase())
          if (cached) employeeId = cached
          else {
            const created = await prisma.employee.create({
              data: {
                companyId,
                nome: favName,
                tipo: 'CLT',
                ativo: true,
              },
            })
            employeeId = created.id
            employeeByName.set(favName.toLowerCase(), created.id)
            createdEmployees++
          }
        } else {
          // SUPPLIER ou ORGAO_PUBLICO
          const cached = supplierByName.get(favName.toLowerCase())
          if (cached) supplierId = cached
          else {
            const notes =
              row.favorecidoType === 'ORGAO_PUBLICO' ? 'tipo=ORGAO_PUBLICO' : null
            const created = await prisma.supplier.create({
              data: {
                companyId,
                razaoSocial: favName,
                notes,
                isActive: true,
              },
            })
            supplierId = created.id
            supplierByName.set(favName.toLowerCase(), created.id)
            createdSuppliers++
          }
        }
      }

      // ─── Resolve category ───────────────────────────────────────────
      let categoryId: string | null = override?.categoryId ?? row.matchedCategoryId
      if (!categoryId && row.proposedCategoryName) {
        const name = row.proposedCategoryName.trim()
        const cached = categoryByName.get(name.toLowerCase())
        if (cached) categoryId = cached
        else {
          // Cria nova Category (custom user — isSystemDefault=false)
          const created = await prisma.category.create({
            data: {
              companyId,
              name,
              type: 'EXPENSE',
              dreGroup: 'OUTRAS_DESPESAS', // user pode mover depois
              isActive: true,
              isSystemDefault: false,
            },
          })
          categoryId = created.id
          categoryByName.set(name.toLowerCase(), created.id)
          createdCategories++
        }
      }

      // ─── Cria Transaction PAYABLE ──────────────────────────────────
      const isPaid = !!row.pagamento
      const txDate = row.pagamento ?? row.vencimento ?? new Date()
      await prisma.transaction.create({
        data: {
          // bankAccountId nulo enquanto PAYABLE (Sprint 4.0.1.a)
          categoryId,
          supplierId,
          employeeId,
          date: txDate,
          description: row.rawDescricao ?? row.rawFavorecido,
          amount: row.valor,
          type: 'DEBIT',
          status: isPaid ? 'RECONCILED' : 'PENDING',
          origin: 'IMPORT_EXCEL',
          lifecycle: 'PAYABLE',
          dueDate: row.vencimento,
          paymentDate: row.pagamento,
          competenceDate: row.competencia,
          notes: row.rawNota ? `NF: ${row.rawNota}` : null,
          dedupHash: row.dedupHash,
          classificationSource: 'IMPORT_EXCEL',
          aiConfidence: row.categoryConfidence,
        },
      })

      createdTransactions++
      totalAmountCents += Math.round(row.valor * 100)
      if (isPaid) paid++
      else pending++
    }

    await prisma.excelImportBatch.update({
      where: { id: batchId },
      data: { status: 'CONFIRMED', importedAt: new Date() },
    })

    // Limpa StagedPayableRows pra não inflar tabela (audit fica no batch)
    await prisma.stagedPayableRow.deleteMany({ where: { batchId } })

    const elapsedMs = Date.now() - t0
    console.log(
      `[EXCEL-CONFIRM] company=${companyId} batch=${batchId} ` +
        `txs=${createdTransactions} paid=${paid} pending=${pending} ` +
        `suppliers_new=${createdSuppliers} employees_new=${createdEmployees} ` +
        `categories_new=${createdCategories} skipped=${skipped} ` +
        `total=R$${(totalAmountCents / 100).toFixed(2)} elapsed=${elapsedMs}ms`,
    )

    return NextResponse.json({
      batchId,
      transactionsCreated: createdTransactions,
      paid,
      pending,
      suppliersCreated: createdSuppliers,
      employeesCreated: createdEmployees,
      categoriesCreated: createdCategories,
      skipped,
      totalAmount: totalAmountCents / 100,
      elapsedMs,
      // pro banner pós-import no /dashboard
      summary: {
        periodStart: batch.periodStart,
        periodEnd: batch.periodEnd,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
