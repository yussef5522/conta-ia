// Sprint Asaas FATIA 3A (31/05/2026) — Customers (cadastro do pagador).
//
// FATIA 3A NÃO chama este código em rota de produção (cpfCnpj só é
// coletado em 3B). Mas deixamos a função pronta + testada agora pra
// 3B só plugar.

import { prisma } from '@/lib/db'
import { asaasRequest, type FetchLike } from './client'
import type { AsaasCustomer, CreateAsaasCustomerInput } from './types'

/** Cria um customer novo no Asaas. */
export async function createAsaasCustomer(
  input: CreateAsaasCustomerInput,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(
    '/customers',
    { method: 'POST', body: input },
    deps,
  )
}

/** Busca customer pelo ID Asaas. */
export async function getAsaasCustomer(
  customerId: string,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(
    `/customers/${encodeURIComponent(customerId)}`,
    { method: 'GET' },
    deps,
  )
}

export interface CreateOrGetForUserInput {
  userId: string
  name: string
  email: string
  cpfCnpj: string
  mobilePhone?: string
}

/**
 * Idempotente: se `Subscription.gatewayCustomerId` já existe pra esse
 * userId, retorna o customer correspondente. Senão cria um novo no
 * Asaas com externalReference=userId (dedup secundária) e salva o ID.
 *
 * Pré-requisito: o User precisa ter Subscription (qualquer status).
 */
export async function createOrGetCustomerForUser(
  input: CreateOrGetForUserInput,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<{ customer: AsaasCustomer; created: boolean }> {
  const sub = await prisma.subscription.findUnique({
    where: { userId: input.userId },
    select: { id: true, gatewayCustomerId: true },
  })
  if (!sub) {
    throw new Error(
      `User ${input.userId} não tem Subscription. Crie via createTrialSubscription antes.`,
    )
  }

  if (sub.gatewayCustomerId) {
    const existing = await getAsaasCustomer(sub.gatewayCustomerId, deps)
    return { customer: existing, created: false }
  }

  const created = await createAsaasCustomer(
    {
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email,
      mobilePhone: input.mobilePhone,
      externalReference: input.userId,
    },
    deps,
  )

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { gatewayCustomerId: created.id },
  })

  return { customer: created, created: true }
}
