// Detector: transações aguardando classificação — Sprint 2 Dia 3.
//
// Tiering por volume (decisão Yussef):
//   0           → nada
//   1-19        → sugestao priority 5
//   20-99       → oportunidade priority 7
//   ≥100        → alerta priority 9

import type { Detector, Insight } from '../types'

export const detectPendingClassifications: Detector = (ctx) => {
  const { pendingCount, companyId } = ctx
  if (pendingCount <= 0) return []

  let severity: Insight['severity']
  let priority: number
  let title: string

  if (pendingCount >= 100) {
    severity = 'alerta'
    priority = 9
    title = `${pendingCount} transações aguardam classificação`
  } else if (pendingCount >= 20) {
    severity = 'oportunidade'
    priority = 7
    title = `${pendingCount} transações aguardam classificação`
  } else {
    severity = 'sugestao'
    priority = 5
    title =
      pendingCount === 1
        ? '1 transação aguarda classificação'
        : `${pendingCount} transações aguardam classificação`
  }

  return [
    {
      id: 'pending-classifications',
      severity,
      priority,
      title,
      description:
        'Sem categoria, o DRE e os relatórios não refletem a realidade do seu negócio. 🤖 Em breve a IA Contadora vai sugerir categorias automaticamente baseada nos seus padrões.',
      action: {
        label: 'Revisar pendentes',
        url: `/empresas/${companyId}/pendentes`,
      },
      metadata: { pendingCount },
    },
  ]
}
