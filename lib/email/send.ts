// Wrapper genérico de envio Resend — Sprint 1.5.
// Logging estruturado + try/catch + tipos estritos.
// Retorna { success, id?, error? } pra caller decidir o que fazer.

import { getResend, isResendConfigured, FROM_FULL } from './client'

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  // Identificador do tipo pra logs/audit (ex: 'forgot-password', 'team-invite')
  type: string
  // Pra audit log no caller (não usado aqui)
  userId?: string | null
}

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
  skipped?: boolean // true quando RESEND_API_KEY ausente (dev local)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // Validação básica do destinatário
  if (!EMAIL_REGEX.test(input.to)) {
    return { success: false, error: 'Email destinatário inválido' }
  }

  // Modo dev sem API key — log e retorna sucesso simulado
  if (!isResendConfigured()) {
    console.warn(
      `[EMAIL skipped] type=${input.type} to=${input.to} (RESEND_API_KEY ausente)`,
    )
    return { success: true, skipped: true }
  }

  try {
    const resend = getResend()
    const result = await resend.emails.send({
      from: FROM_FULL,
      to: input.to,
      subject: input.subject,
      html: input.html,
    })

    // SDK v6: retorna { data, error } sem throw.
    if (result.error) {
      // Sanitize: nunca incluir headers ou body em log público
      console.error(
        `[EMAIL fail] type=${input.type} to=${input.to} error=${result.error.message}`,
      )
      return { success: false, error: result.error.message }
    }

    console.log(
      `[EMAIL sent] type=${input.type} to=${input.to} id=${result.data?.id ?? '?'}`,
    )
    return { success: true, id: result.data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error(`[EMAIL throw] type=${input.type} to=${input.to} err=${msg}`)
    return { success: false, error: msg }
  }
}

// Mascara email pra UX ("admin@contaia.com.br" → "a***n@contaia.com.br")
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!user || !domain) return email
  if (user.length <= 2) return `${user[0]}***@${domain}`
  return `${user[0]}***${user[user.length - 1]}@${domain}`
}
