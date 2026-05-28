// Sprint 5.0.4.0a (a3) — Lógica pura da Análise Top N por Categoria.

export interface CategoriaInputTx {
  amount: number
  type: string // CREDIT | DEBIT
  date: Date | string
  categoryId: string | null
  categoryName: string | null
  dreGroup: string | null
}

export interface TopCategoriaRow {
  categoryId: string | null
  categoryName: string
  dreGroup: string | null
  amount: number
  count: number
  /** % do TOTAL do filtro (0-100) */
  percent: number
}

export interface TopCategoriasInput {
  txs: CategoriaInputTx[]
  /** Período inclusivo */
  start: Date
  end: Date
  tipo: 'DESPESA' | 'RECEITA' | 'TODOS'
  /** Top N (default 10). Resto agrupado em "Outras N categorias". */
  topN?: number
}

export interface TopCategoriasResult {
  rows: TopCategoriaRow[]
  /** Linha "Outras" — agrega tudo abaixo do topN. null se cabe tudo no topN. */
  outras: TopCategoriaRow | null
  totalAmount: number
  totalCount: number
  totalCategorias: number
}

export function computeTopCategorias({
  txs,
  start,
  end,
  tipo,
  topN = 10,
}: TopCategoriasInput): TopCategoriasResult {
  // Filtra por tipo + período
  type Bucket = {
    name: string
    dreGroup: string | null
    amount: number
    count: number
  }
  const buckets = new Map<string, Bucket>()

  for (const tx of txs) {
    if (tipo === 'DESPESA' && tx.type !== 'DEBIT') continue
    if (tipo === 'RECEITA' && tx.type !== 'CREDIT') continue

    const d = tx.date instanceof Date ? tx.date : new Date(tx.date)
    if (Number.isNaN(d.getTime())) continue
    if (d < start || d > end) continue

    const key = tx.categoryId ?? '__sem_categoria__'
    let b = buckets.get(key)
    if (!b) {
      b = {
        name: tx.categoryName ?? 'Sem categoria',
        dreGroup: tx.dreGroup,
        amount: 0,
        count: 0,
      }
      buckets.set(key, b)
    }
    b.amount += Math.abs(tx.amount)
    b.count += 1
  }

  const totalAmount = Array.from(buckets.values()).reduce(
    (s, b) => s + b.amount,
    0,
  )
  const totalCount = Array.from(buckets.values()).reduce(
    (s, b) => s + b.count,
    0,
  )

  // Constrói linhas + ordena DESC por amount
  const all: TopCategoriaRow[] = []
  for (const [key, b] of buckets) {
    all.push({
      categoryId: key === '__sem_categoria__' ? null : key,
      categoryName: b.name,
      dreGroup: b.dreGroup,
      amount: b.amount,
      count: b.count,
      percent: totalAmount > 0 ? (b.amount / totalAmount) * 100 : 0,
    })
  }
  all.sort((a, b) => b.amount - a.amount)

  const rows = all.slice(0, topN)
  const restante = all.slice(topN)

  let outras: TopCategoriaRow | null = null
  if (restante.length > 0) {
    const sumAmount = restante.reduce((s, r) => s + r.amount, 0)
    const sumCount = restante.reduce((s, r) => s + r.count, 0)
    outras = {
      categoryId: '__outras__',
      categoryName: `Outras ${restante.length} categorias`,
      dreGroup: null,
      amount: sumAmount,
      count: sumCount,
      percent: totalAmount > 0 ? (sumAmount / totalAmount) * 100 : 0,
    }
  }

  return {
    rows,
    outras,
    totalAmount,
    totalCount,
    totalCategorias: all.length,
  }
}

/** Cores semânticas pro gráfico de barras (alinhadas com tema). */
export const BAR_COLORS = [
  '#0ea5e9', // sky-500 (top 1)
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#3b82f6', // blue-500
  '#84cc16', // lime-500
  '#f43f5e', // rose-500
  '#06b6d4', // cyan-500
]

export function colorForIndex(i: number): string {
  return BAR_COLORS[i % BAR_COLORS.length]
}
