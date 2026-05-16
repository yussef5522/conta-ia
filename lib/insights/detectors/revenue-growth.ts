// Detector: crescimento de receita — Sprint 2 Dia 4.
//
// SÓ usa transações com dreGroup em RECEITA_BRUTA/RECEITAS_FINANCEIRAS/
// OUTRAS_RECEITAS. NÃO usa "todas as CREDIT" como proxy — isso confundiria
// empréstimo bancário e aporte de sócio com vendas reais, gerando "parabéns"
// falsos.
//
// Compara mês atual completo (ou último mês fechado) com média dos 3 meses
// ANTERIORES (precisa baseline 3+ meses com receita).
//
// Tier (apenas parabéns — não é alerta nem oportunidade):
//   >50% crescimento → parabens priority 7
//   20-50%           → parabens priority 5
//   <20% ou queda    → silencioso (não é "vitória" celebrável)

import type { Detector, Insight, InsightTransaction } from '../types'

const RECEITA_GROUPS = new Set([
  'RECEITA_BRUTA',
  'RECEITAS_FINANCEIRAS',
  'OUTRAS_RECEITAS',
])

const REQUIRED_BASELINE_MONTHS = 3
const BIG_GROWTH = 0.5
const MODEST_GROWTH = 0.2

export const detectRevenueGrowth: Detector = (ctx) => {
  const receitas = ctx.creditTx90d.filter(
    (t) =>
      t.type === 'CREDIT' &&
      t.dreGroup !== null &&
      RECEITA_GROUPS.has(t.dreGroup),
  )
  if (receitas.length === 0) return []

  // Agrega por monthKey 'YYYY-MM' (UTC)
  const byMonth = aggregateByMonth(receitas)
  const sortedMonths = Array.from(byMonth.keys()).sort()
  if (sortedMonths.length < REQUIRED_BASELINE_MONTHS + 1) return [] // silencioso

  // Último mês = corrente; baseline = N anteriores (até 3)
  const currentKey = sortedMonths[sortedMonths.length - 1]
  const baselineKeys = sortedMonths.slice(
    Math.max(0, sortedMonths.length - 1 - REQUIRED_BASELINE_MONTHS),
    sortedMonths.length - 1,
  )

  const current = byMonth.get(currentKey) ?? 0
  const baselineSum = baselineKeys.reduce(
    (s, k) => s + (byMonth.get(k) ?? 0),
    0,
  )
  const baselineAvg = baselineSum / baselineKeys.length

  if (baselineAvg === 0) return []

  const growth = (current - baselineAvg) / baselineAvg
  if (growth < MODEST_GROWTH) return [] // silencioso

  const pct = Math.round(growth * 100)
  const isBig = growth >= BIG_GROWTH

  return [
    {
      id: 'revenue-growth',
      severity: 'parabens',
      priority: isBig ? 7 : 5,
      title: isBig
        ? `🚀 Receita cresceu ${pct}% no mês`
        : `📈 Receita subiu ${pct}% no mês`,
      description: isBig
        ? `Crescimento expressivo: ${formatBRL(current)} este mês vs média ${formatBRL(baselineAvg)} dos 3 anteriores. Vale entender o que funcionou pra reforçar.`
        : `${formatBRL(current)} este mês vs média ${formatBRL(baselineAvg)} dos 3 anteriores. Tendência positiva — mantenha o ritmo.`,
      action: {
        label: 'Ver DRE',
        url: `/empresas/${ctx.companyId}/dre`,
      },
      metadata: {
        currentRevenue: round2(current),
        baselineAvg: round2(baselineAvg),
        growthPct: pct,
      },
    },
  ]
}

function aggregateByMonth(txs: InsightTransaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) {
    const key = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + t.amount)
  }
  return map
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatBRL(n: number): string {
  const abs = Math.abs(n)
  const int = Math.floor(abs)
  const cents = Math.round((abs - int) * 100)
  return `R$ ${int.toLocaleString('pt-BR')},${cents.toString().padStart(2, '0')}`
}
