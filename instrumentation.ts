// Next.js instrumentation hook — Sprint 4.0.1.b.
// Roda 1x quando o servidor inicia (Node runtime apenas — não Edge).
// Usado pra startar o scheduler node-cron da recurrence.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startRecurrenceScheduler } = await import('./lib/recurrence/scheduler')
    startRecurrenceScheduler()
    // Sprint 4.0.4 — alertas de vencimento diários (08:00 BRT, dias úteis)
    const { startAlertsScheduler } = await import('./lib/email/alerts-scheduler')
    startAlertsScheduler()
  }
}
