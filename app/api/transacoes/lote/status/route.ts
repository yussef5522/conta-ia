// PATCH /api/transacoes/lote/status — Sprint 3.0.3 B2.
//
// Atualiza status de várias transações em massa (RECONCILED / IGNORED / PENDING).
// Diferente do /lote (categoria), NÃO mexe em classificationSource nem aiConfidence.
//
// Multi-tenancy via where bankAccount.company.users (mesma estratégia do /lote).

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { transacaoLoteStatusSchema } from '@/lib/validations/transacao-lote'

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user)
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = transacaoLoteStatusSchema.parse(body)

    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: data.transactionIds },
        bankAccount: { company: { users: { some: { userId: user.sub } } } },
      },
      data: { status: data.status },
    })

    return NextResponse.json({
      atualizadas: result.count,
      naoEncontradas: data.transactionIds.length - result.count,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json(
        { erro: 'Dados inválidos', campos },
        { status: 400 },
      )
    }
    console.error('[TRANSACOES PATCH lote/status] Erro:', error)
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
