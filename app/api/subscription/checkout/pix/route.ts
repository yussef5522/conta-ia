// Sprint Asaas 3B (31/05/2026) — POST /api/subscription/checkout/pix
//
// Cria cobrança Pix one-off pro plano escolhido. Retorna QR base64 +
// copia-cola pro front mostrar.
//
// ⚠️ Bloqueio crítico: GRANTED (sem trial, acesso vitalício) NÃO pode
// criar cobrança. Yussef bate aqui e geraria cobrança sandbox sem
// motivo. → 403 GRANTED_NO_CHECKOUT.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLANOS, type PlanoId } from '@/lib/planos/config'
import { isValidCpfCnpj, onlyDigits } from '@/lib/validation/cpf-cnpj'
import { createOrGetCustomerForUser } from '@/lib/asaas/customers'
import { createPixCharge, getPixQrCode } from '@/lib/asaas/pix'
import { getOrCreateSubscription } from '@/lib/subscription/queries'

const schema = z.object({
  planId: z.enum(['inicio', 'controle', 'inteligencia', 'performance']),
  ciclo: z.enum(['MONTHLY', 'YEARLY']),
  cpfCnpj: z.string().min(11),
})

export async function POST(request: NextRequest) {
  const sessionUser = await getAuthUser(request)
  if (!sessionUser) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const cpfCnpjDigits = onlyDigits(parsed.data.cpfCnpj)
  if (!isValidCpfCnpj(cpfCnpjDigits)) {
    return NextResponse.json(
      { erro: 'CPF/CNPJ inválido', code: 'INVALID_CPF_CNPJ' },
      { status: 400 },
    )
  }

  const planId = parsed.data.planId as PlanoId
  const plano = PLANOS.find((p) => p.id === planId)
  if (!plano) {
    return NextResponse.json({ erro: 'Plano não existe' }, { status: 400 })
  }

  // 🚨 Bloqueio GRANTED (Yussef + family acidentalmente clicando)
  const sub = await getOrCreateSubscription(sessionUser.sub)
  if (sub.status === 'GRANTED') {
    return NextResponse.json(
      {
        erro: 'Sua conta tem acesso vitalício. Nenhuma assinatura necessária.',
        code: 'GRANTED_NO_CHECKOUT',
      },
      { status: 403 },
    )
  }
  if (sub.status === 'ACTIVE') {
    return NextResponse.json(
      {
        erro: 'Você já tem uma assinatura ativa.',
        code: 'ALREADY_ACTIVE',
      },
      { status: 409 },
    )
  }

  // Valor + dias de acesso conforme ciclo
  const valor =
    parsed.data.ciclo === 'YEARLY' ? plano.precoAnual * 12 : plano.precoMensal
  const diasAcesso = parsed.data.ciclo === 'YEARLY' ? 365 : 30

  // Persiste cpfCnpj se faltava (User não tem ainda)
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.sub },
    select: { id: true, name: true, email: true, cpfCnpj: true },
  })
  if (!user) {
    return NextResponse.json({ erro: 'User não encontrado' }, { status: 404 })
  }
  if (!user.cpfCnpj) {
    await prisma.user.update({
      where: { id: user.id },
      data: { cpfCnpj: cpfCnpjDigits },
    })
  }

  // Cria/reusa customer no Asaas
  const { customer } = await createOrGetCustomerForUser({
    userId: user.id,
    name: user.name,
    email: user.email,
    cpfCnpj: cpfCnpjDigits,
  })

  // dueDate = hoje + 1 dia (Asaas exige future)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const dueDate = tomorrow.toISOString().slice(0, 10)

  const desc =
    parsed.data.ciclo === 'YEARLY'
      ? `CAIXAOS · ${plano.nome} · 12 meses`
      : `CAIXAOS · ${plano.nome} · 1 mês`

  const payment = await createPixCharge({
    customer: customer.id,
    value: Math.round(valor * 100) / 100,
    dueDate,
    description: desc,
    externalReference: `user:${user.id}|plan:${planId}|ciclo:${parsed.data.ciclo}|dias:${diasAcesso}`,
  })

  const qr = await getPixQrCode(payment.id)

  return NextResponse.json({
    paymentId: payment.id,
    valor,
    diasAcesso,
    plano: { id: plano.id, nome: plano.nome },
    ciclo: parsed.data.ciclo,
    qrImageBase64: qr.encodedImage,
    copiaECola: qr.payload,
    expiresAt: qr.expirationDate,
  })
}
