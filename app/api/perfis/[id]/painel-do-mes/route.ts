// ⭐ PF FASE 1 (13/09) — o painel do mês. Só leitura, só do perfil.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkProfileAccess } from '@/lib/personal-profile/queries'
import { painelDoMes, type LinhaDoMes } from '@/lib/pf-extrato/painel-do-mes'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  try { await checkProfileAccess(user.sub, profileId) }
  catch { return NextResponse.json({ erro: 'Perfil não encontrado' }, { status: 404 }) }

  const mes = request.nextUrl.searchParams.get('mes') ?? new Date().toISOString().slice(0, 7)
  const de = new Date(`${mes}-01T00:00:00.000Z`)
  const ate = new Date(de); ate.setUTCMonth(ate.getUTCMonth() + 1)

  const [txs, contas, cards] = await Promise.all([
    prisma.personalTransaction.findMany({
      // ⚠️ o painel é do EXTRATO DA CONTA: compra de cartão vive no módulo de cartões, e
      // somar as duas aqui contaria a mesma despesa duas vezes
      where: { profileId, date: { gte: de, lt: ate }, OR: [{ bankAccountId: { not: null } }, { isInvoicePayment: true }] },
      select: { id: true, date: true, description: true, amount: true, type: true, categoryId: true, isInvoicePayment: true, category: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.personalBankAccount.findMany({ where: { profileId, isActive: true }, select: { id: true, name: true, bankName: true, balance: true, ledgerBal: true, ledgerBalDate: true } }),
    prisma.creditCard.findMany({ where: { profileId, isActive: true }, select: { id: true, name: true, lastDigits: true, dueDay: true } }),
  ])

  const linhas: LinhaDoMes[] = txs.map((t) => ({
    id: t.id, data: t.date, descricao: t.description,
    valorComSinal: t.type === 'CREDIT' ? Math.abs(t.amount) : -Math.abs(t.amount),
    categoriaId: t.categoryId, categoriaNome: t.category?.name ?? null,
    ehPagamentoDeFatura: t.isInvoicePayment,
  }))

  const faturas = cards.length
    ? await prisma.creditCardInvoice.findMany({
      where: { creditCardId: { in: cards.map((c) => c.id) } },
      select: { id: true, creditCardId: true, reference: true, status: true, totalAmount: true, paidAmount: true, dueDate: true },
      orderBy: { reference: 'desc' },
    })
    : []

  return NextResponse.json({
    ...painelDoMes(mes, linhas),
    lista: linhas.slice(0, 60),
    // ⭐ a conferência de saldo mora no CARD DA CONTA (a régua de 10/09: uma casa só)
    contas: contas.map((c) => ({
      ...c,
      conferencia: c.ledgerBal == null ? null
        : Math.abs(c.balance - c.ledgerBal) <= 0.02
          ? { estado: 'BATE' as const, frase: `confere com o banco em ${c.ledgerBalDate?.toISOString().slice(0, 10)}` }
          : { estado: 'DIVERGE' as const, frase: `difere do banco em ${(c.balance - c.ledgerBal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` },
    })),
    cartoes: cards.map((c) => {
      const f = faturas.find((x) => x.creditCardId === c.id)
      return {
        ...c,
        fatura: f ? { referencia: f.reference, status: f.status, total: f.totalAmount, pago: f.paidAmount, vencimento: f.dueDate } : null,
      }
    }),
  })
}
