// Sprint 4.0.4 — scheduler node-cron pra envio diário de alertas.
//
// Cron: '0 8 * * *' (08:00 todo dia) — a função runAlertsJob filtra dias úteis.
// Timezone: America/Sao_Paulo (mesmo padrão do recurrence scheduler).
//
// PM2 fork mode (não cluster) garante 1 execução.

import cron from 'node-cron'
import { runAlertsJob } from './alerts-job'

const ALERTS_CRON = '0 8 * * *'
const TIMEZONE = 'America/Sao_Paulo'

let started = false

export function startAlertsScheduler() {
  if (started) {
    console.log('[EmailAlerts] Scheduler já iniciado — skip')
    return
  }
  started = true

  cron.schedule(
    ALERTS_CRON,
    async () => {
      const startedAt = new Date()
      console.log('[EmailAlerts] Job iniciado em', startedAt.toISOString())
      try {
        const result = await runAlertsJob()
        const elapsedMs = Date.now() - startedAt.getTime()
        console.log('[EmailAlerts] Job concluído em', elapsedMs, 'ms:', JSON.stringify(result))
      } catch (error) {
        console.error('[EmailAlerts] Job FALHOU:', error)
      }
    },
    { timezone: TIMEZONE },
  )

  console.log(
    `[EmailAlerts] Scheduler iniciado — cron="${ALERTS_CRON}" tz="${TIMEZONE}"`,
  )
}
