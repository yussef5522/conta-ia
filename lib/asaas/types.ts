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
