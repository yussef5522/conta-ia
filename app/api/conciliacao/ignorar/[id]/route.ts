// Sprint A-effected Fase B — POST /api/conciliacao/ignorar/[id]
// + POST /api/conciliacao/ignorar/[id] (modo undo via body.acao='reverter')
//
// Ação IGNORAR do modelo Xero (variante BR): marca tx OFX como "não-
// conciliável" (taxa banco, estorno, lançamento errado).
//
// Body:
//   - motivo: enum TAXA_BANCO | ESTORNO | LANCAMENTO_ERRADO | OUTRO
//   - motivoCustom?: string (quando motivo=OUTRO)
//
// Efeito:
//   - tx.ignoredAt = now
//   - tx.ignoredReason = motivo + (custom se OUTRO)
//   - tx.ignoredByUserId = current user
//   - tx some da fila de pendentes (ofx-pendentes filtra ignoredAt IS NULL)
//   - audit log
//
// Undo: futuramente endpoint dedicado (Fase C). Por ora, podemos chamar
// PATCH manualmente ou aguardar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'

const MOTIVOS = ['TAXA_BANCO', 'ESTORNO', 'LANCAMENTO_ERRADO', 'OUTRO'] as const

const bodySchema = z.object({
  motivo: z.enum(MOTIVOS),
  motivoCustom: z.string().max(500).optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = bodySchema.parse(body)

    const ofxTx = await prisma.transaction.findUnique({
      where: { id },
      include: { bankAccount: { select: { companyId: true } } },
    })
    if (!ofxTx || !ofxTx.bankAccount) {
      return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    }
    if (ofxTx.lifecycle !== 'EFFECTED') {
      return NextResponse.json(
        { erro: 'Só EFFECTED pode ser marcada como ignorada' },
        { status: 422 },
      )
    }
    if (ofxTx.reconciledWithId) {
      return NextResponse.json(
        { erro: 'Tx já conciliada — desfaça primeiro pra ignorar' },
        { status: 422 },
      )
    }
    if (ofxTx.ignoredAt) {
      return NextResponse.json(
        { erro: 'Tx já está marcada como ignorada' },
        { status: 422 },
      )
    }

    const companyId = ofxTx.bankAccount.companyId
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    const motivoTexto =
      data.motivo === 'OUTRO' && data.motivoCustom
        ? `OUTRO: ${data.motivoCustom}`
        : data.motivo

    const result = await prisma.$transaction(async (trx) => {
      const updated = await trx.transaction.update({
        where: { id },
        data: {
          ignoredAt: new Date(),
          ignoredReason: motivoTexto,
          ignoredByUserId: ctx.user.id,
        },
      })

      await logAudit(
        ctx,
        {
          action: 'UPDATE',
          entityType: 'TransactionIgnored',
          entityId: id,
          fieldsChanged: {
            ignoredAt: { before: null, after: updated.ignoredAt?.toISOString() },
            ignoredReason: { before: null, after: motivoTexto },
          },
          metadata: {
            ofxDescription: ofxTx.description,
            ofxAmount: ofxTx.amount,
            motivo: data.motivo,
          },
        },
        trx,
      )

      return updated
    })

    return NextResponse.json({ ok: true, transaction: result })
  } catch (error) {
    return handleApiError(error)
  }
}
