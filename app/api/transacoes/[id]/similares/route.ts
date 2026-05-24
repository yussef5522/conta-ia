// GET /api/transacoes/[id]/similares
// Fase 3 Etapa 1.
//
// Conta + lista preview de transações pendentes COM MESMO PADRÃO que [id].
// Usado pra mostrar modal "276 similares · aplicar todas?" antes do bulk.
//
// Response: {
//   total: number,
//   totalAmount: number,
//   tipoMatch: 'EXACT' | 'NORMALIZED',
//   preview: [{ id, description, amount, date }, ... até 5]
// }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  findSimilarTransactions,
} from '@/lib/ai-categorizer/similar'
import { buildNewRule } from '@/lib/ai-categorizer/learn'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const base = await prisma.transaction.findUnique({
      where: { id },
      include: {
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!base) {
      return NextResponse.json(
        { erro: 'Transação não encontrada' },
        { status: 404 },
      )
    }

    const ctx = await getAuthContext(request, base.bankAccount!.companyId)
    ctx.requirePermission('transaction.view')

    // Decide tipoMatch usando a mesma heurística da criação de regra:
    // se desc tem " - " → NORMALIZED, senão EXACT
    const ruleShape = buildNewRule(
      base.bankAccount!.companyId,
      base.description,
      'placeholder', // categoria não importa aqui, só usamos tipoMatch+padrao
    )

    // Pega candidatas (pendentes sem categoria, da mesma empresa)
    const candidatas = await prisma.transaction.findMany({
      where: {
        id: { not: id },
        categoryId: null,
        status: 'PENDING',
        type: { not: 'TRANSFER' },
        bankAccount: { companyId: base.bankAccount!.companyId },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        bankAccountId: true,
        status: true,
        categoryId: true,
        date: true,
      },
      take: 5000,
    })

    const similares = findSimilarTransactions(
      {
        baseDescription: base.description,
        tipoMatch: ruleShape.tipoMatch,
        candidatas: candidatas.map((c) => ({
          id: c.id,
          description: c.description,
          amount: c.amount,
          type: c.type,
          bankAccountId: c.bankAccountId,
          status: c.status,
          categoryId: c.categoryId,
        })),
      },
      id,
    )

    // Mapa id → date pro preview
    const dateMap = new Map(candidatas.map((c) => [c.id, c.date]))

    const totalAmount = similares.reduce(
      (s, t) => s + Math.abs(t.amount),
      0,
    )

    const preview = similares.slice(0, 5).map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: dateMap.get(t.id),
    }))

    return NextResponse.json({
      total: similares.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      tipoMatch: ruleShape.tipoMatch,
      padrao: ruleShape.padrao,
      preview,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
