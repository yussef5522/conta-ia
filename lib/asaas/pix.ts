// Sprint Asaas 3B (31/05/2026) — Pix one-off (1 mês de acesso).
//
// Fluxo:
//   1. createPixCharge: POST /v3/payments {customer, billingType:PIX, value,
//      dueDate, description}
//   2. getPixQrCode: GET /v3/payments/{id}/pixQrCode → {encodedImage,
//      payload, expirationDate}
//   3. getPaymentStatus: GET /v3/payments/{id} → status (polling 3s da UI)

import { asaasRequest, type FetchLike } from './client'

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS'

export interface AsaasPayment {
  id: string
  customer: string
  billingType: string
  value: number
  status: AsaasPaymentStatus
  dueDate: string
  description?: string
  externalReference?: string
  dateCreated: string
}

export interface PixQrCodeResponse {
  encodedImage: string // base64 image
  payload: string // copia-cola
  expirationDate: string // ISO
}

export interface CreatePixChargeInput {
  customer: string // id Asaas
  value: number
  dueDate: string // YYYY-MM-DD
  description: string
  externalReference?: string
}

/** Cria cobrança Pix one-off. */
export async function createPixCharge(
  input: CreatePixChargeInput,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>(
    '/payments',
    {
      method: 'POST',
      body: {
        customer: input.customer,
        billingType: 'PIX',
        value: input.value,
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
      },
    },
    deps,
  )
}

/** Pega QR code + copia-cola pra um payment Pix. */
export async function getPixQrCode(
  paymentId: string,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<PixQrCodeResponse> {
  return asaasRequest<PixQrCodeResponse>(
    `/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
    { method: 'GET' },
    deps,
  )
}

/** Pega status atual do pagamento (polling). */
export async function getPaymentStatus(
  paymentId: string,
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>(
    `/payments/${encodeURIComponent(paymentId)}`,
    { method: 'GET' },
    deps,
  )
}

/** True quando o pagamento foi confirmado (Asaas chama de RECEIVED em Pix). */
export function isPaymentConfirmed(status: AsaasPaymentStatus): boolean {
  return (
    status === 'RECEIVED' ||
    status === 'CONFIRMED' ||
    status === 'RECEIVED_IN_CASH'
  )
}
