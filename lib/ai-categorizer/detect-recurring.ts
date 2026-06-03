// Sprint PF Fatia 3 — Detector de assinaturas recorrentes (insights).
//
// Diferencial competitivo vs Mobills/Organizze: detectar assinaturas
// mensais com confidence + total/mês + próxima cobrança prevista.
//
// FUNÇÃO PURA: recebe array de tx + retorna array agrupado.
//
// Algoritmo:
//   1. Agrupa tx de cartão por merchant normalizado (remove parcelas,
//      números soltos, "* xxx" do Nubank)
//   2. Filtra grupos com ≥ minMonths ocorrências em meses distintos
//   3. Calcula avg + desvio padrão dos valores
//   4. Se stdev < 15% da avg → é recorrente
//   5. predictedNextDate = lastSeen + (avg gap em dias)

import { normalizeDescription } from './normalize'

export interface RecurringInputTx {
  date: Date
  amount: number
  description: string
  type?: 'CREDIT' | 'DEBIT'
}

export interface RecurringSubscription {
  /** Chave normalizada do merchant (lowercase, sem refs). */
  merchantKey: string
  displayName: string
  monthsActive: number
  avgAmount: number
  amountStdevPercent: number
  lastSeenAt: Date
  predictedNextDate: Date
  txCount: number
}

const DEFAULT_MIN_MONTHS = 3
const MAX_STDEV_PERCENT = 0.15 // 15% — valor instável vira "não-recorrente"

/** Normaliza merchant pra agrupar: remove parcela, refs Nubank, pontuação. */
export function normalizeMerchant(desc: string): string {
  let s = desc
  // Remove "- Parcela X/Y"
  s = s.replace(/\s*-\s*Parcela\s+\d+\/\d+\s*$/i, '')
  s = s.replace(/\s*\(\d+\/\d+\)\s*$/, '')
  // Remove refs Nubank tipo "* Ymtzzn5hf2" ou "*Rgs"
  s = s.replace(/\s*\*\s*[a-z0-9]{2,}\s*/gi, ' ')
  // Remove números soltos
  s = s.replace(/\b\d+\b/g, ' ')
  // Normaliza
  s = normalizeDescription(s).toLowerCase()
  // Compacta espaços
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

interface Group {
  key: string
  displayName: string
  txs: RecurringInputTx[]
}

function groupByMerchant(txs: RecurringInputTx[]): Group[] {
  const map = new Map<string, Group>()
  for (const t of txs) {
    const key = normalizeMerchant(t.description)
    if (!key) continue
    let g = map.get(key)
    if (!g) {
      g = { key, displayName: t.description, txs: [] }
      map.set(key, g)
    }
    g.txs.push(t)
  }
  return [...map.values()]
}

function uniqueMonths(txs: RecurringInputTx[]): number {
  const set = new Set<string>()
  for (const t of txs) {
    set.add(`${t.date.getUTCFullYear()}-${t.date.getUTCMonth()}`)
  }
  return set.size
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function stdev(xs: number[], mean: number): number {
  if (xs.length === 0) return 0
  const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length
  return Math.sqrt(v)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Média dos gaps entre datas consecutivas (em dias). */
function avgGapDays(txs: RecurringInputTx[]): number {
  if (txs.length < 2) return 30
  const sorted = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime())
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / DAY_MS)
  }
  return avg(gaps)
}

export function detectRecurringSubscriptions(
  txs: RecurringInputTx[],
  minMonths: number = DEFAULT_MIN_MONTHS,
): RecurringSubscription[] {
  // Só DEBIT (compras)
  const filtered = txs.filter((t) => t.type !== 'CREDIT')
  const groups = groupByMerchant(filtered)
  const result: RecurringSubscription[] = []

  for (const g of groups) {
    const months = uniqueMonths(g.txs)
    if (months < minMonths) continue

    const amounts = g.txs.map((t) => t.amount)
    const mean = avg(amounts)
    if (mean <= 0) continue
    const std = stdev(amounts, mean)
    const stdPct = std / mean
    if (stdPct > MAX_STDEV_PERCENT) continue

    const sorted = [...g.txs].sort((a, b) => a.date.getTime() - b.date.getTime())
    const lastSeen = sorted[sorted.length - 1].date
    const avgGap = avgGapDays(g.txs)
    const predictedNext = new Date(lastSeen.getTime() + avgGap * DAY_MS)

    result.push({
      merchantKey: g.key,
      displayName: g.displayName.trim().slice(0, 80),
      monthsActive: months,
      avgAmount: mean,
      amountStdevPercent: stdPct,
      lastSeenAt: lastSeen,
      predictedNextDate: predictedNext,
      txCount: g.txs.length,
    })
  }

  // Ordena por avgAmount * monthsActive (impacto mensal × longevidade)
  return result.sort(
    (a, b) => b.avgAmount * b.monthsActive - a.avgAmount * a.monthsActive,
  )
}
