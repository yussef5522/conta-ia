// Detector: transações grandes sem categoria — Sprint 2 Dia 4.
//
// Foco: transações com |amount| > R$ 5.000 nos últimos 30 dias sem categoryId.
// Subset de "pending-classifications" mas com URGÊNCIA maior — uma despesa de
// R$ 50k sem categoria desconfigura DRE/relatórios muito mais que 50 cafés.
//
// Threshold fixo R$ 5.000 (TODO Settings dinâmico futuro — Sprint 3+).
//
// Tier:
//   1-4   → sugestao priority 5
//   5-19  → oportunidade priority 7
//   20+   → alerta priority 9

import type { Detector, Insight } from '../types'

const LARGE_THRESHOLD = 5000

export const detectLargeUncategorized: Detector = (ctx) => {
  const large = ctx.uncategorizedLast30d.filter(
    (t) => Math.abs(t.amount) > LARGE_THRESHOLD,
  )
  if (large.length === 0) return []

  const total = large.reduce((s, t) => s + Math.abs(t.amount), 0)

  let severity: Insight['severity']
  let priority: number
  if (large.length >= 20) {
    severity = 'alerta'
    priority = 9
  } else if (large.length >= 5) {
    severity = 'oportunidade'
    priority = 7
  } else {
    severity = 'sugestao'
    priority = 5
  }

  const title =
    large.length === 1
      ? `1 transação grande sem categoria (${formatBRL(total)})`
      : `${large.length} transações grandes sem categoria (${formatBRL(total)})`

  const description =
    severity === 'alerta'
      ? 'Volume alto de despesas/receitas grandes sem classificação distorce o DRE. Classifique pra ter relatórios confiáveis.'
      : severity === 'oportunidade'
        ? 'Movimentações acima de R$ 5.000 sem categoria afetam significativamente DRE e fluxo de caixa. Priorize essas primeiro.'
        : 'Transações grandes têm peso maior no DRE — comece classificando essas pra ganhar precisão rápida.'

  return [
    {
      id: 'large-uncategorized',
      severity,
      priority,
      title,
      description,
      action: {
        label: 'Classificar agora',
        // Vai pra pendentes; user filtra por valor manualmente. Drill-down
        // por filtro de valor mínimo é melhoria futura (Sprint 3).
        url: `/empresas/${ctx.companyId}/pendentes`,
      },
      metadata: {
        largeCount: large.length,
        totalAmount: Math.round(total * 100) / 100,
        threshold: LARGE_THRESHOLD,
      },
    },
  ]
}

function formatBRL(n: number): string {
  const abs = Math.abs(n)
  const int = Math.floor(abs)
  const cents = Math.round((abs - int) * 100)
  return `R$ ${int.toLocaleString('pt-BR')},${cents.toString().padStart(2, '0')}`
}
