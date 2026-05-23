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
}

const CUID_RE = /^c[a-z0-9]{20,30}$/i

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
})

export function parseTransacoesURLFilters(raw: {
  tipo?: string | null
  inicio?: string | null
  fim?: string | null
  categoryId?: string | null
  q?: string | null
  importId?: string | null
  conferencia?: string | null
}): TransacoesURLFilters {
  return filtersSchema.parse({
    tipo: raw.tipo ?? null,
    inicio: raw.inicio ?? null,
    fim: raw.fim ?? null,
    categoryId: raw.categoryId ?? null,
    q: raw.q ?? null,
    importId: raw.importId ?? null,
    conferencia: raw.conferencia === 'true' || raw.conferencia === '1',
  })
}
