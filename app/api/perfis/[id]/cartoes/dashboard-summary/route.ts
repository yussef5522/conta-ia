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
    const doPerfil = await prisma.creditCard.findMany({
      where: { profileId: id }, select: { id: true, name: true, lastDigits: true, brand: true },
    })
    const nomePorCartao = new Map(doPerfil.map((c) => [c.id, c.lastDigits ? `${c.name} ****${c.lastDigits}` : c.name]))
    const brandPorCartao = new Map(doPerfil.map((c) => [c.id, c.brand]))

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

    // ⚠️ CONTRATO QUEBRADO (27/08): a home do PF lia `cards` e `summary.totalDue`, e
    // este endpoint devolvia `summary.byCard` sem `totalDue`. Resultado: `cards ?? []`
    // virava lista vazia e a tela dizia **"Nenhum cartão cadastrado"** enquanto a tela
    // de Cartões mostrava o banrisul PF normalmente — duas telas, mesma fonte, uma
    // cega. ⚠️ O empty state MENTIU com cara de verdade: "nenhum cartão" é uma resposta
    // plausível, então ninguém desconfia. Bug de contrato não dá erro — dá silêncio.
    const cards = summary.byCard.map((c) => ({
      id: c.cardId,
      name: nomePorCartao.get(c.cardId) ?? '',
      brand: brandPorCartao.get(c.cardId) ?? null,
      creditLimit: c.creditLimit,
      used: c.limitUsed,
      usedPercent: c.limitUsedPercent,
      invoiceOpenAmount: c.currentInvoice
        ? Math.max(0, c.currentInvoice.totalAmount - c.currentInvoice.paidAmount)
        : 0,
    }))
    const totalDue = cards.reduce((s, c) => s + c.invoiceOpenAmount, 0)

    return NextResponse.json({
      summary: { ...summary, totalDue: Math.round((totalDue + 1e-9) * 100) / 100 },
      cards,
      topCategoriesOnCards,
      invoiceHistory,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
