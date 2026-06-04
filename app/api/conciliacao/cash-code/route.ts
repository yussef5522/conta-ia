// Sprint A-effected Fase B (03/06/2026) — POST /api/conciliacao/cash-code
//
// Ação CRIAR do modelo Xero: categoriza OFX direto SEM precisar de candidato
// AP/AR. Modelo "cash coding" pra varejo: venda de pizza vira "Receita Vendas"
// na mesma hora, sem cadastrar cliente.
//
// Body:
//   - ofxTransactionId: string (cuid)
//   - categoryId: string (cuid, OBRIGATÓRIO — decisão Yussef #6)
//   - supplierId?: string (cuid, opcional)
//   - customerId?: string (cuid, opcional)
//   - notas?: string (opcional, vai pro campo description suffix ou notes)
//   - criarRegra?: boolean (se true, cria ai_learning_rule pra padrão similar)
//
// Efeito:
//   - tx.categoryId = categoryId
//   - tx.supplierId = supplierId (se passado)
//   - tx.customerId = customerId (se passado)
//   - tx.cashCoded = true
//   - tx.cashCodedAt = now
//   - tx.status = 'RECONCILED' (sai da fila de pendentes — Yussef tratou)
//   - audit log
//   - opcional: ai_learning_rule "<descrição normalizada>" → categoryId

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'
import { normalizeForMatch } from '@/lib/conciliacao/normalize-for-match'

const bodySchema = z.object({
  ofxTransactionId: z.string().cuid(),
  categoryId: z.string().cuid(), // OBRIGATÓRIO — não pode categorizar sem categoria
  supplierId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  notas: z.string().max(500).optional(),
  criarRegra: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = bodySchema.parse(body)

    const ofxTx = await prisma.transaction.findUnique({
      where: { id: data.ofxTransactionId },
      include: {
        bankAccount: { select: { companyId: true } },
        reconciledFrom: { select: { id: true }, take: 1 },
      },
    })
    if (!ofxTx || !ofxTx.bankAccount) {
      return NextResponse.json({ erro: 'Transação OFX não encontrada' }, { status: 404 })
    }
    if (ofxTx.lifecycle !== 'EFFECTED' || !ofxTx.bankAccountId) {
      return NextResponse.json(
        { erro: 'Tx precisa ser EFFECTED com bankAccount válido' },
        { status: 422 },
      )
    }
    if (ofxTx.reconciledWithId) {
      return NextResponse.json(
        { erro: 'Tx OFX já está conciliada com um candidato' },
        { status: 422 },
      )
    }
    if (ofxTx.reconciledFrom.length > 0) {
      return NextResponse.json(
        { erro: 'Tx OFX já tem outra conta conciliada com ela' },
        { status: 422 },
      )
    }
    if (ofxTx.cashCoded) {
      return NextResponse.json(
        { erro: 'Tx já foi categorizada (cash-coded)' },
        { status: 422 },
      )
    }
    if (ofxTx.ignoredAt) {
      return NextResponse.json(
        { erro: 'Tx está marcada como ignorada' },
        { status: 422 },
      )
    }

    const companyId = ofxTx.bankAccount.companyId
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    // Validar categoria pertence à empresa
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true, companyId: true, name: true, type: true },
    })
    if (!category || category.companyId !== companyId) {
      return NextResponse.json(
        { erro: 'Categoria inválida pra essa empresa' },
        { status: 422 },
      )
    }

    // Operação atomic
    const result = await prisma.$transaction(async (trx) => {
      const updated = await trx.transaction.update({
        where: { id: ofxTx.id },
        data: {
          categoryId: data.categoryId,
          ...(data.supplierId ? { supplierId: data.supplierId } : {}),
          ...(data.customerId ? { customerId: data.customerId } : {}),
          ...(data.notas ? { notes: data.notas } : {}),
          cashCoded: true,
          cashCodedAt: new Date(),
          status: 'RECONCILED', // sai da fila de pendentes
        },
      })

      // Audit log
      await logAudit(
        ctx,
        {
          action: 'UPDATE',
          entityType: 'CashCode',
          entityId: ofxTx.id,
          fieldsChanged: {
            categoryId: { before: ofxTx.categoryId, after: data.categoryId },
            cashCoded: { before: false, after: true },
            status: { before: ofxTx.status, after: 'RECONCILED' },
          },
          metadata: {
            ofxDescription: ofxTx.description,
            ofxAmount: ofxTx.amount,
            categoryName: category.name,
            supplierIdMigrated: !!data.supplierId,
            customerIdMigrated: !!data.customerId,
            criarRegra: data.criarRegra,
          },
        },
        trx,
      )

      // Opcional: criar regra de aprendizado
      if (data.criarRegra) {
        const padrao = normalizeForMatch(ofxTx.description)
        if (padrao) {
          // upsert: se já existe regra exata, incrementa contagem
          const existing = await trx.aiLearningRule.findFirst({
            where: { companyId, padrao, tipoMatch: 'CONTAINS' },
          })
          if (existing) {
            await trx.aiLearningRule.update({
              where: { id: existing.id },
              data: {
                vezesAplicada: { increment: 1 },
                categoryId: data.categoryId,
              },
            })
          } else {
            await trx.aiLearningRule.create({
              data: {
                companyId,
                padrao,
                tipoMatch: 'CONTAINS',
                categoryId: data.categoryId,
                confianca: 0.7,
                vezesAplicada: 1,
              },
            })
          }
        }
      }

      return updated
    })

    return NextResponse.json({ ok: true, transaction: result })
  } catch (error) {
    return handleApiError(error)
  }
}
