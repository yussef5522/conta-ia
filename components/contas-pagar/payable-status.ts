// Sprint 5.0.3.0a — Função pura que computa o status visual de uma linha
// a partir de status DB + dueDate + paymentDate. Usada pra cor da tarja
// lateral, badge na coluna Status, classificação nos 4 stats cards.

export type PayableVisualStatus = 'paid' | 'pending' | 'warn' | 'overdue'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const THREE_DAYS_MS = 3 * ONE_DAY_MS

export interface PayableLike {
  status: string // PENDING | RECONCILED | IGNORED
  dueDate: Date | string | null
  paymentDate: Date | string | null
}

/** Retorna meia-noite UTC do dia (zera HH:MM:SS pra comparações por DIA). */
function startOfDayUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
}

export function payableVisualStatus(
  row: PayableLike,
  now: Date = new Date(),
): PayableVisualStatus {
  // Paga = paymentDate preenchida — independe de status DB (RECONCILED ou EFFECTED)
  if (row.paymentDate) return 'paid'

  // PENDING sem paymentDate
  const due = row.dueDate
    ? row.dueDate instanceof Date
      ? row.dueDate
      : new Date(row.dueDate)
    : null

  if (!due) return 'pending' // sem prazo definido

  // Comparação por DIA (não timestamp) — "vence hoje" é warn, não overdue.
  const dueDay = startOfDayUTC(due)
  const nowDay = startOfDayUTC(now)
  const diffMs = dueDay.getTime() - nowDay.getTime()

  if (diffMs < 0) return 'overdue' // venceu em dia anterior
  if (diffMs <= THREE_DAYS_MS) return 'warn' // hoje ou até 3 dias
  return 'pending'
}

/** Label humano em PT-BR pra exibição. */
export function payableStatusLabel(s: PayableVisualStatus): string {
  return s === 'paid'
    ? 'Paga'
    : s === 'overdue'
      ? 'Vencida'
      : s === 'warn'
        ? 'Vence em breve'
        : 'A pagar'
}

/** Classes Tailwind pro badge + tarja lateral. Mapas explícitos (safelist). */
export const PAYABLE_STATUS_COLOR: Record<
  PayableVisualStatus,
  { stripe: string; badgeBg: string; badgeText: string; amountText: string }
> = {
  paid: {
    stripe: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    // Sprint Cor-Valor-Status (07/06/2026): valor verde quando paga,
    // batendo com a palavra "Paga"
    amountText: 'text-emerald-700 dark:text-emerald-400',
  },
  pending: {
    stripe: 'bg-sky-500',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
    // Pendente normal (não vencida, sem urgência) → neutro
    amountText: 'text-foreground',
  },
  warn: {
    stripe: 'bg-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    // Vence em breve (≤3d) → âmbar suave, mesmo tom do badge
    amountText: 'text-amber-700 dark:text-amber-400',
  },
  overdue: {
    stripe: 'bg-red-500',
    badgeBg: 'bg-red-100 dark:bg-red-950/40',
    badgeText: 'text-red-700 dark:text-red-300',
    // Vencida → vermelho (comportamento atual)
    amountText: 'text-red-600 dark:text-red-400',
  },
}
