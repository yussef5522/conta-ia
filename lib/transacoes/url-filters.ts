// Parser dos filtros de URL da página /transacoes — Sprint 2 Dia 2.
// Usado pelo drill-down do Cashflow Waterfall (e qualquer dashboard futuro
// que linke pra transações filtradas).
//
// Validação Zod com `.catch()` — inputs maliciosos/malformados na URL não
// quebram a página, caem graciosamente pra null (filtro desativado).

import { z } from 'zod'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface TransacoesURLFilters {
  tipo: 'CREDIT' | 'DEBIT' | null
  inicio: string | null
  fim: string | null
  // Sprint 3.0.2 — novos filtros
  categoryId: string | null
  q: string | null
  importId: string | null
  conferencia: boolean
  // Sprint 3.0.3 B4 — filtro por valor
  valorMin: number | null
  valorMax: number | null
  // Sprint 3.0.4 C4 — URL persistente completa
  status: 'PENDING' | 'RECONCILED' | 'IGNORED' | null
  contaId: string | null
  page: number | null
}

const CUID_RE = /^c[a-z0-9]{20,30}$/i

// Coerção segura número: aceita string ou null. NaN/Infinity/negativo → null.
const numberOrNull = z
  .union([
    z.number(),
    z.string().transform((s) => {
      if (s.trim() === '') return null
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }),
    z.null(),
  ])
  .transform((v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null))
  .catch(null)

// Sprint 3.0.4 C4 — page é número positivo inteiro
const pageOrNull = z
  .union([
    z.number(),
    z.string().transform((s) => {
      if (s.trim() === '') return null
      const n = Number(s)
      return Number.isInteger(n) ? n : null
    }),
    z.null(),
  ])
  .transform((v) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10_000 ? v : null))
  .catch(null)

const filtersSchema = z.object({
  tipo: z.enum(['CREDIT', 'DEBIT']).nullable().catch(null),
  inicio: z.string().regex(DATE_RE).nullable().catch(null),
  fim: z.string().regex(DATE_RE).nullable().catch(null),
  categoryId: z.string().regex(CUID_RE).nullable().catch(null),
  q: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .catch(null),
  importId: z.string().regex(CUID_RE).nullable().catch(null),
  conferencia: z.boolean().catch(false),
  valorMin: numberOrNull,
  valorMax: numberOrNull,
  status: z.enum(['PENDING', 'RECONCILED', 'IGNORED']).nullable().catch(null),
  contaId: z.string().regex(CUID_RE).nullable().catch(null),
  page: pageOrNull,
})

export function parseTransacoesURLFilters(raw: {
  tipo?: string | null
  inicio?: string | null
  fim?: string | null
  categoryId?: string | null
  q?: string | null
  importId?: string | null
  conferencia?: string | null
  valorMin?: string | number | null
  valorMax?: string | number | null
  status?: string | null
  contaId?: string | null
  page?: string | number | null
}): TransacoesURLFilters {
  return filtersSchema.parse({
    tipo: raw.tipo ?? null,
    inicio: raw.inicio ?? null,
    fim: raw.fim ?? null,
    categoryId: raw.categoryId ?? null,
    q: raw.q ?? null,
    importId: raw.importId ?? null,
    conferencia: raw.conferencia === 'true' || raw.conferencia === '1',
    valorMin: raw.valorMin ?? null,
    valorMax: raw.valorMax ?? null,
    status: raw.status ?? null,
    contaId: raw.contaId ?? null,
    page: raw.page ?? null,
  })
}

// Sprint 3.0.4 C4 — Builder REVERSO: state → URL search params.
// Usado pelo client pra fazer router.replace(?...) sempre que filtros mudam.
// Só inclui chaves com valor SIGNIFICATIVO (≠ default), URL fica limpa.
export interface BuildURLInput {
  tipo?: string  // 'TODOS' = ignorado
  status?: string  // 'TODOS' = ignorado
  contaFiltro?: string  // 'TODAS' = ignorado
  categoryId?: string  // 'TODAS' = ignorado
  q?: string  // '' = ignorado
  valorMin?: string  // '' = ignorado
  valorMax?: string  // '' = ignorado
  inicio?: string
  fim?: string
  page?: number  // 1 = ignorado
  empresaId?: string
  importId?: string
  conferencia?: boolean
}

export function buildTransacoesURLParams(input: BuildURLInput): URLSearchParams {
  const p = new URLSearchParams()
  if (input.tipo && input.tipo !== 'TODOS') p.set('tipo', input.tipo)
  if (input.status && input.status !== 'TODOS') p.set('status', input.status)
  if (input.contaFiltro && input.contaFiltro !== 'TODAS') p.set('contaId', input.contaFiltro)
  if (input.categoryId && input.categoryId !== 'TODAS') p.set('categoryId', input.categoryId)
  if (input.q && input.q.trim() !== '') p.set('q', input.q.trim())
  if (input.valorMin && input.valorMin.trim() !== '') p.set('valorMin', input.valorMin.trim())
  if (input.valorMax && input.valorMax.trim() !== '') p.set('valorMax', input.valorMax.trim())
  if (input.inicio) p.set('inicio', input.inicio)
  if (input.fim) p.set('fim', input.fim)
  if (input.page && input.page > 1) p.set('page', String(input.page))
  if (input.empresaId) p.set('empresaId', input.empresaId)
  if (input.importId) p.set('importId', input.importId)
  if (input.conferencia) p.set('conferencia', 'true')
  return p
}
