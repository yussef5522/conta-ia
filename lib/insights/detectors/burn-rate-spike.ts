// Detector: spike de burn rate — Sprint 2 Dia 3.
//
// Compara despesa média dos 3 meses MAIS RECENTES com 3 meses ANTERIORES
// (exige 6 meses de histórico). Reusa burnHistory já preparado por
// calculateConsolidatedCashflow (Sprint 0.5 Dia 3).
//
// Severity:
//   ≥50% growth → alerta priority 8
//   ≥30% growth → sugestao priority 5
//   <30%       → sem insight (variação normal)

import type { Detector, Insight } from '../types'

const REQUIRED_MONTHS = 6
const SUGGESTAO_GROWTH = 0.3
const ALERTA_GROWTH = 0.5

export const detectBurnRateSpike: Detector = (ctx) => {
  const burns = ctx.burnHistory
  if (burns.length < REQUIRED_MONTHS) return [] // sem dados suficientes — silencioso

  // Últimos 3 vs 3 anteriores (assumindo ordem ASC)
  const recent3 = burns.slice(-3)
  const prev3 = burns.slice(-6, -3)

  const recentAvg = avg(recent3.map((m) => m.expense))
  const prevAvg = avg(prev3.map((m) => m.expense))

  if (prevAvg === 0) return [] // sem baseline pra comparar

  const growth = (recentAvg - prevAvg) / prevAvg
  if (growth < SUGGESTAO_GROWTH) return []

  const pct = Math.round(growth * 100)
  const isAlerta = growth >= ALERTA_GROWTH

  return [
    {
      id: 'burn-rate-spike',
      severity: isAlerta ? 'alerta' : 'sugestao',
      priority: isAlerta ? 8 : 5,
      title: `Despesas cresceram ${pct}% nos últimos 3 meses`,
      description: `Média de ${formatBRL(recentAvg)}/mês vs ${formatBRL(prevAvg)}/mês antes. ${isAlerta ? 'Crescimento expressivo — vale investigar gastos novos ou aumento de fornecedores.' : 'Confira no fluxo de caixa onde o aumento se concentrou.'}`,
      action: {
        label: 'Ver fluxo de caixa',
        url: `/dashboard?wf=trimestre`,
      },
      metadata: { recentAvg, prevAvg, growthPct: pct },
    },
  ]
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

// Formato BRL local (sem dep de Intl pra ser determinístico em testes).
function formatBRL(n: number): string {
  const abs = Math.abs(n)
  const int = Math.floor(abs)
  const cents = Math.round((abs - int) * 100)
  const intStr = int.toLocaleString('pt-BR')
  return `R$ ${n < 0 ? '-' : ''}${intStr},${cents.toString().padStart(2, '0')}`
}
