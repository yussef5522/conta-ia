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

// ════════════════════════════════════════════════════════════════════
// Sprint Comparativo-A (28/05/2026) — Multi-período + Média + Heatmap
// ════════════════════════════════════════════════════════════════════
//
// Adições sem quebrar o código antigo (Sprint 5.0.4.0a). O cliente novo
// (Sprint A) usa computeComparativoMulti(); cliente antigo continua usando
// computeComparativo().
//
// Diferenças chave do antigo:
// - N períodos configuráveis (2/3/6/12), não fixo em 3
// - Granularidade mês/trimestre/ano
// - Coluna Média Histórica (exclui o período de referência)
// - Coluna Desvio % (current vs média)
// - Tone por célula (heatmap intensidade)
// - Semântica IBCS (cor depende de favorável/desfavorável, não direção)

export type Granularidade = 'mes' | 'trimestre' | 'ano'

export interface PeriodoBucket {
  /** "2026-03" | "2026-Q1" | "2026" */
  id: string
  /** "Mar/26" | "Q1/26" | "2025" */
  label: string
  start: Date
  end: Date
}

/**
 * Cor semântica de uma célula no heatmap.
 * - transparent: dentro da margem (|desvio| < 15%)
 * - fav-* : favorável (despesa abaixo da média OU receita acima) — verde
 * - unfav-*: desfavorável (despesa acima da média OU receita abaixo) — vermelho
 * - Intensidade: weak (15-40%) · medium (40-80%) · strong (>80%)
 */
export type CellTone =
  | 'transparent'
  | 'fav-weak'
  | 'fav-medium'
  | 'fav-strong'
  | 'unfav-weak'
  | 'unfav-medium'
  | 'unfav-strong'

export interface ComparativoRowMulti {
  categoryId: string | null
  categoryName: string
  dreGroup: string | null
  /** Valores por período (mesma ordem de `periodos`). Último é o "atual". */
  values: number[]
  /** Média dos values[0..N-1] (EXCLUI o último — referência). null se < 1 período anterior. */
  mediaHistorica: number | null
  /** Desvio do current vs mediaHistorica em frações. null se média=0/null OU ref vazia. */
  desvioPct: number | null
  /** Bug-fix 28/05: true quando current=0 mas média>0 (mês ref ainda sem dados) */
  referenciaVazia: boolean
  /** Soma de values[] */
  total: number
  /** Trend compat com UI antiga (current vs penúltimo) */
  trend: TrendResult
  /** Cor heatmap por célula. Index alinhado com values[] */
  cellTones: CellTone[]
}

export interface ComparativoMultiResult {
  rows: ComparativoRowMulti[]
  /** Soma de cada período (linha "Total" da tabela) + total geral */
  totals: {
    porPeriodo: number[]
    mediaHistorica: number | null
    desvioPct: number | null
    referenciaVazia: boolean
    total: number
  }
  /** Buckets de período em ordem ASC (oldest first, current last) */
  periodos: PeriodoBucket[]
  /** Contadores agregados pros stats cards */
  summary: {
    novas: number
    subindo: number
    descendo: number
    foraDaMedia: number // count de DESPESAS com desvio > +15%
  }
}

// Reusa STABLE_TOLERANCE (0.15) e STRONG_THRESHOLD (0.5) do antigo
// pra consistência entre relatórios. Define limites do heatmap também:
const HEAT_WEAK = 0.15 // mesmo limite "fora da média"
const HEAT_MEDIUM = 0.4
const HEAT_STRONG = 0.8

// ────────────────────────────────────────────────────────────────────
// Helpers de período
// ────────────────────────────────────────────────────────────────────

function quarterStartUTC(d: Date): Date {
  const m = d.getUTCMonth()
  const qStart = Math.floor(m / 3) * 3
  return new Date(Date.UTC(d.getUTCFullYear(), qStart, 1))
}

function quarterEndUTC(d: Date): Date {
  const s = quarterStartUTC(d)
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 3, 0, 23, 59, 59, 999))
}

function quarterLabel(d: Date): string {
  const m = d.getUTCMonth()
  const q = Math.floor(m / 3) + 1
  return `Q${q}/${String(d.getUTCFullYear()).slice(-2)}`
}

function yearStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

function yearEndUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31, 23, 59, 59, 999))
}

/**
 * Constrói N períodos consecutivos terminando no ymRef (current).
 * Retorna ordem ASC: [oldest, ..., current].
 */
export function buildPeriodos(
  ymRef: string,
  nPeriodos: number,
  granularidade: Granularidade,
): PeriodoBucket[] {
  if (nPeriodos < 1) throw new Error('nPeriodos deve ser >= 1')
  if (nPeriodos > 12) throw new Error('nPeriodos máximo é 12')

  const refMonth = parseRefMonth(ymRef)
  const result: PeriodoBucket[] = []

  if (granularidade === 'mes') {
    // Backward N meses a partir do ref
    const refDate = refMonth.start
    for (let i = nPeriodos - 1; i >= 0; i--) {
      const totalMonth = refDate.getUTCMonth() - i
      const yAdj = refDate.getUTCFullYear() + Math.floor(totalMonth / 12)
      const mNorm = ((totalMonth % 12) + 12) % 12
      const start = new Date(Date.UTC(yAdj, mNorm, 1))
      const end = new Date(Date.UTC(yAdj, mNorm + 1, 0, 23, 59, 59, 999))
      result.push({
        id: `${yAdj}-${String(mNorm + 1).padStart(2, '0')}`,
        label: `${MES_ABREV[mNorm]}/${String(yAdj).slice(-2)}`,
        start,
        end,
      })
    }
  } else if (granularidade === 'trimestre') {
    // Backward N trimestres
    const refQStart = quarterStartUTC(refMonth.start)
    for (let i = nPeriodos - 1; i >= 0; i--) {
      const qDate = new Date(Date.UTC(refQStart.getUTCFullYear(), refQStart.getUTCMonth() - i * 3, 1))
      const start = quarterStartUTC(qDate)
      const end = quarterEndUTC(qDate)
      result.push({
        id: `${start.getUTCFullYear()}-Q${Math.floor(start.getUTCMonth() / 3) + 1}`,
        label: quarterLabel(start),
        start,
        end,
      })
    }
  } else {
    // Backward N anos
    const refYear = refMonth.start.getUTCFullYear()
    for (let i = nPeriodos - 1; i >= 0; i--) {
      const year = refYear - i
      const start = yearStartUTC(new Date(Date.UTC(year, 0, 1)))
      const end = yearEndUTC(new Date(Date.UTC(year, 0, 1)))
      result.push({
        id: `${year}`,
        label: `${year}`,
        start,
        end,
      })
    }
  }

  return result
}

// ────────────────────────────────────────────────────────────────────
// Helpers de média + desvio + heatmap
// ────────────────────────────────────────────────────────────────────

/**
 * Média dos valores ANTERIORES (exclui o último).
 *
 * Bug-fix 28/05/2026: divide só pelos meses COM VALOR > 0. Antes dividia
 * pelo total, diluindo a média quando havia meses zerados (categoria nova
 * ou sem lançamento). Veja docs/sprints/comparativo-bug-referencia-audit.md.
 *
 * Retorna null se:
 * - array tem menos de 2 elementos
 * - todos os anteriores são 0 (sem base histórica de comparação)
 */
export function calcularMediaHistorica(values: number[]): number | null {
  if (values.length < 2) return null
  const anteriores = values.slice(0, -1)
  const comValor = anteriores.filter((v) => v > 0)
  if (comValor.length === 0) return null
  const sum = comValor.reduce((a, b) => a + b, 0)
  return sum / comValor.length
}

export interface DesvioResult {
  desvioPct: number | null
  /** True quando current=0 mas media > 0 — mês de referência ainda sem dados */
  referenciaVazia: boolean
}

/**
 * Desvio relativo de current vs media.
 *
 * Bug-fix 28/05/2026: distingue "ref vazia" (current=0 com média>0) de
 * "queda 100%". Antes retornava -100% pra esse caso, agora retorna
 * desvioPct=null + referenciaVazia=true. UI mostra "—" ou "ref vazia".
 */
export function calcularDesvio(
  current: number,
  media: number | null,
): DesvioResult {
  if (media === null || media === 0) {
    return { desvioPct: null, referenciaVazia: false }
  }
  if (current === 0) {
    // Mês de referência sem lançamentos ainda — não é "caiu 100%"
    return { desvioPct: null, referenciaVazia: true }
  }
  return { desvioPct: (current - media) / media, referenciaVazia: false }
}

/**
 * Helper: extrai SÓ o número (compat com chamadas antigas).
 * @deprecated use calcularDesvio() que retorna {desvioPct, referenciaVazia}
 */
export function calcularDesvioNumber(
  current: number,
  media: number | null,
): number | null {
  return calcularDesvio(current, media).desvioPct
}

/**
 * Classifica cor da célula no heatmap.
 *
 * @param value valor da célula (do mês específico)
 * @param mediaCategoria média histórica da categoria (referência)
 * @param tipo DESPESA ou RECEITA — define semântica favorável/desfavorável
 *
 * Regra IBCS:
 * - DESPESA: subir = desfavorável (vermelho), descer = favorável (verde)
 * - RECEITA: subir = favorável (verde), descer = desfavorável (vermelho)
 */
export function classifyCellTone(
  value: number,
  mediaCategoria: number | null,
  tipo: 'DESPESA' | 'RECEITA',
): CellTone {
  if (mediaCategoria === null || mediaCategoria === 0) return 'transparent'
  // Bug-fix 28/05/2026: célula zerada com média > 0 = "sem dado ainda",
  // não "caiu 100%". Não colorir (transparente). Antes colorava como
  // fav-strong (despesa) ou unfav-strong (receita) — confusão semântica.
  if (value === 0) return 'transparent'
  const desvio = (value - mediaCategoria) / mediaCategoria
  const absDesvio = Math.abs(desvio)

  if (absDesvio < HEAT_WEAK) return 'transparent'

  const acima = desvio > 0
  const favoravel = tipo === 'DESPESA' ? !acima : acima
  const prefix = favoravel ? 'fav' : 'unfav'

  if (absDesvio >= HEAT_STRONG) return `${prefix}-strong` as CellTone
  if (absDesvio >= HEAT_MEDIUM) return `${prefix}-medium` as CellTone
  return `${prefix}-weak` as CellTone
}

// ────────────────────────────────────────────────────────────────────
// Engine principal: computeComparativoMulti
// ────────────────────────────────────────────────────────────────────

export interface ComparativoMultiInput {
  ymRef: string
  nPeriodos: number
  granularidade: Granularidade
  tipo: ComparativoTipoFilter
}

export function computeComparativoMulti(
  txs: ComparativoInputTx[],
  opts: ComparativoMultiInput,
): ComparativoMultiResult {
  const periodos = buildPeriodos(opts.ymRef, opts.nPeriodos, opts.granularidade)
  const N = periodos.length

  // Mapa categoryId → values[N], dreGroup, nome
  type Bucket = { name: string; dreGroup: string | null; values: number[] }
  const buckets = new Map<string, Bucket>()

  for (const tx of txs) {
    if (opts.tipo === 'DESPESA' && tx.type !== 'DEBIT') continue
    if (opts.tipo === 'RECEITA' && tx.type !== 'CREDIT') continue

    const date = tx.bucketDate instanceof Date ? tx.bucketDate : new Date(tx.bucketDate)
    if (Number.isNaN(date.getTime())) continue

    // Localiza qual bucket cobre essa data
    let idx = -1
    for (let i = 0; i < N; i++) {
      const p = periodos[i]
      if (date >= p.start && date <= p.end) {
        idx = i
        break
      }
    }
    if (idx < 0) continue

    const key = tx.categoryId ?? '__sem_categoria__'
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        name: tx.categoryName ?? 'Sem categoria',
        dreGroup: tx.dreGroup,
        values: Array<number>(N).fill(0),
      }
      buckets.set(key, bucket)
    }
    bucket.values[idx] += Math.abs(tx.amount)
  }

  // Constrói rows
  const tipoForHeat: 'DESPESA' | 'RECEITA' =
    opts.tipo === 'RECEITA' ? 'RECEITA' : 'DESPESA' // 'TODOS' usa DESPESA como default visual
  const rows: ComparativoRowMulti[] = []
  for (const [key, bucket] of buckets) {
    const currentValue = bucket.values[N - 1] ?? 0
    const prevValue = N >= 2 ? bucket.values[N - 2] ?? 0 : 0
    const prev2Value = N >= 3 ? bucket.values[N - 3] ?? 0 : 0
    const trend = trendIndicator(prev2Value, prevValue, currentValue)
    const mediaHistorica = calcularMediaHistorica(bucket.values)
    const desvio = calcularDesvio(currentValue, mediaHistorica)
    const cellTones: CellTone[] = bucket.values.map((v) =>
      classifyCellTone(v, mediaHistorica, tipoForHeat),
    )
    const total = bucket.values.reduce((a, b) => a + b, 0)

    rows.push({
      categoryId: key === '__sem_categoria__' ? null : key,
      categoryName: bucket.name,
      dreGroup: bucket.dreGroup,
      values: bucket.values,
      mediaHistorica,
      desvioPct: desvio.desvioPct,
      referenciaVazia: desvio.referenciaVazia,
      total,
      trend,
      cellTones,
    })
  }

  rows.sort((a, b) => b.total - a.total)

  // Totals por período
  const totalsPorPeriodo = Array<number>(N).fill(0)
  let totalGeral = 0
  for (const r of rows) {
    for (let i = 0; i < N; i++) {
      totalsPorPeriodo[i] += r.values[i]
    }
    totalGeral += r.total
  }
  const totalsMedia = calcularMediaHistorica(totalsPorPeriodo)
  const totalsDesvio = calcularDesvio(
    totalsPorPeriodo[N - 1] ?? 0,
    totalsMedia,
  )

  // Summary pros stats cards
  let novas = 0
  let subindo = 0
  let descendo = 0
  let foraDaMedia = 0
  for (const r of rows) {
    if (r.trend.indicator === 'NEW') novas++
    if (r.trend.indicator === 'UP' || r.trend.indicator === 'UP_STRONG') subindo++
    if (r.trend.indicator === 'DOWN' || r.trend.indicator === 'DOWN_STRONG') descendo++
    // "Fora da média" = SÓ DESPESAS com desvio > +15% (decisão Yussef)
    if (
      opts.tipo === 'DESPESA' &&
      r.desvioPct !== null &&
      r.desvioPct > HEAT_WEAK
    ) {
      foraDaMedia++
    }
  }

  return {
    rows,
    totals: {
      porPeriodo: totalsPorPeriodo,
      mediaHistorica: totalsMedia,
      desvioPct: totalsDesvio.desvioPct,
      referenciaVazia: totalsDesvio.referenciaVazia,
      total: totalGeral,
    },
    periodos,
    summary: { novas, subindo, descendo, foraDaMedia },
  }
}

/** Filtra rows do multi conforme modo de UI. */
export function filterRowsMulti(
  rows: ComparativoRowMulti[],
  mode: ComparativoFilterMode['filter'],
): ComparativoRowMulti[] {
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

/** Classes Tailwind por CellTone (Sprint A safelist). */
export const CELL_TONE_CLASSES: Record<CellTone, string> = {
  transparent: '',
  'fav-weak': 'bg-emerald-50 dark:bg-emerald-950/40',
  'fav-medium': 'bg-emerald-100 dark:bg-emerald-900/50',
  'fav-strong': 'bg-emerald-200 dark:bg-emerald-800/60',
  'unfav-weak': 'bg-red-50 dark:bg-red-950/40',
  'unfav-medium': 'bg-red-100 dark:bg-red-900/50',
  'unfav-strong': 'bg-red-200 dark:bg-red-800/60',
}

// ════════════════════════════════════════════════════════════════════
// Hotfix 28/05/2026 — getDesvioVisual pra coluna "vs Média"
// ════════════════════════════════════════════════════════════════════
//
// Substitui getTrendVisualSemantic na coluna "vs Média". A diferença
// fundamental:
// - getTrendVisualSemantic usa trend.indicator (current vs prev1 — mês
//   imediatamente anterior). Útil pra "Tendência" geral.
// - getDesvioVisual usa desvioPct + referenciaVazia (current vs média
//   histórica). É a métrica CORRETA pra coluna "vs Média".
//
// Antes deste fix, a coluna "vs Média" mostrava ícone do trend +
// número do desvio — métricas conflitantes. Ex: Salários Mar/26 mostrava
// "↑ -0,3%" (subiu 15% vs Fev mas está 0,3% abaixo da média).

export type DesvioStatus =
  | 'sem-media' // mediaHistorica null
  | 'ref-vazia' // referenciaVazia=true
  | 'na-media' // |desvio| <= 0.15
  | 'acima' // desvio > +0.15
  | 'abaixo' // desvio < -0.15

export interface DesvioVisual {
  status: DesvioStatus
  /** "" / "↑" / "↓" / "━" — sem ícone solto pra sem-media/ref-vazia */
  symbol: string
  /** Classes Tailwind */
  colorClass: string
  /** Label longo pra acessibilidade/title */
  label: string
}

const DESVIO_THRESHOLD = 0.15

export function getDesvioVisual(
  desvioPct: number | null,
  referenciaVazia: boolean,
  tipo: 'DESPESA' | 'RECEITA',
): DesvioVisual {
  if (referenciaVazia) {
    return {
      status: 'ref-vazia',
      symbol: '',
      colorClass: 'text-muted-foreground italic',
      label: 'Mês de referência sem lançamentos',
    }
  }
  if (desvioPct === null) {
    return {
      status: 'sem-media',
      symbol: '',
      colorClass: 'text-muted-foreground',
      label: 'Sem média histórica',
    }
  }
  if (Math.abs(desvioPct) <= DESVIO_THRESHOLD) {
    return {
      status: 'na-media',
      symbol: '━',
      colorClass: 'text-slate-500 dark:text-slate-400',
      label: 'Na média',
    }
  }
  const acima = desvioPct > 0
  // Semântica IBCS: DESPESA subir = desfavorável (vermelho)
  //                 RECEITA subir = favorável (verde)
  const favoravel = tipo === 'DESPESA' ? !acima : acima

  return {
    status: acima ? 'acima' : 'abaixo',
    symbol: acima ? '↑' : '↓',
    colorClass: favoravel
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400',
    label: acima ? 'Acima da média' : 'Abaixo da média',
  }
}

/**
 * Formata desvio em pct com 1 casa decimal + sinal explícito.
 * Hotfix 28/05/2026: substitui Math.round() que arredondava -0,26% pra "0%"
 * (perdia sinal + magnitude pequena).
 *
 * Ex: 0.0026 → "+0,3%" · -0.0026 → "-0,3%" · 0.234 → "+23,4%"
 */
export function formatDesvioPct(v: number | null): string {
  if (v === null) return '—'
  const pct = v * 100
  // Locale BR usa vírgula decimal
  const formatted = pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return pct >= 0 ? `+${formatted}%` : `${formatted}%`
}

/**
 * Visual semântico IBCS — cor depende de (indicator × tipo).
 * SOBRESCREVE TREND_VISUAL pra usos novos. Mantém visualmente coerente:
 * - DESPESA subindo → vermelho
 * - RECEITA subindo → verde
 */
export function getTrendVisualSemantic(
  indicator: TrendIndicator,
  tipo: 'DESPESA' | 'RECEITA',
): { symbol: string; colorClass: string; label: string } {
  // NEW/GONE/EMPTY/STABLE são independentes do tipo
  if (indicator === 'NEW') return TREND_VISUAL.NEW
  if (indicator === 'GONE') return TREND_VISUAL.GONE
  if (indicator === 'EMPTY') return TREND_VISUAL.EMPTY
  if (indicator === 'STABLE') return TREND_VISUAL.STABLE

  // UP/UP_STRONG/DOWN/DOWN_STRONG dependem da semântica
  const colors: Record<
    'UP_STRONG' | 'UP' | 'DOWN' | 'DOWN_STRONG',
    Record<'DESPESA' | 'RECEITA', string>
  > = {
    UP_STRONG: {
      DESPESA: 'text-red-600 dark:text-red-400 font-bold',
      RECEITA: 'text-emerald-600 dark:text-emerald-400 font-bold',
    },
    UP: {
      DESPESA: 'text-red-600 dark:text-red-400',
      RECEITA: 'text-emerald-600 dark:text-emerald-400',
    },
    DOWN: {
      DESPESA: 'text-emerald-600 dark:text-emerald-400',
      RECEITA: 'text-red-600 dark:text-red-400',
    },
    DOWN_STRONG: {
      DESPESA: 'text-emerald-700 dark:text-emerald-300 font-bold',
      RECEITA: 'text-red-700 dark:text-red-300 font-bold',
    },
  }

  return {
    symbol: TREND_VISUAL[indicator].symbol,
    colorClass: colors[indicator as keyof typeof colors][tipo],
    label: TREND_VISUAL[indicator].label,
  }
}
