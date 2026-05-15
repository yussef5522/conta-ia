// Detector: uso alto de cheque especial — Sprint 2 Dia 3.
//
// Trigger: alguma conta com allowNegativeBalance=true, balance<0, creditLimit>0
// e |balance|/creditLimit >= 70%.
//
// Agregação: gera 1 insight global (não 1 por conta) — Yussef tem ~45 contas
// (13 academias × 3-4); 1 alerta por conta poluiria o dashboard.
//
// Severity:
//   ≥90% → alerta priority 9
//   ≥70% → sugestao priority 6

import type { Detector, Insight } from '../types'

const HIGH_THRESHOLD = 0.7
const CRITICAL_THRESHOLD = 0.9

export const detectHighOverdraftUsage: Detector = (ctx) => {
  const candidates = ctx.accounts
    .filter(
      (a) => a.allowNegativeBalance && a.balance < 0 && a.creditLimit > 0,
    )
    .map((a) => ({
      ...a,
      usage: Math.abs(a.balance) / a.creditLimit,
    }))
    .filter((a) => a.usage >= HIGH_THRESHOLD)

  if (candidates.length === 0) return []

  const hasCritical = candidates.some((a) => a.usage >= CRITICAL_THRESHOLD)
  const worst = candidates.reduce((a, b) => (a.usage > b.usage ? a : b))
  const pct = Math.round(worst.usage * 100)
  const severity: Insight['severity'] = hasCritical ? 'alerta' : 'sugestao'
  const priority = hasCritical ? 9 : 6

  const title =
    candidates.length === 1
      ? `Cheque especial da ${worst.name} em ${pct}%`
      : `${candidates.length} contas com cheque especial alto`

  const description = hasCritical
    ? `Limite quase esgotado. Reposição urgente recomendada antes de novos lançamentos serem bloqueados.`
    : `Uso acima de 70% do limite contratado. Considere transferir saldo de outra conta ou priorizar recebimentos.`

  return [
    {
      id: 'high-overdraft-usage',
      severity,
      priority,
      title,
      description,
      action: {
        label: 'Ver contas',
        url: `/empresas/${ctx.companyId}/contas`,
      },
      metadata: {
        contasAfetadas: candidates.length,
        piorContaId: worst.id,
        piorUsagePct: pct,
      },
    },
  ]
}
