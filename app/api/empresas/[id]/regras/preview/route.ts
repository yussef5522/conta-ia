// POST /api/empresas/[id]/regras/preview — Sprint 3.0.4 C3.
//
// Recebe { padrao, tipoMatch, excludeRuleId? } e retorna quantas transações
// PENDING da empresa seriam pegas + 5 amostras. Usado pelo modal de regra pra
// dar feedback ao vivo enquanto o user digita.
//
// Limita janela a 5000 tx mais recentes (descartando histórico antigo) pra
// preview ficar barato. Match é client-side em JS pra reusar a função pura.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { filterTransacoesByRegra } from '@/lib/regras/preview-match'

interface Params {
  params: Promise<{ id: string }>
}

const previewBodySchema = z.object({
  padrao: z.string().min(1).max(500),
  tipoMatch: z.enum(['EXACT', 'CONTAINS', 'CNPJ', 'NORMALIZED']),
  // Opcional — quando editando regra existente, ignora as tx já classificadas
  // por essa regra (não conta como "match novo")
  excludeRuleId: z.string().cuid().optional(),
})

const WINDOW_SIZE = 5000
const SAMPLE_SIZE = 5

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const body = await request.json()
    const parsed = previewBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { erro: 'Payload inválido', detalhes: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { padrao, tipoMatch, excludeRuleId } = parsed.data

    // Janela: PENDING apenas (regra serve pra classificar pendentes).
    const pendentes = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        status: 'PENDING',
        ...(excludeRuleId ? { classifiedByRuleId: { not: excludeRuleId } } : {}),
      },
      select: { id: true, description: true, amount: true, date: true, type: true },
      orderBy: { date: 'desc' },
      take: WINDOW_SIZE,
    })

    const matches = filterTransacoesByRegra(pendentes, { padrao, tipoMatch })
    const samples = matches.slice(0, SAMPLE_SIZE)

    return NextResponse.json({
      count: matches.length,
      janela: pendentes.length,
      truncado: pendentes.length === WINDOW_SIZE,
      samples,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
