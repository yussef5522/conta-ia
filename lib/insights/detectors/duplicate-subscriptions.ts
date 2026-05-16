// Detector: assinaturas duplicadas / cobranças repetidas — Sprint 2 Dia 4.
//
// Encontra grupos de DEBIT nos últimos 6 meses onde:
//   - 3+ ocorrências em meses DIFERENTES (mensal)
//   - descrições similares (Levenshtein ≤ 5 ou string base igual após normalizar)
//   - valores dentro de ±10% da média do grupo
//
// Caso típico: "NETFLIX MAR/2026" + "NETFLIX ABR/2026" + "NETFLIX MAI/2026" —
// distância Levenshtein pequena, valores idênticos, 3 meses distintos.
//
// Threshold conservador: prefere FALSO NEGATIVO (não alertar quando deveria)
// a falso positivo (alertar de duas coisas distintas). Detector pode evoluir
// quando feature 4.3 (CNPJ) estiver pronta.
//
// Tier:
//   1-2 grupos → sugestao priority 6
//   3+ grupos  → alerta priority 8

import type { Detector, Insight, InsightTransaction } from '../types'
import { levenshtein, normalizeDescription } from '../string-similarity'

const MIN_DISTINCT_MONTHS = 3
const LEV_THRESHOLD = 5
const AMOUNT_TOLERANCE = 0.1 // ±10%

interface Cluster {
  representativeLabel: string
  txs: InsightTransaction[]
  distinctMonths: Set<string>
  avgAmount: number
}

export const detectDuplicateSubscriptions: Detector = (ctx) => {
  const debits = ctx.expenseTx6m.filter((t) => t.type === 'DEBIT')
  if (debits.length < MIN_DISTINCT_MONTHS) return []

  const clusters = buildClusters(debits)
  const recurring = clusters.filter(
    (c) => c.distinctMonths.size >= MIN_DISTINCT_MONTHS && c.txs.length >= 3,
  )
  if (recurring.length === 0) return []

  // Ordena por relevância (mais ocorrências primeiro)
  recurring.sort((a, b) => b.txs.length - a.txs.length)

  const totalMonthly = recurring.reduce((s, c) => s + c.avgAmount, 0)

  const severity: Insight['severity'] = recurring.length >= 3 ? 'alerta' : 'sugestao'
  const priority = recurring.length >= 3 ? 8 : 6

  const sample = recurring
    .slice(0, 3)
    .map((c) => truncate(c.representativeLabel, 30))
    .join(', ')

  const title =
    recurring.length === 1
      ? `1 cobrança recorrente detectada (~${formatBRL(recurring[0].avgAmount)}/mês)`
      : `${recurring.length} cobranças recorrentes detectadas (~${formatBRL(totalMonthly)}/mês)`

  const description =
    severity === 'alerta'
      ? `Padrões repetidos com mesmo valor a cada mês indicam assinaturas, mensalidades ou serviços fixos. Revisar: ${sample}. Cancelar o que não usa pode liberar caixa imediato.`
      : `Detectamos cobrança mensal com mesmo padrão e valor. ${recurring.length === 1 ? 'Revise se essa assinatura ainda faz sentido' : `Revise: ${sample}`}.`

  return [
    {
      id: 'duplicate-subscriptions',
      severity,
      priority,
      title,
      description,
      action: {
        label: 'Revisar despesas',
        url: `/empresas/${ctx.companyId}/dre`,
      },
      metadata: {
        groupCount: recurring.length,
        estimatedMonthlyTotal: round2(totalMonthly),
        topPatterns: recurring.slice(0, 3).map((c) => ({
          label: c.representativeLabel,
          months: c.distinctMonths.size,
          avgAmount: round2(c.avgAmount),
        })),
      },
    },
  ]
}

// Clustering simples O(n²) — n é pequeno (centenas no máx em 6 meses).
// Adiciona tx a cluster existente se: Levenshtein(norm desc) ≤ THRESHOLD e
// amount dentro de ±10% da média do cluster. Caso contrário cria cluster novo.
function buildClusters(txs: InsightTransaction[]): Cluster[] {
  const clusters: Cluster[] = []
  // Ordena por amount pra otimizar a comparação (amounts próximos próximos)
  const sorted = [...txs].sort((a, b) => a.amount - b.amount)

  for (const tx of sorted) {
    const normDesc = normalizeDescription(tx.description)
    let matched: Cluster | null = null
    for (const c of clusters) {
      const refNorm = normalizeDescription(c.representativeLabel)
      // Otimização: distância tem cota mínima = |diferença de tamanho|
      if (Math.abs(refNorm.length - normDesc.length) > LEV_THRESHOLD) continue
      const dist = levenshtein(normDesc, refNorm)
      if (dist > LEV_THRESHOLD) continue
      // Valor dentro da tolerância?
      const tolerance = c.avgAmount * AMOUNT_TOLERANCE
      if (Math.abs(tx.amount - c.avgAmount) > tolerance) continue
      matched = c
      break
    }

    if (matched) {
      matched.txs.push(tx)
      // Recalcula avg incrementalmente
      matched.avgAmount =
        matched.txs.reduce((s, t) => s + t.amount, 0) / matched.txs.length
      matched.distinctMonths.add(monthKey(tx.date))
    } else {
      clusters.push({
        representativeLabel: tx.description,
        txs: [tx],
        distinctMonths: new Set([monthKey(tx.date)]),
        avgAmount: tx.amount,
      })
    }
  }

  return clusters
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
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
