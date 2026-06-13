// Fase 5 — Função pura detectAlerts.
//
// Compara medições de hoje vs ontem. Só gera alerta quando uma métrica
// SUBIU (não quando está estável OU melhorou).
//
// Isso evita o problema do lixo histórico estável (Cacula tem 116 Excel
// EFFECTED órfãs hoje — não queremos alertar todo dia por isso).

export interface MetricSnapshot {
  metricKey: string
  companyId: string | null
  value: number
}

export interface MonitorAlert {
  metricKey: string
  companyId: string | null
  valueOntem: number
  valueHoje: number
  delta: number
}

/**
 * Compara today vs yesterday e retorna alertas APENAS onde value subiu.
 *
 * Regras:
 *   - Métrica sem medição ontem → vira baseline silenciosa (sem alerta)
 *   - Métrica estável (today == yesterday) → sem alerta
 *   - Métrica melhorou (today < yesterday) → sem alerta
 *   - Métrica piorou (today > yesterday) → ALERTA
 */
export function detectAlerts(
  today: MetricSnapshot[],
  yesterday: MetricSnapshot[],
): MonitorAlert[] {
  const alerts: MonitorAlert[] = []

  for (const t of today) {
    const y = yesterday.find(
      (m) => m.metricKey === t.metricKey && m.companyId === t.companyId,
    )

    if (!y) {
      // Primeira medição — baseline silenciosa, não alerta
      continue
    }

    if (t.value > y.value) {
      alerts.push({
        metricKey: t.metricKey,
        companyId: t.companyId,
        valueOntem: y.value,
        valueHoje: t.value,
        delta: t.value - y.value,
      })
    }
    // Caso contrário: estável ou melhorou → sem alerta
  }

  return alerts
}

/**
 * Dado os alertas DE HOJE e os MonitorAlert pendentes (dismissed mas ativos),
 * retorna o subset que deve mostrar pro user (= não estão dismissed COM
 * mesmo valor).
 *
 * Lógica "dispensar até nova mudança":
 *   - Se user dismissou um alerta de C=3, e hoje C continua 3 → NÃO mostra
 *   - Se hoje C subiu pra 4 → MOSTRA (mudou)
 *   - Se hoje C caiu pra 2 → não tem alerta hoje, dismissed obsoleto
 */
export interface DismissedAlertSnapshot {
  metricKey: string
  companyId: string
  valueHoje: number
}

export function filterByDismissed(
  todayAlerts: MonitorAlert[],
  dismissedActive: DismissedAlertSnapshot[],
): MonitorAlert[] {
  return todayAlerts.filter((alert) => {
    if (alert.companyId === null) return true
    const dismissed = dismissedActive.find(
      (d) =>
        d.metricKey === alert.metricKey &&
        d.companyId === alert.companyId &&
        d.valueHoje === alert.valueHoje,
    )
    return !dismissed
  })
}
