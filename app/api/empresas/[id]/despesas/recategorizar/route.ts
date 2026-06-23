// Sprint 10 — POST /api/empresas/[id]/despesas/recategorizar
//
// Recebe { transactionIds: string[], novaCategoriaId: string } e atualiza
// categoryId em lote (1 ou N).
//
// Regras (todas auditadas):
// - Tx tem que pertencer à empresa (bankAccount.companyId == empresaId) —
//   defesa multi-tenant. Filtra silenciosamente IDs que não batem.
// - novaCategoriaId tem que ser categoria ativa da MESMA empresa.
// - classificationSource = 'MANUAL' (ação humana explícita).
// - classifiedByRuleId = null (rompe vínculo com qualquer regra anterior).
// - NÃO mexe em amount/date/bankAccountId/lifecycle/status/transferGroupId —
//   só categoria. Saldo intacto, conciliação intacta.
// - Invalida cache via revalidateTag(`dashboard:${empresaId}`) → dashboard
//   + /despesas + DRE refletem no próximo render.
// - Idempotente: rodar 2x não muda nada além de updatedAt.
//
// NÃO cria regra. Criação de regra é separada (Sprint 9 endpoint).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1).max(500),
  novaCategoriaId: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.categorize')

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { erro: 'Payload inválido', detalhes: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { transactionIds, novaCategoriaId } = parsed.data

    // Valida categoria
    const cat = await prisma.category.findFirst({
      where: { id: novaCategoriaId, companyId, isActive: true },
      select: { id: true, name: true, dreGroup: true, type: true },
    })
    if (!cat) {
      return NextResponse.json(
        { erro: 'Categoria não encontrada ou inativa.' },
        { status: 400 },
      )
    }

    // Filtra defensivamente: só tx que realmente pertencem à empresa
    const ownedTx = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        bankAccount: { companyId },
      },
      select: {
        id: true,
        categoryId: true,
        amount: true,
        type: true,
        description: true,
      },
    })

    const ownedIds = ownedTx.map((t) => t.id)
    if (ownedIds.length === 0) {
      return NextResponse.json(
        { erro: 'Nenhuma transação encontrada na empresa.' },
        { status: 404 },
      )
    }

    // Snapshot ANTES (pra undo + payload de retorno)
    const previousByTxId = new Map(
      ownedTx.map((t) => [t.id, t.categoryId]),
    )

    // Atomic updateMany
    const result = await prisma.transaction.updateMany({
      where: { id: { in: ownedIds } },
      data: {
        categoryId: novaCategoriaId,
        classificationSource: 'MANUAL',
        classifiedByRuleId: null,
        // aiConfidence preservado (informativo só)
      },
    })

    // Invalida cache: dashboard, /despesas, Top5 — tudo no mesmo tag.
    // Next.js 16 mudou a assinatura: revalidateTag(tag, profile).
    // 'default' invalida imediatamente (não usa cache-life custom).
    revalidateTag(`dashboard:${companyId}`, 'default')

    return NextResponse.json({
      updated: result.count,
      requested: transactionIds.length,
      skippedNotOwned: transactionIds.length - ownedIds.length,
      novaCategoria: cat,
      previousByTxId: Object.fromEntries(previousByTxId), // pra undo client-side
      totalAmount: ownedTx.reduce((s, t) => s + t.amount, 0),
    })
  } catch (err) {
    return handleApiError(err)
  }
}
