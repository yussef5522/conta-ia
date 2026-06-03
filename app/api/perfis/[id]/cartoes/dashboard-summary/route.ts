// Sprint PF Fatia 2 — Summary consolidado de cartões pro dashboard.
//
// Deixa pronto pro próximo sprint (dashboard PF) sem refactor:
//   - totalLimit/used/available (KPI)
//   - currentMonthInvoiceTotal/nextMonthInvoicePreview
//   - byCard (lista de CardSummaryResult)
//   - topCategoriesOnCards (rosca-ready)
//   - invoiceHistory (12 meses passados, line chart-ready)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import {
  getProfileCreditSummary,
  isCreditCardError,
  isProfileAccessError,
} from '@/lib/credit-card/queries'

function errorResponse(err: unknown) {
  if (isProfileAccessError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isCreditCardError(err)) {
    return NextResponse.json({ erro: err.message, code: err.code }, { status: 400 })
  }
  throw err
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  try {
    const summary = await getProfileCreditSummary(user.sub, id)

    // Top categorias EM compras de cartão (últimos 90 dias)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const txCards = await prisma.personalTransaction.findMany({
      where: {
        profileId: id,
        type: 'DEBIT',
        creditCardId: { not: null },
        isInvoicePayment: false,
        date: { gte: since },
      },
      include: { category: { select: { id: true, name: true, color: true } } },
    })
    const byCategoryMap = new Map<
      string,
      { id: string; name: string; color: string | null; total: number }
    >()
    for (const t of txCards) {
      if (!t.category) continue
      const ex = byCategoryMap.get(t.category.id)
      if (ex) ex.total += t.amount
      else byCategoryMap.set(t.category.id, {
        id: t.category.id,
        name: t.category.name,
        color: t.category.color,
        total: t.amount,
      })
    }
    const topCategoriesOnCards = [...byCategoryMap.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // Histórico das últimas 12 invoices por mês (consolidado todos os cartões)
    const invoicesAll = await prisma.creditCardInvoice.findMany({
      where: { creditCard: { profileId: id, isActive: true } },
      orderBy: { closingDate: 'desc' },
      take: 12 * 10, // ~10 cartões max
      select: { reference: true, totalAmount: true, paidAmount: true },
    })
    const byMonthMap = new Map<string, { reference: string; total: number; paid: number }>()
    for (const inv of invoicesAll) {
      const ex = byMonthMap.get(inv.reference)
      if (ex) {
        ex.total += inv.totalAmount
        ex.paid += inv.paidAmount
      } else {
        byMonthMap.set(inv.reference, {
          reference: inv.reference,
          total: inv.totalAmount,
          paid: inv.paidAmount,
        })
      }
    }
    const invoiceHistory = [...byMonthMap.values()]
      .sort((a, b) => a.reference.localeCompare(b.reference))
      .slice(-12) // últimos 12 meses

    return NextResponse.json({
      summary,
      topCategoriesOnCards,
      invoiceHistory,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
