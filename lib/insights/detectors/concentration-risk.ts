// Detector: risco de concentração de receita — Sprint 2 Dia 4.
//
// Olha os últimos 90 dias de transações CREDIT com dreGroup começando com
// RECEITA_* e agrupa por descrição normalizada (proxy de cliente).
//
// GUARDA CRÍTICA: se <50% das CREDIT do período têm dreGroup RECEITA_*,
// retorna SILENCIOSO. Sem essa guarda confundiríamos empréstimos, aportes
// e estornos com receita real, gerando alerta falso positivo.
//
// Tier:
//   Top1 ≥ 70%                  → alerta priority 8
//   Top1 ≥ 50% OU Top3 ≥ 80%    → oportunidade priority 6
//   Caso contrário              → silencioso

import type { Detector, Insight, InsightTransaction } from '../types'
import { normalizeDescription } from '../string-similarity'

const RECEITA_GROUPS = new Set([
  'RECEITA_BRUTA',
  'RECEITAS_FINANCEIRAS',
  'OUTRAS_RECEITAS',
])

const MIN_RECEITA_RATIO = 0.5 // guarda anti-falso-positivo
const TOP1_ALERT = 0.7
const TOP1_OPP = 0.5
const TOP3_OPP = 0.8

export const detectConcentrationRisk: Detector = (ctx) => {
  const credits = ctx.creditTx90d.filter((t) => t.type === 'CREDIT')
  if (credits.length === 0) return []

  const receitas = credits.filter(
    (t) => t.dreGroup !== null && RECEITA_GROUPS.has(t.dreGroup),
  )
  const ratio = receitas.length / credits.length

  // Guarda anti falso-positivo: só fala em concentração se a maior parte
  // das entradas é REALMENTE receita classificada.
  if (ratio < MIN_RECEITA_RATIO) return []
  if (receitas.length < 3) return [] // amostra pequena demais

  // Agrupa por descrição normalizada — proxy de "cliente" sem CRM.
  // Sprint 3+ pode melhorar usando supplier.cnpj quando feature 4.x estiver pronta.
  const byClient = aggregate(receitas)
  const totalReceita = receitas.reduce((s, t) => s + t.amount, 0)
  const sorted = Array.from(byClient.values()).sort(
    (a, b) => b.total - a.total,
  )

  const top1 = sorted[0]
  const top1Pct = top1 ? top1.total / totalReceita : 0
  const top3Pct =
    sorted.slice(0, 3).reduce((s, c) => s + c.total, 0) / totalReceita

  let severity: Insight['severity']
  let priority: number
  let title: string
  let description: string

  if (top1Pct >= TOP1_ALERT) {
    severity = 'alerta'
    priority = 8
    title = `${Math.round(top1Pct * 100)}% da receita vem de 1 cliente`
    description = `Concentração alta: "${truncate(top1.label, 50)}" representa ${Math.round(top1Pct * 100)}% das entradas dos últimos 90 dias. Perda desse cliente pode comprometer o fluxo. Considere diversificar a carteira.`
  } else if (top1Pct >= TOP1_OPP || top3Pct >= TOP3_OPP) {
    severity = 'oportunidade'
    priority = 6
    if (top1Pct >= TOP1_OPP) {
      title = `1 cliente concentra ${Math.round(top1Pct * 100)}% da receita`
      description = `"${truncate(top1.label, 50)}" é a maior fonte de receita (${Math.round(top1Pct * 100)}%). Diversificar reduz dependência e fortalece o negócio.`
    } else {
      title = `Top 3 clientes = ${Math.round(top3Pct * 100)}% da receita`
      description = `Os 3 maiores pagadores concentram ${Math.round(top3Pct * 100)}% das entradas. Ampliar a base de clientes traz mais previsibilidade.`
    }
  } else {
    return [] // dentro da normalidade
  }

  return [
    {
      id: 'concentration-risk',
      severity,
      priority,
      title,
      description,
      action: {
        label: 'Ver receitas',
        url: `/empresas/${ctx.companyId}/dre`,
      },
      metadata: {
        top1Pct: Math.round(top1Pct * 100),
        top3Pct: Math.round(top3Pct * 100),
        receitaRatio: Math.round(ratio * 100),
        clientCount: byClient.size,
      },
    },
  ]
}

interface ClientBucket {
  label: string
  total: number
  count: number
}

function aggregate(txs: InsightTransaction[]): Map<string, ClientBucket> {
  const map = new Map<string, ClientBucket>()
  for (const t of txs) {
    const key = normalizeDescription(t.description)
    const existing = map.get(key)
    if (existing) {
      existing.total += t.amount
      existing.count += 1
    } else {
      // Preserva primeira ocorrência original (não-normalizada) pro label
      map.set(key, { label: t.description, total: t.amount, count: 1 })
    }
  }
  return map
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
