// Sprint Cartao Credito PJ (24/06/2026) — gate proprio (sem ZDR).

export interface CreditCardPjFlagEnv {
  NODE_ENV?: string
  CREDIT_CARD_PJ_ENABLED?: string
}

export interface CreditCardPjFlagResult {
  allowed: boolean
  reason: 'OK' | 'DISABLED'
  message: string | null
}

export function checkCreditCardPjFlag(
  env: CreditCardPjFlagEnv = process.env as CreditCardPjFlagEnv,
): CreditCardPjFlagResult {
  const enabled = (env.CREDIT_CARD_PJ_ENABLED ?? '').trim().toLowerCase() === 'true'
  if (enabled) return { allowed: true, reason: 'OK', message: null }
  return {
    allowed: false,
    reason: 'DISABLED',
    message:
      'Importação de fatura de cartão PJ não está ativada. Defina CREDIT_CARD_PJ_ENABLED=true no .env.',
  }
}
