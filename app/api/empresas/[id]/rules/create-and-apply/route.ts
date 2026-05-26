// Sprint 5.0.2.k — Cria AiLearningRule + aplica retroativamente nas pendentes.
//
// Fluxo:
//   1. Cria regra (tipoMatch=CONTAINS, padrao=stem)
//      ou reusa se já existir (companyId+tipoMatch+padrao unique)
//   2. Busca pendentes que batem (mesmo stem + mesmo type, opcionalmente +bankAccountId)
//   3. updateMany aplicando categoryId + status=RECONCILED + classifiedByRuleId
//   4. Atualiza rule.vezesAplicada
//   5. Retorna { ruleId, appliedTo, totalAmount }
//
// Próximos imports OFX vão pegar automaticamente via pipeline existente
// (autoClassifyTransactions roda CAMADA 1 RULE com confianca ≥0.95).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  padrao: z.string().min(3).max(120),
  tipoMatch: z.enum(['EXACT', 'CONTAINS', 'CNPJ']).default('CONTAINS'),
  categoryId: z.string().min(1),
  /** Restringe match ao type CREDIT/DEBIT? */
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
  /** Se true, aplica nas pendentes que batem (retroativo). */
  applyToExisting: z.boolean().default(true),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const data = schema.parse(body)

    // 1. Validar categoria existe e pertence à empresa
    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, companyId },
    })
    if (!cat) {
      return NextResponse.json({ erro: 'Categoria inválida' }, { status: 400 })
    }

    // 2. Upsert rule (unique por companyId+tipoMatch+padrao)
    const rule = await prisma.aiLearningRule.upsert({
      where: {
        companyId_tipoMatch_padrao: {
          companyId,
          tipoMatch: data.tipoMatch,
          padrao: data.padrao,
        },
      },
      create: {
        companyId,
        tipoMatch: data.tipoMatch,
        padrao: data.padrao,
        categoryId: data.categoryId,
        confianca: 1.0, // MANUAL = confiança máxima
        fonte: 'MANUAL',
        isActive: true,
      },
      update: {
        categoryId: data.categoryId,
        isActive: true,
        confianca: 1.0,
      },
    })

    let appliedTo = 0
    let totalAmount = 0

    if (data.applyToExisting) {
      // 3. Busca pendentes que batem (mesma lógica do pipeline CAMADA 1)
      const descFilter =
        data.tipoMatch === 'EXACT'
          ? { description: data.padrao }
          : { description: { contains: data.padrao } }
      const where = {
        bankAccount: { companyId },
        status: 'PENDING',
        lifecycle: 'EFFECTED',
        ...(data.type ? { type: data.type } : {}),
        ...descFilter,
      }

      const matching = await prisma.transaction.findMany({
        where,
        select: { id: true, amount: true },
        take: 5000,
      })

      if (matching.length > 0) {
        const ids = matching.map((t) => t.id)
        totalAmount = matching.reduce((s, t) => s + t.amount, 0)

        await prisma.transaction.updateMany({
          where: { id: { in: ids } },
          data: {
            categoryId: data.categoryId,
            status: 'RECONCILED',
            classificationSource: 'RULE',
            classifiedByRuleId: rule.id,
            aiConfidence: 1.0,
          },
        })

        appliedTo = matching.length

        // 4. Incrementa contador na regra
        await prisma.aiLearningRule.update({
          where: { id: rule.id },
          data: { vezesAplicada: { increment: appliedTo } },
        })
      }
    }

    return NextResponse.json({
      ruleId: rule.id,
      appliedTo,
      totalAmount: Math.round(totalAmount * 100) / 100,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
