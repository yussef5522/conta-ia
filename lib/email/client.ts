// Cliente Resend — Sprint 1.5.
// Inicializado lazy pra não quebrar build/tests quando RESEND_API_KEY ausente.

import { Resend } from 'resend'

let resendInstance: Resend | null = null

export function getResend(): Resend {
  if (resendInstance) return resendInstance
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY não configurada no .env')
  }
  resendInstance = new Resend(key)
  return resendInstance
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'no-reply@caixaos.com.br'
export const FROM_NAME = 'CAIXAOS'
export const FROM_FULL = `${FROM_NAME} <${FROM_EMAIL}>`

// Base URL pública (X-Forwarded-Host fix da Sprint 1.4):
// caller injeta via header pra evitar https://localhost:3001 em emails.
export function publicAppUrl(forwardedHost?: string | null, forwardedProto?: string | null): string {
  if (forwardedHost) {
    const proto = forwardedProto ?? 'https'
    return `${proto}://${forwardedHost}`
  }
  // Fallback pro env (configurar APP_PUBLIC_URL=https://app.caixaos.com.br se quiser)
  return process.env.APP_PUBLIC_URL ?? 'https://app.caixaos.com.br'
}
