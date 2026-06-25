// Sprint Cartao R2 (24/06/2026) — pagamentos de cartao aguardando casar.
//
// GET /api/empresas/[id]/cartoes/pagamentos-pendentes
//   Lista tx com isCardPayment=true E businessCreditCardId=null
//   (= "aguardando casar com fatura"). Janela 120 dias atras.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }
  const acesso = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId },
    select: { companyId: true },
  })
  if (!acesso) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }

  const since = new Date()
  since.setDate(since.getDate() - 120)

  const pendentes = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      isCardPayment: true,
      businessCreditCardId: null,
      date: { gte: since },
    },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      bankAccountId: true,
      categoryId: true,
      category: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({
    pendentes: pendentes.map((p) => ({
      id: p.id,
      date: p.date.toISOString().slice(0, 10),
      description: p.description,
      amount: p.amount,
      bankAccountId: p.bankAccountId,
      bankAccountName: p.bankAccount?.name ?? null,
      currentCategoryId: p.categoryId,
      currentCategoryName: p.category?.name ?? null,
    })),
    total: pendentes.length,
    totalAmount: pendentes.reduce((s, p) => s + p.amount, 0),
  })
}
