// Sprint 5.0.3.0c (c4) — Cálculo dos buckets de aging (inadimplência).
//
// Padrão contábil: agrupa contas VENCIDAS (status=PENDING + dueDate < hoje)
// por dias de atraso em 4 buckets:
//   - 0-30 dias    (Amber)
//   - 31-60 dias   (Orange)
//   - 61-90 dias   (Red)
//   - 90+ dias     (Dark red, bold)

export type AgingBucketId = '0-30' | '31-60' | '61-90' | '90+'

export const AGING_BUCKET_IDS: ReadonlyArray<AgingBucketId> = [
  '0-30',
  '31-60',
  '61-90',
  '90+',
]

export interface AgingInput {
  status: string // PENDING / RECONCILED / IGNORED
  dueDate: Date | string | null
  paymentDate: Date | string | null
  amount: number
}

export interface AgingBucket {
  id: AgingBucketId
  count: number
  amount: number
  /** % do total deste aging (0-100). */
  percent: number
}

export interface AgingResult {
  buckets: AgingBucket[]
  total: { count: number; amount: number }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function startOfDayUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
}

/** Retorna o bucket pra uma linha individual, ou null se não está vencida. */
export function bucketFor(
  row: AgingInput,
  now: Date = new Date(),
): AgingBucketId | null {
  // Só PENDING sem paymentDate
  if (row.status !== 'PENDING' || row.paymentDate) return null
  if (!row.dueDate) return null

  const due = row.dueDate instanceof Date ? row.dueDate : new Date(row.dueDate)
  if (Number.isNaN(due.getTime())) return null

  // Diff em DIAS (comparação por dia, não timestamp)
  const dueDay = startOfDayUTC(due)
  const nowDay = startOfDayUTC(now)
  const diffDays = Math.floor((nowDay.getTime() - dueDay.getTime()) / ONE_DAY_MS)

  if (diffDays <= 0) return null // ainda não venceu (hoje ou futuro)
  if (diffDays <= 30) return '0-30'
  if (diffDays <= 60) return '31-60'
  if (diffDays <= 90) return '61-90'
  return '90+'
}

export function computeAging(
  rows: AgingInput[],
  now: Date = new Date(),
): AgingResult {
  const tally: Record<AgingBucketId, { count: number; amount: number }> = {
    '0-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '61-90': { count: 0, amount: 0 },
    '90+': { count: 0, amount: 0 },
  }

  for (const row of rows) {
    const bucket = bucketFor(row, now)
    if (!bucket) continue
    tally[bucket].count++
    tally[bucket].amount += row.amount
  }

  const totalCount = AGING_BUCKET_IDS.reduce((s, id) => s + tally[id].count, 0)
  const totalAmount = AGING_BUCKET_IDS.reduce(
    (s, id) => s + tally[id].amount,
    0,
  )

  const buckets: AgingBucket[] = AGING_BUCKET_IDS.map((id) => ({
    id,
    count: tally[id].count,
    amount: tally[id].amount,
    percent: totalAmount > 0 ? (tally[id].amount / totalAmount) * 100 : 0,
  }))

  return {
    buckets,
    total: { count: totalCount, amount: totalAmount },
  }
}

/**
 * Calcula período (dataDe/dataAte) pra aplicar como filtro quando user clica
 * num bucket. Retorna ISO YYYY-MM-DD pro input HTML date.
 *
 * 0-30: hoje-30 → hoje-1
 * 31-60: hoje-60 → hoje-31
 * 61-90: hoje-90 → hoje-61
 * 90+: '' → hoje-91 (sem limite inferior)
 */
export function periodFromBucket(
  bucket: AgingBucketId,
  now: Date = new Date(),
): { dataDe: string; dataAte: string } {
  function fmt(d: Date): string {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  function addDays(d: Date, n: number): Date {
    const x = new Date(d)
    x.setUTCDate(x.getUTCDate() + n)
    return x
  }
  switch (bucket) {
    case '0-30':
      return { dataDe: fmt(addDays(now, -30)), dataAte: fmt(addDays(now, -1)) }
    case '31-60':
      return { dataDe: fmt(addDays(now, -60)), dataAte: fmt(addDays(now, -31)) }
    case '61-90':
      return { dataDe: fmt(addDays(now, -90)), dataAte: fmt(addDays(now, -61)) }
    case '90+':
      return { dataDe: '', dataAte: fmt(addDays(now, -91)) }
  }
}

/** Cores Tailwind safelist pros buckets. */
export const AGING_COLORS: Record<
  AgingBucketId,
  { text: string; bg: string; label: string }
> = {
  '0-30': {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    label: '0-30 dias',
  },
  '31-60': {
    text: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-950/40',
    label: '31-60 dias',
  },
  '61-90': {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/40',
    label: '61-90 dias',
  },
  '90+': {
    text: 'text-red-700 dark:text-red-300 font-bold',
    bg: 'bg-red-200 dark:bg-red-950/60',
    label: '90+ dias',
  },
}
