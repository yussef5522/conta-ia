// Sprint Asaas 3B (31/05/2026) — Checkout hosted RECURRENT cartão.
//
// 🛡️ Garantia PCI: nenhum dado de cartão neste lib. O cartão é
// coletado no domínio asaas.com (hosted page), tokenizado lá, e nós
// SÓ recebemos `subscriptionId`/`status` no callback.
//
// Fluxo:
//   1. createHostedCheckout: POST /v3/checkouts retornando id
//   2. Frontend redireciona pra https://(sandbox.)asaas.com/checkoutSession/show?id=ID
//   3. Cliente paga lá. Asaas redireciona pra successUrl.
//   4. getCheckoutSession: GET /v3/checkouts/{id} pra confirmar paid + pegar subscriptionId

import { asaasRequest, type FetchLike } from './client'

export type CheckoutCycle = 'MONTHLY' | 'YEARLY'
export type CheckoutStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED'

export interface CheckoutCustomerData {
  name: string
  email: string
  cpfCnpj: string
  phone?: string
}

export interface CheckoutItem {
  name: string
  description?: string
  quantity: number
  value: number
}

export interface CheckoutCallback {
  successUrl: string
  cancelUrl: string
  expiredUrl: string
}

export interface CreateHostedCheckoutInput {
  /**
   * ⚠️ Sprint 3B post-fix (01/06/2026): customerData OPCIONAL.
   *
   * Razão: o Asaas em RECURRENT exige customerData COMPLETO (name+email
   * +cpfCnpj+phone+address+addressNumber+postalCode+city — todos
   * obrigatórios) OU NENHUM (deixa cliente preencher no hosted).
   * Enviar parcial → 400. Pra evitar coletar endereço/CEP/cidade na
   * nossa UI (fricção alta + sem uso real no nosso DB), NÃO enviamos.
   * Cliente preenche TUDO no hosted Asaas (mesmo form do cartão).
   */
  customerData?: CheckoutCustomerData
  items: CheckoutItem[]
  callback: CheckoutCallback
  subscription: {
    cycle: CheckoutCycle
    nextDueDate: string // YYYY-MM-DD
    endDate: string // YYYY-MM-DD
  }
  minutesToExpire?: number // 10..1440, default 30
  /**
   * ⚠️ CRÍTICO: o externalReference é como o webhook (3C) vai
   * identificar quem pagou. NUNCA remover deste payload.
   * Formato: `user:<userId>|plan:<planId>|ciclo:<MONTHLY|YEARLY>`.
   */
  externalReference?: string
}

export interface HostedCheckoutResponse {
  id: string
  status?: CheckoutStatus
  // Asaas pode retornar mais campos — só consumimos id.
}

export interface CheckoutSession {
  id: string
  status: CheckoutStatus
  /** Subscription criada no Asaas (preenchida só quando PAID). */
  subscription?: { id: string }
  /** Payment(s) gerados (boleto/pix/cartão). */
  payments?: Array<{ id: string; status: string }>
}

/**
 * Cria checkout hosted RECURRENT cartão.
 * Resposta tem `id` que vira URL pra redirect.
 */
export async function createHostedCheckout(
  input: CreateHostedCheckoutInput,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<HostedCheckoutResponse> {
  // Monta body OMITINDO customerData quando ausente. Enviar
  // `customerData: undefined` pode quebrar a validação em alguns
  // backends — por segurança, só inclui a chave se tiver valor.
  const body: Record<string, unknown> = {
    billingTypes: ['CREDIT_CARD'],
    chargeTypes: ['RECURRENT'],
    minutesToExpire: input.minutesToExpire ?? 30,
    callback: input.callback,
    items: input.items,
    subscription: input.subscription,
    externalReference: input.externalReference,
  }
  if (input.customerData) {
    body.customerData = input.customerData
  }
  return asaasRequest<HostedCheckoutResponse>(
    '/checkouts',
    { method: 'POST', body },
    deps,
  )
}

/**
 * Lê uma sessão de checkout depois do redirect /sucesso?id=.
 * Usado pra confirmar que o pagamento foi feito e pegar subscriptionId.
 */
export async function getCheckoutSession(
  checkoutId: string,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<CheckoutSession> {
  return asaasRequest<CheckoutSession>(
    `/checkouts/${encodeURIComponent(checkoutId)}`,
    { method: 'GET' },
    deps,
  )
}

/**
 * Monta a URL pública do hosted page que o frontend redireciona.
 *
 * 🛡️ Sandbox vs production. ATENÇÃO: o domínio do hosted page do
 * Asaas é:
 *   sandbox    → https://sandbox.asaas.com/checkoutSession/show?id=ID
 *   production → https://www.asaas.com/checkoutSession/show?id=ID
 *
 * (Confirmado na doc oficial: o subdomínio segue o env.)
 */
export function buildCheckoutHostedUrl(
  env: 'sandbox' | 'production',
  checkoutId: string,
): string {
  const base =
    env === 'production'
      ? 'https://www.asaas.com'
      : 'https://sandbox.asaas.com'
  return `${base}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`
}
