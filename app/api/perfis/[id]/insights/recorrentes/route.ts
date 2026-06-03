// Sprint PF Fatia 3 — Insights: detector de assinaturas recorrentes.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import {
  checkProfileAccess,
  ProfileAccessError,
} from '@/lib/personal-profile/queries'
import { detectRecurringSubscriptions } from '@/lib/ai-categorizer/detect-recurring'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  try {
    await checkProfileAccess(user.sub, id)
    // Pega últimos 180 dias de tx de cartão pro detector
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    const txs = await prisma.personalTransaction.findMany({
      where: {
        profileId: id,
        creditCardId: { not: null },
        type: 'DEBIT',
        isInvoicePayment: false,
        date: { gte: since },
      },
      select: { date: true, amount: true, description: true, type: true },
    })
    const recurring = detectRecurringSubscriptions(
      txs.map((t) => ({
        date: t.date,
        amount: t.amount,
        description: t.description,
        type: t.type as 'CREDIT' | 'DEBIT',
      })),
    )
    return NextResponse.json({
      recurring,
      monthlyTotal: recurring.reduce((s, r) => s + r.avgAmount, 0),
    })
  } catch (err) {
    if (err instanceof ProfileAccessError) {
      return NextResponse.json(
        { erro: err.message, code: err.code },
        { status: err.code === 'NO_ACCESS' ? 404 : 403 },
      )
    }
    throw err
  }
}
