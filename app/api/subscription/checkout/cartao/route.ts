// Sprint Asaas 3B (31/05/2026) — POST /api/subscription/checkout/cartao
//
// Cria sessão de checkout HOSTED RECURRENT cartão.
// Retorna a URL pro frontend redirecionar (asaas.com).
//
// 🛡️ Nenhum dado de cartão neste endpoint. Cartão só toca asaas.com.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLANOS, type PlanoId } from '@/lib/planos/config'
import { isValidCpfCnpj, onlyDigits } from '@/lib/validation/cpf-cnpj'
import { createOrGetCustomerForUser } from '@/lib/asaas/customers'
import {
  buildCheckoutHostedUrl,
  createHostedCheckout,
} from '@/lib/asaas/checkout-hosted'
import { getAsaasEnv } from '@/lib/asaas/client'
import { getOrCreateSubscription } from '@/lib/subscription/queries'

const schema = z.object({
  planId: z.enum(['inicio', 'controle', 'inteligencia', 'performance']),
  ciclo: z.enum(['MONTHLY', 'YEARLY']),
  cpfCnpj: z.string().min(11),
})

function appUrlFromRequest(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  return host ? `${proto}://${host}` : 'https://app.caixaos.com.br'
}

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

  // 🚨 Bloqueio GRANTED
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
      { erro: 'Você já tem uma assinatura ativa.', code: 'ALREADY_ACTIVE' },
      { status: 409 },
    )
  }

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

  // Cria customer no Asaas (idempotente)
  await createOrGetCustomerForUser({
    userId: user.id,
    name: user.name,
    email: user.email,
    cpfCnpj: cpfCnpjDigits,
  })

  // Cria checkout hosted
  const ciclo = parsed.data.ciclo
  const valor = ciclo === 'YEARLY' ? plano.precoAnual * 12 : plano.precoMensal
  const today = new Date()
  const nextDueDate = today.toISOString().slice(0, 10)
  const endDate = new Date(today.getTime() + 5 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const appUrl = appUrlFromRequest(request)
  const checkout = await createHostedCheckout({
    customerData: {
      name: user.name,
      email: user.email,
      cpfCnpj: cpfCnpjDigits,
    },
    items: [
      {
        name: `CAIXAOS ${plano.nome} (${ciclo === 'YEARLY' ? 'anual' : 'mensal'})`,
        description: plano.tagline,
        quantity: 1,
        value: Math.round(valor * 100) / 100,
      },
    ],
    callback: {
      successUrl: `${appUrl}/assinar/sucesso`,
      cancelUrl: `${appUrl}/assinar?cancel=1`,
      expiredUrl: `${appUrl}/assinar?expired=1`,
    },
    subscription: {
      cycle: ciclo,
      nextDueDate,
      endDate,
    },
    externalReference: `user:${user.id}|plan:${planId}|ciclo:${ciclo}`,
    minutesToExpire: 30,
  })

  // Salva checkoutSessionId pra dedup + callback
  await prisma.subscription.updateMany({
    where: { userId: user.id },
    data: { checkoutSessionId: checkout.id },
  })

  const env = getAsaasEnv()
  const checkoutUrl = buildCheckoutHostedUrl(env, checkout.id)

  return NextResponse.json({
    checkoutId: checkout.id,
    checkoutUrl,
    env, // pro front saber se está em sandbox
  })
}
