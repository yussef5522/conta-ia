// Sprint Asaas FATIA 3A (31/05/2026) — Tipos compartilhados.
// Sem deps externas. Espelham SÓ os campos que de fato consumimos.

export type AsaasEnv = 'sandbox' | 'production'

export interface AsaasConfig {
  apiKey: string
  env: AsaasEnv
  baseUrl: string
}

// Erro estruturado que o Asaas retorna em chamadas 400/422.
// Ex: { errors: [ { code: 'invalid_cpfCnpj', description: '...' } ] }
export interface AsaasErrorBody {
  errors?: Array<{ code?: string; description?: string }>
}

export interface AsaasCustomer {
  id: string
  name: string
  email: string | null
  cpfCnpj: string | null
  externalReference: string | null
  dateCreated: string
}

// Resposta de POST /customers.
export interface CreateAsaasCustomerInput {
  name: string
  cpfCnpj: string
  email?: string
  externalReference?: string
  mobilePhone?: string
  notificationDisabled?: boolean
}

// ============================================================
// Sprint 3C (02/06/2026) — Webhook
// ============================================================

/**
 * Eventos de PAYMENT_* que de fato MUDAM estado da Subscription.
 * Outros eventos são tratados como IGNORED (gravados mas sem efeito).
 */
export type AsaasPaymentEventType =
  // Pagamento OK (saldo ainda não disponível)
  | 'PAYMENT_CONFIRMED'
  // Pagamento recebido (saldo disponível)
  | 'PAYMENT_RECEIVED'
  // Cobrança atrasou — vira PAST_DUE (corte só em 3D)
  | 'PAYMENT_OVERDUE'
  // Estorno total — cancela
  | 'PAYMENT_REFUNDED'
  // Cobrança removida do Asaas — cancela
  | 'PAYMENT_DELETED'
  // Chargeback iniciado — vira PAST_DUE
  | 'PAYMENT_CHARGEBACK_REQUESTED'

/** Pagamento dentro de um webhook event. Campos que consumimos. */
export interface AsaasWebhookPayment {
  object?: string
  id: string
  customer: string
  // ID da assinatura recorrente Asaas (cartão). NULL em Pix one-off.
  subscription: string | null
  value: number
  netValue?: number
  // CREDIT_CARD | PIX | BOLETO | UNDEFINED
  billingType: string
  status: string
  dueDate?: string
  paymentDate?: string | null
  externalReference: string | null
}

/** Payload completo de um webhook event do Asaas. */
export interface AsaasWebhookEvent {
  // Top-level id pra idempotência (formato: "evt_<hash>&<num>")
  id: string
  // PAYMENT_CONFIRMED, SUBSCRIPTION_CREATED, etc.
  event: string
  // null em eventos não-payment (ex: ACCOUNT_STATUS_UPDATED)
  payment?: AsaasWebhookPayment | null
  // Outros campos do payload (mantidos pra auditoria mas não tipados)
  [key: string]: unknown
}

/** Decisão de roteamento pra um evento. */
export type WebhookRouteAction = 'ACTIVATE' | 'PAST_DUE' | 'CANCEL' | 'IGNORE'

/** Status final gravado em WebhookEvent. */
export type WebhookEventStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'ERROR'

// Resposta de GET /myAccount/status (health check).
// Campos REAIS que documentamos do retorno do Asaas. Marcamos como
// opcionais pra não quebrar se eles adicionarem/removerem.
export interface AsaasAccountStatus {
  id?: string
  // STATUS possíveis: AWAITING_APPROVAL | APPROVED | PENDING | REJECTED
  commercialInfo?: { status?: string; statusReason?: string }
  bankAccountInfo?: { status?: string }
  documentation?: { status?: string }
  general?: { status?: string }
}
