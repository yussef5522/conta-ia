// PATCH /api/transacoes/lote/status — Sprint 3.0.3 B2.
//
// Atualiza status de várias transações em massa (RECONCILED / IGNORED / PENDING).
// Diferente do /lote (categoria), NÃO mexe em classificationSource nem aiConfidence.
//
// Multi-tenancy via where bankAccount.company.users (mesma estratégia do /lote).
//
// Sprint Category-Combobox (29/06/2026) — BLINDAGEM A2:
// Antes fazia updateMany cego com data.status, podendo violar a escada
// (ex: marcar RECONCILED em tx sem categoria → estado invertido lado A,
// ou marcar PENDING em tx com categoria → estado invertido lado B).
// Agora: fetch tx + accountType + categoryId, aplica enforceStatusLadder
// por tx, agrupa pela invariante, e updateMany por grupo (ainda performant).

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { transacaoLoteStatusSchema } from '@/lib/validations/transacao-lote'
import { enforceStatusLadder } from '@/lib/transacoes/needs-review'

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user)
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = transacaoLoteStatusSchema.parse(body)

    // Fetch tx no escopo multi-tenant pra ler categoryId + accountType e
    // aplicar a invariante por tx antes do updateMany.
    const txs = await prisma.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        bankAccount: { company: { users: { some: { userId: user.sub } } } },
      },
      select: {
        id: true,
        categoryId: true,
        bankAccount: { select: { accountType: true } },
      },
    })

    // Agrupa por status enforced — agora updateMany por grupo (RECONCILED,
    // PENDING, IGNORED). Mantém performance e respeita a escada.
    const byEnforced: Record<'PENDING' | 'RECONCILED' | 'IGNORED', string[]> = {
      PENDING: [],
      RECONCILED: [],
      IGNORED: [],
    }
    for (const t of txs) {
      const final = enforceStatusLadder({
        intendedStatus: data.status,
        categoryId: t.categoryId,
        accountType: t.bankAccount?.accountType ?? null,
      })
      byEnforced[final].push(t.id)
    }

    let updatedTotal = 0
    await prisma.$transaction(async (tx) => {
      for (const [statusFinal, ids] of Object.entries(byEnforced)) {
        if (ids.length === 0) continue
        const r = await tx.transaction.updateMany({
          where: { id: { in: ids } },
          data: { status: statusFinal as 'PENDING' | 'RECONCILED' | 'IGNORED' },
        })
        updatedTotal += r.count
      }
    })

    return NextResponse.json({
      atualizadas: updatedTotal,
      naoEncontradas: data.transactionIds.length - txs.length,
      // Sprint Category-Combobox: telemetria opcional pra UI mostrar
      // quantas tiveram status corrigido pela invariante.
      enforced: {
        RECONCILED: byEnforced.RECONCILED.length,
        PENDING: byEnforced.PENDING.length,
        IGNORED: byEnforced.IGNORED.length,
      },
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
