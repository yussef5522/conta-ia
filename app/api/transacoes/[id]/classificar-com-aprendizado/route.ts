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
import { counterpartyRulePattern, matchCounterpartyRule, CONTRAPARTE_TIPO_MATCH } from '@/lib/counterparty/rules'

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
  // Sprint Ciclo-Aprendizado (01/08) — cria regra "contraparte → categoria"
  // (por empresa) quando o user escolhe ativamente. Convive com a regra por
  // descrição (learnPattern); pra contraparte, a CONTRAPARTE tem precedência.
  createCounterpartyRule: z.boolean().default(false),
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
        counterpartyName: true,
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

    // Ciclo de aprendizado por CONTRAPARTE (só quando a tx tem contraparte).
    // NUNCA em silêncio: só cria se o user marcou. Por empresa, nunca global.
    let counterpartyRuleCreated = false
    const companyId = tx.bankAccount!.companyId
    if (tx.counterpartyName) {
      const padrao = counterpartyRulePattern(tx.counterpartyName)
      if (padrao && input.createCounterpartyRule) {
        await prisma.aiLearningRule
          .upsert({
            where: { companyId_tipoMatch_padrao: { companyId, tipoMatch: CONTRAPARTE_TIPO_MATCH, padrao } },
            create: { companyId, tipoMatch: CONTRAPARTE_TIPO_MATCH, padrao, categoryId: input.categoryId, fonte: 'MANUAL', confianca: 1.0 },
            update: { categoryId: input.categoryId, isActive: true },
          })
          .then(() => { counterpartyRuleCreated = true })
          .catch((e) => console.error('[contraparte-rule] upsert falhou:', e?.message))
      } else if (padrao) {
        // 3.3: se já existia regra CONTRAPARTE que casa E o user seguiu a categoria
        // dela, conta vezesAplicada (a regra foi "usada"). Alimenta a tela de gestão.
        const existentes = await prisma.aiLearningRule.findMany({
          where: { companyId, tipoMatch: CONTRAPARTE_TIPO_MATCH, isActive: true },
          select: { id: true, padrao: true, categoryId: true },
        })
        const casou = matchCounterpartyRule(tx.counterpartyName, existentes)
        if (casou && casou.categoryId === input.categoryId) {
          await prisma.aiLearningRule
            .update({ where: { id: casou.id }, data: { vezesAplicada: { increment: 1 } } })
            .catch(() => null)
        }
      }
    }

    return NextResponse.json({ ...result, counterpartyRuleCreated }, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
