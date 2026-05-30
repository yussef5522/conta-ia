// Sprint 5.0.2.0 + 5.0.2.3 — Confirma import Excel → cria Transactions PAYABLE.
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
//   3. Retorna stats e summary pro banner de pós-import
//
// Sprint 5.0.2.3 — Atomicidade e idempotência:
//   * Tudo dentro de `prisma.$transaction()` com timeout 120s. Rollback completo
//     se algum erro NÃO-recuperável surgir (não deixa Supplier/Employee/Category
//     órfãos se falhar no Transaction.create).
//   * `P2002` (unique constraint) em `Transaction.create` → skip por duplicata
//     (incrementa `duplicateSkipped`) sem matar o batch. Acontece quando:
//     - Linha do batch tem dedupHash idêntico a transação já criada (re-confirm
//       após falha parcial)
//     - 2 linhas legítimas da planilha colidem em dedupHash (ex: 2 boletos
//       de aluguel iguais)
//     - Race / NULLS NOT DISTINCT inesperado
//   * Outras Prisma errors → rethrow → rollback completo.
//   * Retorno discrimina: created, duplicateSkipped, needsReviewSkipped,
//     excludedSkipped, noFavorecidoSkipped → UI mostra mensagem precisa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  decideRowAction,
  isUniqueConstraintError,
} from '@/lib/excel-import/decide-row-action'

// Sprint 5.0.2.3 — Node runtime + 60s timeout (loop pode demorar pra 5000 linhas)
export const runtime = 'nodejs'
export const maxDuration = 60

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

// Tempo limite generoso pra batches grandes (5000 linhas).
// Cada Transaction.create + maybe Supplier/Employee/Category create
// gira em torno de 5-15ms; 5000×15ms = 75s, com folga 120s.
const TX_TIMEOUT_MS = 120_000
const TX_MAX_WAIT_MS = 10_000

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
      return NextResponse.json(
        { erro: 'Batch não encontrado', code: 'BATCH_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (batch.status === 'CONFIRMED') {
      return NextResponse.json(
        {
          erro: 'Batch já foi importado anteriormente',
          code: 'BATCH_ALREADY_CONFIRMED',
        },
        { status: 409 },
      )
    }

    const rows = await prisma.stagedPayableRow.findMany({
      where: { batchId },
      orderBy: { rowIndex: 'asc' },
    })

    const t0 = Date.now()

    // ─── Wrap completo em $transaction pra rollback atômico ──────────────
    const result = await prisma.$transaction(
      async (tx) => {
        // Caches in-memory pra não criar Supplier/Employee/Category duplicado
        // dentro do mesmo confirm. Mapa nome lowercase → id.
        const supplierByName = new Map<string, string>()
        const employeeByName = new Map<string, string>()
        const categoryByName = new Map<string, string>()

        let createdTransactions = 0
        let createdSuppliers = 0
        let createdEmployees = 0
        let createdCategories = 0
        // Skips discriminados (5.0.2.3) — UI mostra detalhe humano
        let duplicateSkipped = 0
        let needsReviewSkipped = 0
        let excludedSkipped = 0
        let noFavorecidoSkipped = 0
        let paid = 0
        let pending = 0
        let totalAmountCents = 0

        for (const row of rows) {
          const override = overridesById.get(row.id)
          const action = decideRowAction(row, override)
          if (action.kind === 'SKIP_EXCLUDED') {
            excludedSkipped++
            continue
          }
          if (action.kind === 'SKIP_NO_FAVORECIDO') {
            noFavorecidoSkipped++
            continue
          }
          if (action.kind === 'SKIP_NEEDS_REVIEW') {
            needsReviewSkipped++
            continue
          }
          // action.kind === 'PROCEED' — segue criando supplier/employee/category/tx
          // rawFavorecido garantido não-nulo por decideRowAction.

          // ─── Resolve supplier OU employee ──────────────────────────────
          let supplierId: string | null =
            override?.supplierId ?? row.matchedSupplierId
          let employeeId: string | null =
            override?.employeeId ?? row.matchedEmployeeId

          if (!supplierId && !employeeId) {
            // rawFavorecido garantido não-vazio pelo decideRowAction acima
            const favName = (row.rawFavorecido as string).trim()
            const cacheKey = favName.toLowerCase()
            if (row.favorecidoType === 'EMPLOYEE') {
              const cached = employeeByName.get(cacheKey)
              if (cached) employeeId = cached
              else {
                const created = await tx.employee.create({
                  data: {
                    companyId,
                    nome: favName,
                    tipo: 'CLT',
                    ativo: true,
                  },
                })
                employeeId = created.id
                employeeByName.set(cacheKey, created.id)
                createdEmployees++
              }
            } else {
              // SUPPLIER ou ORGAO_PUBLICO
              const cached = supplierByName.get(cacheKey)
              if (cached) supplierId = cached
              else {
                const notes =
                  row.favorecidoType === 'ORGAO_PUBLICO'
                    ? 'tipo=ORGAO_PUBLICO'
                    : null
                const created = await tx.supplier.create({
                  data: {
                    companyId,
                    razaoSocial: favName,
                    notes,
                    isActive: true,
                  },
                })
                supplierId = created.id
                supplierByName.set(cacheKey, created.id)
                createdSuppliers++
              }
            }
          }

          // ─── Resolve category ─────────────────────────────────────────
          let categoryId: string | null =
            override?.categoryId ?? row.matchedCategoryId
          if (!categoryId && row.proposedCategoryName) {
            const name = row.proposedCategoryName.trim()
            const cached = categoryByName.get(name.toLowerCase())
            if (cached) categoryId = cached
            else {
              const created = await tx.category.create({
                data: {
                  companyId,
                  name,
                  type: 'EXPENSE',
                  dreGroup: 'OUTRAS_DESPESAS',
                  isActive: true,
                  isSystemDefault: false,
                },
              })
              categoryId = created.id
              categoryByName.set(name.toLowerCase(), created.id)
              createdCategories++
            }
          }

          // ─── Cria Transaction (com try/catch P2002) ────────────────────
          // Bug-fix 28/05/2026: linhas com pagamento já realizado (paymentDate)
          // viram EFFECTED imediatamente. Antes ficavam PAYABLE+paymentDate,
          // estado que VIOLA lib/lifecycle/index.ts:60-69 e fica invisível aos
          // relatórios (que filtram lifecycle='EFFECTED'). Veja
          // docs/sprints/bug-despesas-relatorios-audit.md.
          //
          // Sprint CSV Import (30/05/2026): se a linha tem lifecycle preenchido
          // (CACULA fast-path já decidiu + validateLifecycleState validou no
          // upload), respeitamos. Senão, lógica antiga via row.pagamento.
          const lifecycle: 'EFFECTED' | 'PAYABLE' =
            row.lifecycle === 'EFFECTED' || row.lifecycle === 'PAYABLE'
              ? row.lifecycle
              : row.pagamento
                ? 'EFFECTED'
                : 'PAYABLE'
          const isPaid = lifecycle === 'EFFECTED'
          // Sanity: PAYABLE com pagamento preenchido é estado inválido
          // (lib/lifecycle:60-69). Se cair aqui (não deveria), zera pagamento
          // pra não criar a regressão R$ 939k.
          const paymentDateSafe = lifecycle === 'EFFECTED' ? row.pagamento : null
          const txDate = paymentDateSafe ?? row.vencimento ?? new Date()
          try {
            await tx.transaction.create({
              data: {
                // bankAccountId nulo enquanto PAYABLE (Sprint 4.0.1.a)
                categoryId,
                supplierId,
                employeeId,
                date: txDate,
                // rawFavorecido garantido não-nulo pelo decideRowAction.PROCEED
                description: row.rawDescricao ?? (row.rawFavorecido as string),
                amount: row.valor,
                type: 'DEBIT',
                status: isPaid ? 'RECONCILED' : 'PENDING',
                origin: 'IMPORT_EXCEL',
                lifecycle,
                dueDate: row.vencimento,
                paymentDate: paymentDateSafe,
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
          } catch (err) {
            // P2002 = unique constraint violation (dedupHash + bankAccountId
            // OU recurringScheduleId + dueDate). Skip a linha sem matar batch.
            if (isUniqueConstraintError(err)) {
              duplicateSkipped++
              const dedupShort = row.dedupHash?.slice(0, 8) ?? '(nulo)'
              console.warn(
                `[EXCEL-CONFIRM] skip duplicate batch=${batchId} ` +
                  `rowIndex=${row.rowIndex} dedupHash=${dedupShort}... ` +
                  `favorecido="${row.rawFavorecido?.slice(0, 40)}"`,
              )
              continue
            }
            // Outro erro → rethrow → rollback completo
            throw err
          }
        }

        await tx.excelImportBatch.update({
          where: { id: batchId },
          data: { status: 'CONFIRMED', importedAt: new Date() },
        })

        // Limpa StagedPayableRows pra não inflar tabela (audit fica no batch).
        // Dentro do $transaction — rollback junto se algo falhar acima.
        await tx.stagedPayableRow.deleteMany({ where: { batchId } })

        return {
          createdTransactions,
          createdSuppliers,
          createdEmployees,
          createdCategories,
          duplicateSkipped,
          needsReviewSkipped,
          excludedSkipped,
          noFavorecidoSkipped,
          paid,
          pending,
          totalAmountCents,
        }
      },
      { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS },
    )

    const elapsedMs = Date.now() - t0
    const totalSkipped =
      result.duplicateSkipped +
      result.needsReviewSkipped +
      result.excludedSkipped +
      result.noFavorecidoSkipped

    console.log(
      `[EXCEL-CONFIRM] company=${companyId} batch=${batchId} ` +
        `txs=${result.createdTransactions} paid=${result.paid} pending=${result.pending} ` +
        `suppliers_new=${result.createdSuppliers} employees_new=${result.createdEmployees} ` +
        `categories_new=${result.createdCategories} ` +
        `skip_dup=${result.duplicateSkipped} skip_review=${result.needsReviewSkipped} ` +
        `skip_excl=${result.excludedSkipped} skip_nofav=${result.noFavorecidoSkipped} ` +
        `total=R$${(result.totalAmountCents / 100).toFixed(2)} elapsed=${elapsedMs}ms`,
    )

    return NextResponse.json({
      batchId,
      transactionsCreated: result.createdTransactions,
      paid: result.paid,
      pending: result.pending,
      suppliersCreated: result.createdSuppliers,
      employeesCreated: result.createdEmployees,
      categoriesCreated: result.createdCategories,
      // Skipped agregado (compat com UI Sprint 5.0.2.0) — mas inclui breakdown
      skipped: totalSkipped,
      skippedBreakdown: {
        duplicate: result.duplicateSkipped,
        needsReview: result.needsReviewSkipped,
        excluded: result.excludedSkipped,
        noFavorecido: result.noFavorecidoSkipped,
      },
      totalAmount: result.totalAmountCents / 100,
      elapsedMs,
      summary: {
        periodStart: batch.periodStart,
        periodEnd: batch.periodEnd,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
