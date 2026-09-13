// ⭐ O DASHBOARD DA PF (13/09) — leitura, só do perfil, tudo derivado.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkProfileAccess } from '@/lib/personal-profile/queries'
import { montarDashboard, type FaturaDoDash } from '@/lib/pf-dashboard/dashboard'
import type { LinhaDoMes } from '@/lib/pf-extrato/painel-do-mes'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  try { await checkProfileAccess(user.sub, profileId) }
  catch { return NextResponse.json({ erro: 'Perfil não encontrado' }, { status: 404 }) }

  const mes = request.nextUrl.searchParams.get('mes') ?? new Date().toISOString().slice(0, 7)
  // ⚠️ o BALANÇO precisa dos 6 meses (o desktop mostra 6, o celular corta pros 4 últimos) — então a janela do histórico começa 3 meses antes.
  // Uma segunda consulta por mês daria 4 fontes pro mesmo número.
  const de = new Date(`${mes}-01T00:00:00.000Z`); de.setUTCMonth(de.getUTCMonth() - 5)
  const ate = new Date(`${mes}-01T00:00:00.000Z`); ate.setUTCMonth(ate.getUTCMonth() + 1)

  const [txs, contas, cards, perfil] = await Promise.all([
    prisma.personalTransaction.findMany({
      where: { profileId, date: { gte: de, lt: ate }, OR: [{ bankAccountId: { not: null } }, { isInvoicePayment: true }] },
      select: {
        id: true, date: true, description: true, amount: true, type: true, categoryId: true,
        isInvoicePayment: true, dedupHash: true, origin: true,
        category: { select: { name: true } }, bridge: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.personalBankAccount.findMany({ where: { profileId, isActive: true }, select: { id: true, name: true, balance: true, ledgerBal: true, ledgerBalDate: true } }),
    prisma.creditCard.findMany({ where: { profileId, isActive: true }, select: { id: true, name: true, lastDigits: true, closingDay: true, creditLimit: true } }),
    prisma.personalProfile.findUnique({ where: { id: profileId }, select: { name: true } }),
  ])

  const invoices = cards.length
    ? await prisma.creditCardInvoice.findMany({
      where: { creditCardId: { in: cards.map((c) => c.id) } },
      select: { id: true, creditCardId: true, reference: true, dueDate: true, totalAmount: true, paidAmount: true },
      orderBy: { reference: 'desc' },
    })
    : []
  const porCard = new Map(cards.map((c) => [c.id, c]))
  const faturas: FaturaDoDash[] = invoices.map((f) => {
    const c = porCard.get(f.creditCardId)!
    return {
      invoiceId: f.id, cardId: c.id, cardNome: c.name, lastDigits: c.lastDigits,
      fechaDia: c.closingDay, limite: c.creditLimit, referencia: f.reference,
      vencimento: f.dueDate, total: f.totalAmount, pago: f.paidAmount,
    }
  })

  const linhas: LinhaDoMes[] = txs.map((t) => ({
    id: t.id, data: t.date, descricao: t.description,
    valorComSinal: t.type === 'CREDIT' ? Math.abs(t.amount) : -Math.abs(t.amount),
    categoriaId: t.categoryId, categoriaNome: t.category?.name ?? null,
    ehPagamentoDeFatura: t.isInvoicePayment,
  }))
  const doMes = linhas.filter((l) => l.data.toISOString().slice(0, 7) === mes)

  const pontes = txs.filter((t) => t.bridge && t.date.toISOString().slice(0, 7) === mes && t.type === 'CREDIT')

  const dash = montarDashboard({
    mes, hoje: new Date(), linhas: doMes, historico: linhas, mesesNoBalanco: 6,
    saldoNasContas: contas.reduce((s, c) => s + c.balance, 0),
    faturas, pontesDoMes: pontes.map((t) => ({ valor: Math.abs(t.amount) })),
  })

  return NextResponse.json({
    ...dash,
    nome: perfil?.name ?? '',
    contas,
    // ⭐ os selos de vínculo: "casou ✓" (veio do extrato e casou) e "ponte PJ ✓"
    ultimos: txs.slice(0, 5).map((t) => ({
      id: t.id, data: t.date, descricao: t.description,
      valorComSinal: t.type === 'CREDIT' ? Math.abs(t.amount) : -Math.abs(t.amount),
      categoriaNome: t.category?.name ?? null,
      ehPagamentoDeFatura: t.isInvoicePayment,
      temPonte: !!t.bridge,
      casou: !!t.bridge && t.origin === 'OFX',
    })),
  })
}
