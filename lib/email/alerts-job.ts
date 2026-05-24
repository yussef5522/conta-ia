// Sprint 4.0.4 — gerador de emails de alertas.
//
// Lógica:
//   1. Busca users com emailAlertsEnabled=true + frequency compatível com hoje
//      (DAILY = todo dia útil; WEEKLY = só segunda)
//   2. Para cada user: pra cada empresa do user, calcula AlertasResult
//   3. Se tem alertas (count > 0): buildAlertEmail + sendEmail
//   4. Audit log de envios

import { prisma } from '@/lib/db'
import { sendEmail } from './send'
import { buildAlertEmail } from './alerts-template'
import { classifyAlertas, type VencimentoTx } from '@/lib/dashboard/alertas'

export interface RunAlertsJobResult {
  usersProcessed: number
  emailsSent: number
  emailsSkippedNoData: number
  errors: number
  errorDetails: Array<{ userId: string; error: string }>
}

export interface RunAlertsJobOptions {
  // Pra testes — força considerar como dia da semana específico
  referenceDate?: Date
  // Pra trigger manual — força envio mesmo se frequency não bate hoje
  force?: boolean
  // Pra testes / preview — não envia de fato, só calcula
  dryRun?: boolean
  // Pra testes — base URL do dashboard (default app.caixaos.com.br)
  baseUrl?: string
}

const DEFAULT_BASE_URL = 'https://app.caixaos.com.br'

function shouldRunForFrequency(
  frequency: string,
  referenceDate: Date,
  force: boolean,
): boolean {
  if (force) return true
  if (frequency === 'NONE') return false
  if (frequency === 'WEEKLY') {
    return referenceDate.getUTCDay() === 1
  }
  if (frequency === 'DAILY') {
    const day = referenceDate.getUTCDay()
    return day >= 1 && day <= 5
  }
  // Frequency desconhecida → seguro NÃO rodar
  return false
}

export async function runAlertsJob(
  options: RunAlertsJobOptions = {},
): Promise<RunAlertsJobResult> {
  const referenceDate = options.referenceDate ?? new Date()
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL

  const result: RunAlertsJobResult = {
    usersProcessed: 0,
    emailsSent: 0,
    emailsSkippedNoData: 0,
    errors: 0,
    errorDetails: [],
  }

  // Busca users opt-in com pelo menos 1 empresa
  const users = await prisma.user.findMany({
    where: { emailAlertsEnabled: true },
    select: {
      id: true,
      name: true,
      email: true,
      emailAlertsFrequency: true,
      companies: {
        select: { company: { select: { id: true, name: true, tradeName: true } } },
      },
    },
  })

  const dashboardUrl = `${baseUrl}/dashboard`
  const configUrl = `${baseUrl}/configuracoes/alertas`

  for (const user of users) {
    if (!shouldRunForFrequency(user.emailAlertsFrequency, referenceDate, !!options.force)) {
      continue
    }
    result.usersProcessed++

    try {
      // Pra cada empresa do user, calcula alertas. Envia 1 email por (user, empresa)
      // só quando tem ao menos 1 alerta.
      for (const uc of user.companies) {
        const company = uc.company
        const pendentes = await prisma.transaction.findMany({
          where: {
            OR: [
              { bankAccount: { companyId: company.id } },
              { supplier: { companyId: company.id } },
              { customer: { companyId: company.id } },
              { category: { companyId: company.id } },
            ],
            lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
            status: 'PENDING',
            reconciledWithId: null,
          },
          select: { id: true, amount: true, dueDate: true },
        })

        const vencimentoTxs: VencimentoTx[] = pendentes.map((p) => ({
          id: p.id,
          amount: p.amount,
          dueDate: p.dueDate,
        }))
        const alertas = classifyAlertas(vencimentoTxs, referenceDate)

        const payload = buildAlertEmail({
          userName: user.name,
          companyName: company.tradeName ?? company.name,
          alertas,
          dashboardUrl,
          configUrl,
        })

        if (payload.isEmpty) {
          result.emailsSkippedNoData++
          continue
        }

        if (options.dryRun) {
          result.emailsSent++
          continue
        }

        const sendResult = await sendEmail({
          to: user.email,
          subject: payload.subject,
          html: payload.html,
          type: 'alert-vencimento',
          userId: user.id,
        })

        if (sendResult.success) {
          result.emailsSent++
        } else if (!sendResult.skipped) {
          result.errors++
          result.errorDetails.push({
            userId: user.id,
            error: sendResult.error ?? 'unknown',
          })
        }
      }
    } catch (e) {
      result.errors++
      result.errorDetails.push({
        userId: user.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return result
}

// Export pra testes
export const __test = { shouldRunForFrequency }
