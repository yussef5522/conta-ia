// Sprint 4.0.1.b — scheduler node-cron pra geração diária de PAYABLE/RECEIVABLE.
//
// Job roda 06:00 America/Sao_Paulo todo dia, antes do horário comercial.
// Idempotente: constraint @@unique([recurringScheduleId, dueDate]) bloqueia
// duplicação se rodar 2x no mesmo dia.
//
// PM2 fork mode (1 instance) garante que só 1 worker dispara o cron.
// Se algum dia virar cluster, precisará de lock (Redis SETNX ou pg advisory lock).

import cron from 'node-cron'
import { generateRecurringTransactions } from './generator'

const RECURRENCE_CRON = '0 6 * * *' // 06:00 todo dia
const TIMEZONE = 'America/Sao_Paulo'

let started = false

export function startRecurrenceScheduler() {
  if (started) {
    console.log('[Recurrence] Scheduler já iniciado — skip')
    return
  }
  started = true

  cron.schedule(
    RECURRENCE_CRON,
    async () => {
      const startedAt = new Date()
      console.log('[Recurrence] Job iniciado em', startedAt.toISOString())
      try {
        const result = await generateRecurringTransactions()
        const elapsedMs = Date.now() - startedAt.getTime()
        console.log('[Recurrence] Job concluído em', elapsedMs, 'ms:', JSON.stringify(result))
      } catch (error) {
        console.error('[Recurrence] Job FALHOU:', error)
      }
    },
    { timezone: TIMEZONE },
  )

  console.log(
    `[Recurrence] Scheduler iniciado — cron="${RECURRENCE_CRON}" tz="${TIMEZONE}"`,
  )
}
