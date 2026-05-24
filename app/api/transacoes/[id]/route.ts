import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { transacaoUpdateSchema } from '@/lib/validations/transacao'
import { montarUpdateClassificacaoManual } from '@/lib/transacoes/classificar'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit, diffFields } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { recordRuleOverride } from '@/lib/ai-categorizer/apply'

interface Params { params: Promise<{ id: string }> }

async function carregarTransacao(transacaoId: string) {
  return prisma.transaction.findUnique({
    where: { id: transacaoId },
    include: {
      bankAccount: { select: { id: true, companyId: true } },
      category: { select: { id: true, name: true, color: true, type: true } },
    },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const transacao = await carregarTransacao(id)
    if (!transacao) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    // Sprint 4.0.1.a — rotas genéricas só lidam com EFFECTED (tx vinda do OFX ou manual já paga).
    // PAYABLE/RECEIVABLE pendentes têm endpoints próprios em /api/contas-a-pagar e /contas-a-receber.
    if (!transacao.bankAccount) {
      return NextResponse.json(
        { erro: 'Use /api/contas-a-pagar/[id] ou /api/contas-a-receber/[id] pra lançamentos pendentes' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, transacao.bankAccount.companyId)
    ctx.requirePermission('transaction.view')

    return NextResponse.json({ transacao })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const antiga = await carregarTransacao(id)
    if (!antiga) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    if (!antiga.bankAccount || !antiga.bankAccountId) {
      return NextResponse.json(
        { erro: 'Use endpoints de contas a pagar/receber pra lançamentos pendentes' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, antiga.bankAccount.companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const data = transacaoUpdateSchema.parse(body)

    const ajusteSaldo = calcularAjusteSaldo(antiga, data)

    const transacao = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id },
        data: {
          // Quando categoryId vem no body, é uma classificação manual: setamos
          // todos os metadados de classificação juntos (source, aiConfidence, ruleId)
          // pra manter o contrato da 4.1. Em 4.6, o helper vai ganhar a criação
          // automática de regra.
          ...(data.categoryId !== undefined
            ? montarUpdateClassificacaoManual(data.categoryId ?? null)
            : {}),
          ...(data.date !== undefined ? { date: data.date } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
        },
        include: { category: { select: { id: true, name: true, color: true, type: true } } },
      })
      if (ajusteSaldo !== 0) {
        await tx.bankAccount.update({
          where: { id: antiga.bankAccountId! },
          data: { balance: { increment: ajusteSaldo } },
        })
      }

      const fieldsChanged = diffFields(
        antiga as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        ['description', 'amount', 'date', 'competenceDate', 'paymentDate', 'categoryId', 'type', 'status', 'notes'],
      )

      if (fieldsChanged) {
        await logAudit(
          ctx,
          {
            action: 'UPDATE',
            entityType: 'Transaction',
            entityId: updated.id,
            fieldsChanged,
            metadata: { description: updated.description, amount: updated.amount },
            request,
          },
          tx,
        )
      }

      return updated
    })

    // Fase 3 Etapa 1: se a tx ANTIGA foi classificada por regra E o user
    // MUDOU a categoria (override), penaliza a regra (cai confiança).
    // Fora da $transaction pra não bloquear retorno; failure aqui é silencioso.
    if (
      antiga.classifiedByRuleId &&
      antiga.classificationSource === 'RULE' &&
      data.categoryId !== undefined &&
      data.categoryId !== antiga.categoryId
    ) {
      try {
        await recordRuleOverride(
          antiga.classifiedByRuleId,
          ctx,
          request,
          id,
        )
      } catch (e) {
        console.error('[RULE OVERRIDE] Falha registrar penalidade:', e)
      }
    }

    return NextResponse.json({ transacao })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const transacao = await carregarTransacao(id)
    if (!transacao) return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
    if (!transacao.bankAccount || !transacao.bankAccountId) {
      return NextResponse.json(
        { erro: 'Use endpoints de contas a pagar/receber pra lançamentos pendentes' },
        { status: 422 },
      )
    }

    const ctx = await getAuthContext(request, transacao.bankAccount.companyId)
    ctx.requirePermission('transaction.delete')

    // Reverte impacto no saldo
    const reverso = transacao.type === 'CREDIT' ? -transacao.amount : transacao.amount

    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } })
      await tx.bankAccount.update({
        where: { id: transacao.bankAccountId! },
        data: { balance: { increment: reverso } },
      })
      await logAudit(
        ctx,
        {
          action: 'DELETE',
          entityType: 'Transaction',
          entityId: id,
          metadata: {
            description: transacao.description,
            amount: transacao.amount,
            type: transacao.type,
          },
          request,
        },
        tx,
      )
    })

    return NextResponse.json({ mensagem: 'Transação excluída com sucesso' })
  } catch (error) {
    return handleApiError(error)
  }
}

function calcularAjusteSaldo(
  antiga: { amount: number; type: string },
  nova: { amount?: number; type?: string },
): number {
  const tipoAntigo = antiga.type
  const tipoNovo = nova.type ?? tipoAntigo
  const valorAntigo = antiga.amount
  const valorNovo = nova.amount ?? valorAntigo

  const impactoAntigo = tipoAntigo === 'CREDIT' ? valorAntigo : -valorAntigo
  const impactoNovo = tipoNovo === 'CREDIT' ? valorNovo : -valorNovo

  return impactoNovo - impactoAntigo
}
