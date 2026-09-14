import { statusDaConta } from '@/lib/contas-pagar/escopo'

// Sprint 5.0.3.0a — Função pura que computa o status visual de uma linha
// a partir de status DB + dueDate + paymentDate. Usada pra cor da tarja
// lateral, badge na coluna Status, classificação nos 4 stats cards.

/**
 * ⭐⭐⭐ TRÊS STATUS, COMO NO MUNDO REAL (13/09/2026) — decisão do dono.
 *
 * ⛔ **`warn` ("Vence em breve") MORREU como status.** *"Vence em 2 dias" é informação da
 * COLUNA de vencimento, nunca um status/filtro/stat próprio* — e como STATUS ele fazia
 * duas coisas erradas: (a) era um SUBCONJUNTO de "a pagar", então a soma dos quatro cards
 * contava a mesma conta 2×; (b) discordava do KPI, que comparava `dueDate < now` por
 * TIMESTAMP enquanto isto aqui comparava por DIA — era essa a briga entre `34 · 48.502,57`
 * e `9 · 20.635,54` no print do dono.
 *
 * ⚠️ O tipo fica com 3 valores por CONSTRUÇÃO: um `warn` novo não compila.
 */
export type PayableVisualStatus = 'paid' | 'pending' | 'overdue'


export interface PayableLike {
  status: string // PENDING | RECONCILED | IGNORED
  dueDate: Date | string | null
  paymentDate: Date | string | null
}


/**
 * ⚠️⚠️ **ESTA FUNÇÃO NÃO TEM MAIS RÉGUA PRÓPRIA** — ela é casca sobre `statusDaConta`.
 *
 * Era aqui que morava a SEGUNDA definição de "vencida" (por dia, UTC) contra a do KPI
 * (por timestamp). Duas réguas pra mesma palavra é o que fazia o card dizer 34 e a tabela
 * pintar outra coisa. **Uma decisão, uma função** (o padrão do `contarFilas`).
 */
export function payableVisualStatus(
  row: PayableLike,
  now: Date = new Date(),
): PayableVisualStatus {
  const s = statusDaConta(row, now)
  return s === 'PAGA' ? 'paid' : s === 'VENCIDA' ? 'overdue' : 'pending'
}

/** Label humano em PT-BR pra exibição. */
export function payableStatusLabel(s: PayableVisualStatus): string {
  return s === 'paid' ? 'Paga' : s === 'overdue' ? 'Vencida' : 'A pagar'
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
  overdue: {
    stripe: 'bg-red-500',
    badgeBg: 'bg-red-100 dark:bg-red-950/40',
    badgeText: 'text-red-700 dark:text-red-300',
    // Vencida → vermelho (comportamento atual)
    amountText: 'text-red-600 dark:text-red-400',
  },
}
