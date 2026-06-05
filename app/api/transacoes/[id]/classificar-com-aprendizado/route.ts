// POST /api/transacoes/[id]/classificar-com-aprendizado
// Fase 3 Etapa 1 — Engine de Aprendizado de Categorização.
//
// Body: {
//   categoryId: string,
//   learnPattern: boolean,
//   applyToSimilar: boolean
// }
//
// Comportamento:
//   1. Aplica categoryId na transação base
//   2. Se learnPattern: upsert AiLearningRule (NORMALIZED se tem prefixo " - ",
//      senão EXACT)
//   3. Se applyToSimilar: busca pendentes com mesmo padrão + bulk update
//   4. Audit log com source = AI_LEARNED_BULK (se applyToSimilar=true) ou MANUAL

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { classifyWithLearning } from '@/lib/ai-categorizer/apply'

const schema = z.object({
  categoryId: z.string().cuid(),
  learnPattern: z.boolean().default(true),
  applyToSimilar: z.boolean().default(false),
  // Sprint UX-bulk-review: lista explícita de IDs similares pra aplicar.
  // Quando passada, sobrescreve a busca server-side (user escolheu na UI quais
  // entrar no lote, possivelmente desmarcando algumas que viu como estranhas).
  // Cap 500 alinhado com /similares.
  similarTxIds: z.array(z.string().cuid()).max(500).optional(),
  // Fase 3 Etapa 3 — contexto sugestão Claude (Camada 3)
  // Quando passados, permite detectar override + invalidar cache do Claude.
  claudeCacheKey: z.string().optional(),
  claudeSuggestedCategoryId: z.string().nullable().optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!tx) {
      return NextResponse.json(
        { erro: 'Transação não encontrada' },
        { status: 404 },
      )
    }

    const ctx = await getAuthContext(request, tx.bankAccount!.companyId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const input = schema.parse(body)

    const result = await classifyWithLearning(
      {
        transactionId: id,
        categoryId: input.categoryId,
        learnPattern: input.learnPattern,
        applyToSimilar: input.applyToSimilar,
        explicitSimilarTxIds: input.similarTxIds,
        claudeCacheKey: input.claudeCacheKey,
        claudeSuggestedCategoryId: input.claudeSuggestedCategoryId,
      },
      ctx,
      request,
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
