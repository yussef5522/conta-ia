// Sprint 5.0.3.0b — Saved Views: 4 views fixas hardcoded.
//
// Views customizadas (CRUD + tabela SavedView no Prisma) ficam pra 5.0.3.0c.
// Nesta sprint as 4 views são definidas em código + funcionam via URL state.
//
// Cada view tem uma função pura `buildFilters(now)` que retorna os campos
// do PayableFilterState que ela aplica. Caller faz merge com state atual
// (ou substitui — semântica decidida no hook useSavedView).

import type { PayableFilterState } from '@/components/contas-pagar/PayableFilters'

/** IDs estáveis das 4 views — usados em URL `?view=<id>`. */
export type SavedViewId = 'todas' | 'vencidas' | 'a-vencer-7d' | 'pagas-mes'

export const SAVED_VIEW_IDS: ReadonlyArray<SavedViewId> = [
  'todas',
  'vencidas',
  'a-vencer-7d',
  'pagas-mes',
]

/** Configuração ESTENDIDA do filter state pra suportar dataField. */
export interface PayableFilterStateExt extends PayableFilterState {
  /** dueDate (default), paymentDate, date, competenceDate */
  dataField?: 'dueDate' | 'paymentDate' | 'date' | 'competenceDate'
  sortBy?: 'dueDate' | 'paymentDate' | 'amount' | 'description' | 'createdAt'
  sortDir?: 'asc' | 'desc'
}

export interface SavedViewDef {
  id: SavedViewId
  name: string
  /** Função pura — retorna os filtros aplicados pela view. */
  buildFilters: (now: Date) => PayableFilterStateExt
}

// ────────────────────────────────────────────────────────────────────
// Date helpers (inline pra não puxar date-fns só por isso)
// ────────────────────────────────────────────────────────────────────

function formatISODate(d: Date): string {
  // YYYY-MM-DD em UTC (consistente com `input[type=date]` HTML)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setUTCDate(next.getUTCDate() + n)
  return next
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function endOfMonthUTC(d: Date): Date {
  // Dia 0 do mês seguinte = último dia do mês atual
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

// ────────────────────────────────────────────────────────────────────
// As 4 SAVED VIEWS — fonte da verdade
// ────────────────────────────────────────────────────────────────────

export const SAVED_VIEWS: ReadonlyArray<SavedViewDef> = [
  {
    id: 'todas',
    name: 'Todas',
    buildFilters: () => ({
      q: '',
      dataDe: '',
      dataAte: '',
      status: 'TODOS',
      vencidasOnly: false,
      dataField: 'dueDate',
      sortBy: 'dueDate',
      sortDir: 'desc',
    }),
  },
  {
    id: 'vencidas',
    name: 'Vencidas',
    buildFilters: () => ({
      q: '',
      dataDe: '',
      dataAte: '',
      status: 'PENDING',
      vencidasOnly: true,
      dataField: 'dueDate',
      sortBy: 'dueDate',
      sortDir: 'asc', // mais antiga primeiro (mais crítica)
    }),
  },
  {
    id: 'a-vencer-7d',
    name: 'A vencer 7d',
    buildFilters: (now) => ({
      q: '',
      dataDe: formatISODate(now),
      dataAte: formatISODate(addDays(now, 7)),
      status: 'PENDING',
      vencidasOnly: false,
      dataField: 'dueDate',
      sortBy: 'dueDate',
      sortDir: 'asc',
    }),
  },
  {
    id: 'pagas-mes',
    name: 'Pagas no mês',
    buildFilters: (now) => ({
      q: '',
      dataDe: formatISODate(startOfMonthUTC(now)),
      dataAte: formatISODate(endOfMonthUTC(now)),
      status: 'RECONCILED',
      vencidasOnly: false,
      // CRÍTICO: usa paymentDate, não dueDate
      dataField: 'paymentDate',
      sortBy: 'paymentDate',
      sortDir: 'desc',
    }),
  },
]

export function isValidSavedViewId(id: string | null): id is SavedViewId {
  return id !== null && SAVED_VIEW_IDS.includes(id as SavedViewId)
}

export function getSavedView(id: SavedViewId): SavedViewDef {
  const view = SAVED_VIEWS.find((v) => v.id === id)
  if (!view) {
    // Defesa em profundidade — tipo já garante isso
    throw new Error(`Saved view "${id}" not found`)
  }
  return view
}

/**
 * Compara state atual com filtros da view — se EXATAMENTE iguais,
 * a view está ativa. Caso contrário, "Custom" (nenhuma chip ativa).
 *
 * Ignora `q` (busca textual livre — não invalida a view).
 */
export function findActiveSavedView(
  current: Partial<PayableFilterStateExt>,
  now: Date,
): SavedViewId | null {
  for (const view of SAVED_VIEWS) {
    const expected = view.buildFilters(now)
    if (
      current.dataDe === expected.dataDe &&
      current.dataAte === expected.dataAte &&
      current.status === expected.status &&
      current.vencidasOnly === expected.vencidasOnly &&
      (current.dataField ?? 'dueDate') === expected.dataField
    ) {
      return view.id
    }
  }
  return null
}
