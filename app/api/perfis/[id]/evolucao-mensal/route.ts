// Sprint Dashboard PF — GET evolução mensal (12 meses default).
//
// Auth: getAuthUser + checkProfileAccess (multi-tenant Fatia 1).
// Resposta: { months: [{ month, label, income, expense, net, cumulativeBalance }], finalBalance, maxIncome, maxExpense }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { checkProfileAccess, ProfileAccessError } from '@/lib/personal-profile/queries'
import { aggregateMonthly, type RawTx } from '@/lib/dashboard-pf/aggregate-monthly'

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    const { id: profileId } = await params

    try {
      await checkProfileAccess(user.sub, profileId)
    } catch (err) {
      if (err instanceof ProfileAccessError) {
        return NextResponse.json(
          { erro: err.message, code: err.code },
          { status: err.code === 'NO_ACCESS' ? 404 : 403 },
        )
      }
      throw err
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      months: searchParams.get('months') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { erro: 'months inválido (1-36)' },
        { status: 400 },
      )
    }
    const months = parsed.data.months

    // Janela: últimos N meses incluindo o corrente
    const now = new Date()
    const windowStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
    )

    // Saldo atual = soma de balance das contas ativas
    const accounts = await prisma.personalBankAccount.findMany({
      where: { profileId, isActive: true },
      select: { balance: true },
    })
    const currentBalance = accounts.reduce((s, a) => s + a.balance, 0)

    // Tx do período (CREDIT + DEBIT, exclui invoice payment pra não duplicar
    // o saldo do cartão; mas inclui as compras de cartão como despesas)
    const txs = await prisma.personalTransaction.findMany({
      where: {
        profileId,
        date: { gte: windowStart },
        type: { in: ['CREDIT', 'DEBIT'] },
      },
      select: { date: true, amount: true, type: true },
    })

    const rawTxs: RawTx[] = txs.map((t) => ({
      date: t.date,
      amount: t.amount,
      type: t.type as 'CREDIT' | 'DEBIT',
    }))

    const result = aggregateMonthly({
      transactions: rawTxs,
      months,
      currentBalance,
      referenceDate: now,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { erro: (err as Error).message ?? 'Erro interno' },
      { status: 500 },
    )
  }
}
