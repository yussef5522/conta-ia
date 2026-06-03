// Sprint PF Fatia 2 (02/06/2026) — extraído de lib/asaas/webhook.ts.
//
// Soma N meses preservando UTC com clamp pro último dia do mês alvo
// quando original > dias do mês alvo. Ex: 31/jan + 1 mês = 28/fev
// (não 03/mar). 29/fev bissexto + 1 ano = 28/fev não-bissexto.
//
// Reuso: Sprint 3C webhook (calculateNextPeriodEnd) e Fatia 2 cartão
// (build-installments + calculate-invoice-reference).

export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  // Cria com dia 1 do mês alvo, preservando hora/min/sec/ms
  const target = new Date(
    Date.UTC(
      y,
      m + n,
      1,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  )
  // Último dia do mês alvo
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target
}

export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12)
}

/**
 * Último dia do mês de uma data (em UTC).
 * Ex: lastDayOfMonthUTC(Date(2026, 1, 15)) = 28 (fev 2026).
 */
export function lastDayOfMonthUTC(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}
