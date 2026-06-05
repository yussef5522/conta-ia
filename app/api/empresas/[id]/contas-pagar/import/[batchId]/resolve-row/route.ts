// POST /api/empresas/[id]/contas-pagar/import/[batchId]/resolve-row
//
// Sprint Import-Transparência: resolve UMA linha pendente do batch que ficou
// como NEEDS_REVIEW após o confirm (sistema pulou em silêncio antes — agora
// user decide explicitamente o que fazer).
//
// 3 ações:
//   - IMPORT          → cria transaction com os dados originais da staged_row
//                       (user disse "importa mesmo assim, eu sei que é válida")
//   - IMPORT_EDITED   → cria transaction com overrides aplicados (user editou
//                       os campos problemáticos antes de importar)
//   - EXCLUDE         → marca userDecision='EXCLUDE'. Não cria nada. Não vai
//                       pedir de novo.
//
// Em todos os casos, a staged_row é PRESERVADA (não deleta) — fica o histórico
// pra auditoria.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { isUniqueConstraintError } from '@/lib/excel-import/decide-row-action'

export const runtime = 'nodejs'
export const maxDuration = 30

const schema = z.object({
  rowId: z.string().cuid(),
  action: z.enum(['IMPORT', 'IMPORT_EDITED', 'EXCLUDE']),
  overrides: z
    .object({
      rawFavorecido: z.string().min(1).max(200).optional(),
      valor: z.number().positive().optional(),
      vencimento: z.string().datetime().optional().nullable(),
      pagamento: z.string().datetime().optional().nullable(),
      rawDescricao: z.string().max(500).optional().nullable(),
      favorecidoType: z.enum(['SUPPLIER', 'EMPLOYEE', 'ORGAO_PUBLICO']).optional(),
      categoryId: z.string().cuid().optional().nullable(),
    })
    .optional(),
})

interface Params {
  params: Promise<{ id: string; batchId: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, batchId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const input = schema.parse(body)

    const batch = await prisma.excelImportBatch.findUnique({
      where: { id: batchId },
      select: { id: true, companyId: true },
    })
    if (!batch || batch.companyId !== companyId) {
      return NextResponse.json(
        { erro: 'Batch não encontrado', code: 'BATCH_NOT_FOUND' },
        { status: 404 },
      )
    }

    const row = await prisma.stagedPayableRow.findUnique({
      where: { id: input.rowId },
    })
    if (!row || row.batchId !== batchId) {
      return NextResponse.json(
        { erro: 'Linha não encontrada', code: 'ROW_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (row.userDecision === 'IMPORTED' || row.userDecision === 'EXCLUDE') {
      return NextResponse.json(
        {
          erro: `Linha já resolvida (${row.userDecision === 'IMPORTED' ? 'importada' : 'excluída'}).`,
          code: 'ROW_ALREADY_RESOLVED',
        },
        { status: 409 },
      )
    }

    // ── EXCLUDE: simples, só marca ──
    if (input.action === 'EXCLUDE') {
      await prisma.stagedPayableRow.update({
        where: { id: row.id },
        data: { userDecision: 'EXCLUDE' },
      })
      return NextResponse.json({
        ok: true,
        action: 'EXCLUDE',
        rowId: row.id,
      })
    }

    // ── IMPORT / IMPORT_EDITED: cria transaction ──
    // Aplica overrides nos campos da row antes de criar a tx.
    const overrides = input.overrides ?? {}
    const favorecido =
      input.action === 'IMPORT_EDITED' && overrides.rawFavorecido
        ? overrides.rawFavorecido.trim()
        : row.rawFavorecido?.trim()

    if (!favorecido) {
      return NextResponse.json(
        { erro: 'Favorecido é obrigatório', code: 'FAVORECIDO_REQUIRED' },
        { status: 400 },
      )
    }

    const valor =
      input.action === 'IMPORT_EDITED' && overrides.valor !== undefined
        ? overrides.valor
        : row.valor

    if (!valor || valor <= 0) {
      return NextResponse.json(
        { erro: 'Valor deve ser maior que zero', code: 'VALOR_INVALID' },
        { status: 400 },
      )
    }

    const vencimento =
      input.action === 'IMPORT_EDITED' && overrides.vencimento !== undefined
        ? overrides.vencimento
          ? new Date(overrides.vencimento)
          : null
        : row.vencimento

    const pagamento =
      input.action === 'IMPORT_EDITED' && overrides.pagamento !== undefined
        ? overrides.pagamento
          ? new Date(overrides.pagamento)
          : null
        : row.pagamento

    const descricao =
      input.action === 'IMPORT_EDITED' && overrides.rawDescricao !== undefined
        ? overrides.rawDescricao
        : row.rawDescricao

    const favorecidoType =
      input.action === 'IMPORT_EDITED' && overrides.favorecidoType
        ? overrides.favorecidoType
        : row.favorecidoType ?? 'SUPPLIER'

    // categoryId — usa override, ou matched, ou null (descategorizada)
    const categoryIdOverride =
      input.action === 'IMPORT_EDITED' && overrides.categoryId !== undefined
        ? overrides.categoryId
        : undefined

    // Mesma lógica do confirm: se pagamento setado → EFFECTED, senão PAYABLE
    const lifecycle: 'EFFECTED' | 'PAYABLE' = pagamento ? 'EFFECTED' : 'PAYABLE'
    const isPaid = lifecycle === 'EFFECTED'
    const paymentDateSafe = isPaid ? pagamento : null
    const txDate = paymentDateSafe ?? vencimento ?? new Date()

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Resolve supplier OU employee
        let supplierId: string | null = row.matchedSupplierId
        let employeeId: string | null = row.matchedEmployeeId
        if (!supplierId && !employeeId) {
          if (favorecidoType === 'EMPLOYEE') {
            const created = await tx.employee.create({
              data: { companyId, nome: favorecido, tipo: 'CLT', ativo: true },
            })
            employeeId = created.id
          } else {
            const notes =
              favorecidoType === 'ORGAO_PUBLICO' ? 'tipo=ORGAO_PUBLICO' : null
            const created = await tx.supplier.create({
              data: {
                companyId,
                razaoSocial: favorecido,
                notes,
                isActive: true,
              },
            })
            supplierId = created.id
          }
        }

        // Resolve category — usa override ou matched (sem auto-criar pra não
        // proliferar; user que quer categoria diferente edita depois)
        const categoryId =
          categoryIdOverride !== undefined
            ? categoryIdOverride
            : row.matchedCategoryId

        const created = await tx.transaction.create({
          data: {
            categoryId,
            supplierId,
            employeeId,
            date: txDate,
            description: descricao ?? favorecido,
            amount: valor,
            type: 'DEBIT',
            status: isPaid ? 'RECONCILED' : 'PENDING',
            origin: 'IMPORT_EXCEL',
            lifecycle,
            dueDate: vencimento,
            paymentDate: paymentDateSafe,
            competenceDate: row.competencia,
            notes: row.rawNota ? `NF: ${row.rawNota}` : null,
            dedupHash: row.dedupHash,
            classificationSource: 'IMPORT_EXCEL',
            aiConfidence: row.categoryConfidence,
          },
        })

        await tx.stagedPayableRow.update({
          where: { id: row.id },
          data: { userDecision: 'IMPORTED' },
        })

        return { transactionId: created.id }
      })

      return NextResponse.json({
        ok: true,
        action: input.action,
        rowId: row.id,
        transactionId: result.transactionId,
      })
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return NextResponse.json(
          {
            erro:
              'Esta linha já existe (mesma combinação de data + valor + favorecido). Use "Excluir" se for duplicata.',
            code: 'DUPLICATE_TX',
          },
          { status: 409 },
        )
      }
      throw err
    }
  } catch (error) {
    return handleApiError(error)
  }
}
