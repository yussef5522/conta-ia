// Sprint 5.0.4.0a (a2) — Lógica pura do Comparativo 3 Meses.
//
// Yussef pediu (citação literal): "ele vai entender com esses numeros o
// que mudou, o que ele paga primeira vez". A regra "🆕 nova" responde
// exatamente isso.
//
// Sem dependência de DB. Recebe transactions já carregadas (caller
// filtra por empresa + período + tipo).

export type TrendIndicator =
  | 'UP_STRONG' // > +50% — vermelho preocupante (↑↑)
  | 'UP' // +15% a +50% — amber (↑)
  | 'STABLE' // ±15% — slate (━)
  | 'DOWN' // -15% a -50% — sky (↓)
  | 'DOWN_STRONG' // < -50% — sky escuro (↓↓)
  | 'NEW' // current > 0 mas prev1=0 e prev2=0 — purple (🆕)
  | 'GONE' // (prev1>0 OR prev2>0) mas current=0 — slate (✕)
  | 'EMPTY' // tudo zero — vazio

export interface TrendResult {
  indicator: TrendIndicator
  /** Variação relativa do CURRENT vs mês anterior (prev1). null quando NEW/GONE/EMPTY. */
  percentVsPrev1: number | null
  /** Variação total: current vs prev2 (2 meses atrás). null quando NEW/GONE/EMPTY. */
  percentVsPrev2: number | null
}

const STABLE_TOLERANCE = 0.15
const STRONG_THRESHOLD = 0.5

/**
 * Determina o indicador de tendência. Regras (da spec):
 *  - current >0 + prev1=0 + prev2=0  → NEW (apareceu agora)
 *  - current=0 + (prev1>0 OR prev2>0) → GONE (sumiu)
 *  - todos 0 → EMPTY
 *  - varia com base em (current vs prev1):
 *      > +50% → UP_STRONG
 *      +15% a +50% → UP
 *      -15% a +15% → STABLE
 *      -50% a -15% → DOWN
 *      < -50% → DOWN_STRONG
 */
export function trendIndicator(
  prev2: number,
  prev1: number,
  current: number,
): TrendResult {
  // Edge cases primeiro
  const allZero = prev2 === 0 && prev1 === 0 && current === 0
  if (allZero) {
    return { indicator: 'EMPTY', percentVsPrev1: null, percentVsPrev2: null }
  }

  const isNew = current > 0 && prev1 === 0 && prev2 === 0
  if (isNew) {
    return { indicator: 'NEW', percentVsPrev1: null, percentVsPrev2: null }
  }

  const isGone = current === 0 && (prev1 > 0 || prev2 > 0)
  if (isGone) {
    return { indicator: 'GONE', percentVsPrev1: null, percentVsPrev2: null }
  }

  // Cálculo de variação vs prev1 (mês anterior).
  // Se prev1 é 0 mas current > 0, é "ressurgência" — não NEW (porque prev2 > 0)
  // mas tratamos como UP_STRONG (subiu de 0).
  const percentVsPrev1 =
    prev1 === 0 ? Infinity : (current - prev1) / prev1

  const percentVsPrev2 =
    prev2 === 0 ? null : (current - prev2) / prev2

  let indicator: TrendIndicator
  if (percentVsPrev1 > STRONG_THRESHOLD) indicator = 'UP_STRONG'
  else if (percentVsPrev1 > STABLE_TOLERANCE) indicator = 'UP'
  else if (percentVsPrev1 >= -STABLE_TOLERANCE) indicator = 'STABLE'
  else if (percentVsPrev1 >= -STRONG_THRESHOLD) indicator = 'DOWN'
  else indicator = 'DOWN_STRONG'

  return {
    indicator,
    percentVsPrev1: Number.isFinite(percentVsPrev1) ? percentVsPrev1 : null,
    percentVsPrev2,
  }
}

// ────────────────────────────────────────────────────────────────────
// Período: resolve 3 meses consecutivos a partir do mês de referência
// ────────────────────────────────────────────────────────────────────

export interface MonthRange {
  /** Identificador YYYY-MM */
  ym: string
  /** Início do mês UTC */
  start: Date
  /** Fim do mês UTC (último dia, 23:59:59.999) */
  end: Date
  /** Label PT-BR pra UI: "Mar/26" */
  label: string
}

const MES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

/** Parseia "YYYY-MM" em start/end UTC. Throw se inválido. */
export function parseRefMonth(ymRef: string): MonthRange {
  const m = ymRef.match(/^(\d{4})-(\d{2})$/)
  if (!m) throw new Error(`refMonth inválido: ${ymRef} (esperado YYYY-MM)`)
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) // 1-12
  if (month < 1 || month > 12) throw new Error(`mês inválido: ${month}`)
  return monthRangeFromYearMonth(year, month)
}

function monthRangeFromYearMonth(year: number, month: number): MonthRange {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  // Dia 0 do mês seguinte = último dia do mês atual
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  const ym = `${year}-${String(month).padStart(2, '0')}`
  const label = `${MES_ABREV[month - 1]}/${String(year).slice(-2)}`
  return { ym, start, end, label }
}

/**
 * Retorna 3 meses consecutivos: [prev2, prev1, current] a partir do
 * refMonth. Lida com viradas de ano.
 */
export function threeMonthsForRef(ymRef: string): {
  prev2: MonthRange
  prev1: MonthRange
  current: MonthRange
} {
  const current = parseRefMonth(ymRef)
  const refDate = current.start
  const prev1Year =
    refDate.getUTCMonth() === 0
      ? refDate.getUTCFullYear() - 1
      : refDate.getUTCFullYear()
  const prev1Month =
    refDate.getUTCMonth() === 0 ? 12 : refDate.getUTCMonth() // 1-12 (refDate.getUTCMonth() é 0-11; mes anterior = ele mesmo em 1-based)
  // Acima: refDate.getUTCMonth() retorna 0-11 do current. Mes anterior 1-based:
  //   ex: current=Mai (mês=4 zero-based, 5 1-based). prev1 1-based = 4 = Abril.
  //   refDate.getUTCMonth() = 4 → prev1Month = 4 ✓
  const prev1 = monthRangeFromYearMonth(prev1Year, prev1Month)

  const prev1Date = prev1.start
  const prev2Year =
    prev1Date.getUTCMonth() === 0
      ? prev1Date.getUTCFullYear() - 1
      : prev1Date.getUTCFullYear()
  const prev2Month =
    prev1Date.getUTCMonth() === 0 ? 12 : prev1Date.getUTCMonth()
  const prev2 = monthRangeFromYearMonth(prev2Year, prev2Month)

  return { prev2, prev1, current }
}

// ────────────────────────────────────────────────────────────────────
// Agregação: agrupa transactions por categoria + mês
// ────────────────────────────────────────────────────────────────────

export interface ComparativoRow {
  /** id da categoria (ou null pra "Sem categoria") */
  categoryId: string | null
  /** Nome de exibição */
  categoryName: string
  /** Grupo DRE — útil pra UI agrupar */
  dreGroup: string | null
  prev2: number
  prev1: number
  current: number
  /** Soma dos 3 meses */
  total: number
  trend: TrendResult
}

export interface ComparativoInputTx {
  /** Data usada pra alocação no bucket. Usar competenceDate ou paymentDate por filtro. */
  bucketDate: Date | string
  amount: number
  type: string // CREDIT | DEBIT
  categoryId: string | null
  categoryName: string | null
  dreGroup: string | null
}

export type ComparativoTipoFilter = 'DESPESA' | 'RECEITA' | 'TODOS'

export interface ComparativoFilterMode {
  filter: 'ALL' | 'UP_ONLY' | 'DOWN_ONLY' | 'NEW_ONLY'
}

/**
 * Constrói a matriz de comparativo: categoria × {prev2, prev1, current}.
 *
 * Convenções:
 *  - tipo='DESPESA' → soma apenas DEBIT
 *  - tipo='RECEITA' → soma apenas CREDIT
 *  - tipo='TODOS' → soma absoluta (módulo)
 *  - Ordenação: total DESC (mais gasto/recebido primeiro)
 */
export function computeComparativo(
  txs: ComparativoInputTx[],
  ymRef: string,
  tipo: ComparativoTipoFilter = 'DESPESA',
): {
  rows: ComparativoRow[]
  totals: { prev2: number; prev1: number; current: number; total: number }
  meses: { prev2: MonthRange; prev1: MonthRange; current: MonthRange }
} {
  const meses = threeMonthsForRef(ymRef)

  // Mapa: categoryId|null → { prev2, prev1, current, name, dreGroup }
  type Bucket = {
    name: string
    dreGroup: string | null
    prev2: number
    prev1: number
    current: number
  }
  const buckets = new Map<string, Bucket>()

  for (const tx of txs) {
    // Filtra por tipo
    if (tipo === 'DESPESA' && tx.type !== 'DEBIT') continue
    if (tipo === 'RECEITA' && tx.type !== 'CREDIT') continue

    const date =
      tx.bucketDate instanceof Date ? tx.bucketDate : new Date(tx.bucketDate)
    if (Number.isNaN(date.getTime())) continue

    // Determina qual bucket
    let monthKey: 'prev2' | 'prev1' | 'current' | null = null
    if (date >= meses.prev2.start && date <= meses.prev2.end)
      monthKey = 'prev2'
    else if (date >= meses.prev1.start && date <= meses.prev1.end)
      monthKey = 'prev1'
    else if (date >= meses.current.start && date <= meses.current.end)
      monthKey = 'current'
    if (!monthKey) continue // fora dos 3 meses

    const key = tx.categoryId ?? '__sem_categoria__'
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        name: tx.categoryName ?? 'Sem categoria',
        dreGroup: tx.dreGroup,
        prev2: 0,
        prev1: 0,
        current: 0,
      }
      buckets.set(key, bucket)
    }
    bucket[monthKey] += Math.abs(tx.amount)
  }

  const rows: ComparativoRow[] = []
  for (const [key, bucket] of buckets) {
    const trend = trendIndicator(bucket.prev2, bucket.prev1, bucket.current)
    rows.push({
      categoryId: key === '__sem_categoria__' ? null : key,
      categoryName: bucket.name,
      dreGroup: bucket.dreGroup,
      prev2: bucket.prev2,
      prev1: bucket.prev1,
      current: bucket.current,
      total: bucket.prev2 + bucket.prev1 + bucket.current,
      trend,
    })
  }

  // Ordena por total DESC
  rows.sort((a, b) => b.total - a.total)

  const totals = rows.reduce(
    (acc, r) => ({
      prev2: acc.prev2 + r.prev2,
      prev1: acc.prev1 + r.prev1,
      current: acc.current + r.current,
      total: acc.total + r.total,
    }),
    { prev2: 0, prev1: 0, current: 0, total: 0 },
  )

  return { rows, totals, meses }
}

/** Filtra rows conforme modo de UI (Tudo / Subindo / Descendo / Novas). */
export function filterRows(
  rows: ComparativoRow[],
  mode: ComparativoFilterMode['filter'],
): ComparativoRow[] {
  if (mode === 'ALL') return rows
  if (mode === 'NEW_ONLY') return rows.filter((r) => r.trend.indicator === 'NEW')
  if (mode === 'UP_ONLY')
    return rows.filter(
      (r) => r.trend.indicator === 'UP' || r.trend.indicator === 'UP_STRONG',
    )
  if (mode === 'DOWN_ONLY')
    return rows.filter(
      (r) =>
        r.trend.indicator === 'DOWN' || r.trend.indicator === 'DOWN_STRONG',
    )
  return rows
}

/** Mapas semânticos pra UI — Tailwind safelist. */
export const TREND_VISUAL: Record<
  TrendIndicator,
  { symbol: string; colorClass: string; label: string }
> = {
  UP_STRONG: {
    symbol: '↑↑',
    colorClass: 'text-red-600 dark:text-red-400 font-bold',
    label: 'Subiu muito',
  },
  UP: {
    symbol: '↑',
    colorClass: 'text-amber-600 dark:text-amber-400',
    label: 'Subiu',
  },
  STABLE: {
    symbol: '━',
    colorClass: 'text-slate-500 dark:text-slate-400',
    label: 'Estável',
  },
  DOWN: {
    symbol: '↓',
    colorClass: 'text-sky-600 dark:text-sky-400',
    label: 'Caiu',
  },
  DOWN_STRONG: {
    symbol: '↓↓',
    colorClass: 'text-sky-700 dark:text-sky-300 font-bold',
    label: 'Caiu muito',
  },
  NEW: {
    symbol: '🆕',
    colorClass: 'text-purple-600 dark:text-purple-400 font-medium',
    label: 'Nova',
  },
  GONE: {
    symbol: '✕',
    colorClass: 'text-slate-400 dark:text-slate-500',
    label: 'Sumiu',
  },
  EMPTY: {
    symbol: '—',
    colorClass: 'text-muted-foreground',
    label: 'Sem dados',
  },
}
