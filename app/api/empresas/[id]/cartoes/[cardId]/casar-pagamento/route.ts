// Sprint Cartao R2 (24/06/2026) — casar/desfazer pagamento <-> cartao.
//
// POST   { txId } -> vincula a tx ao cartao (isCardPayment=true,
//                    businessCreditCardId=cardId, remove categoryId que tinha)
// DELETE ?txId=xxx -> desfaz (mantem isCardPayment=true mas zera cardId)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: Promise<{ id: string; cardId: string }> }

async function ensureAccess(userId: string, companyId: string, cardId: string) {
  const acesso = await prisma.userCompany.findFirst({
    where: { userId, companyId },
    select: { companyId: true },
  })
  if (!acesso) return null
  return prisma.businessCreditCard.findFirst({
    where: { id: cardId, companyId },
  })
}

const casarSchema = z.object({
  txId: z.string().cuid(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  const card = await ensureAccess(user.sub, companyId, cardId)
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  let body
  try {
    body = casarSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { erro: 'Body inválido', details: err instanceof z.ZodError ? err.issues : String(err) },
      { status: 400 },
    )
  }

  // Tx tem que ser da MESMA empresa
  const targetTx = await prisma.transaction.findFirst({
    where: {
      id: body.txId,
      bankAccount: { companyId },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      isCardPayment: true,
      businessCreditCardId: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  })
  if (!targetTx) {
    return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
  }
  if (targetTx.type === 'CREDIT') {
    return NextResponse.json(
      { erro: 'Apenas DEBIT pode ser pagamento de cartão' },
      { status: 400 },
    )
  }

  // Snapshot pra delta no DRE
  const previousCategoryId = targetTx.categoryId
  const previousCategoryName = targetTx.category?.name ?? null

  // Atomic: marca como pagamento de cartao + vincula ao cartao + zera categoria
  // (pra DRE filtrar isCardPayment=true)
  const updated = await prisma.transaction.update({
    where: { id: targetTx.id },
    data: {
      isCardPayment: true,
      businessCreditCardId: cardId,
      // Remove categoria de despesa (se tinha) — pagamento nao eh despesa
      categoryId: null,
    },
    select: {
      id: true,
      isCardPayment: true,
      businessCreditCardId: true,
      categoryId: true,
    },
  })

  return NextResponse.json({
    casado: true,
    transactionId: updated.id,
    previousCategoryId,
    previousCategoryName,
    deltaDespesaRemovidoDoDRE: targetTx.amount,
  })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  const card = await ensureAccess(user.sub, companyId, cardId)
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  const txId = request.nextUrl.searchParams.get('txId')
  if (!txId) {
    return NextResponse.json({ erro: 'txId obrigatório' }, { status: 400 })
  }

  const targetTx = await prisma.transaction.findFirst({
    where: {
      id: txId,
      bankAccount: { companyId },
      businessCreditCardId: cardId,
    },
    select: { id: true, isCardPayment: true },
  })
  if (!targetTx) {
    return NextResponse.json(
      { erro: 'Transação não encontrada ou não casada com este cartão' },
      { status: 404 },
    )
  }

  // Desfaz vinculo (volta pra "aguardando casar"). Mantem isCardPayment=true.
  // Caller pode optar por unset isCardPayment via /api/transacoes/[id] PATCH
  // se quiser reverter pra despesa normal (caso 100% manual).
  const updated = await prisma.transaction.update({
    where: { id: targetTx.id },
    data: { businessCreditCardId: null },
    select: { id: true, isCardPayment: true, businessCreditCardId: true },
  })

  return NextResponse.json({ desfeito: true, transactionId: updated.id, state: updated })
}
