// Sprint 5.0.3.0c — Validações Zod pra SavedView CRUD.

import { z } from 'zod'

const SCOPE = z.enum(['payable', 'receivable', 'transactions'])
const DENSITY = z.enum(['compact', 'normal', 'comfortable'])
const SORT_DIR = z.enum(['asc', 'desc'])

// JSON string que dá parse pra array de strings (columnOrder/columnHidden)
function jsonStringArray() {
  return z
    .string()
    .default('[]')
    .refine(
      (s) => {
        try {
          const parsed = JSON.parse(s)
          return (
            Array.isArray(parsed) &&
            parsed.every((x) => typeof x === 'string')
          )
        } catch {
          return false
        }
      },
      { message: 'columnOrder/columnHidden deve ser JSON array de strings' },
    )
}

// Filtros aplicados pela view — guardamos como JSON (texto)
// Schema permite Prisma JSON-encoded — validamos só que é string JSON válido
// (validação semântica acontece quando aplicado pelos hooks de página).
const filtersJsonString = z
  .string()
  .refine(
    (s) => {
      try {
        JSON.parse(s)
        return true
      } catch {
        return false
      }
    },
    { message: 'filters deve ser JSON válido' },
  )

export const savedViewCreateSchema = z.object({
  empresaId: z.string().cuid().nullable().optional(),
  scope: SCOPE.default('payable'),
  name: z.string().min(1, 'Nome obrigatório').max(50, 'Nome até 50 caracteres'),
  icon: z.string().max(10).nullable().optional(),
  filters: filtersJsonString,
  sortBy: z.string().max(50).nullable().optional(),
  sortDir: SORT_DIR.nullable().optional(),
  // jsonStringArray() já tem .default('[]') interno — não usar .optional()
  // (que sobrescreveria o default com undefined).
  columnOrder: jsonStringArray(),
  columnHidden: jsonStringArray(),
  density: DENSITY.default('normal'),
  pinnedOrder: z.number().int().min(0).default(0),
})

export const savedViewUpdateSchema = savedViewCreateSchema.partial()

export const savedViewReorderSchema = z.object({
  scope: SCOPE.default('payable'),
  empresaId: z.string().cuid().nullable().optional(),
  ids: z.array(z.string().cuid()).min(1).max(100),
})

export type SavedViewCreateInput = z.infer<typeof savedViewCreateSchema>
export type SavedViewUpdateInput = z.infer<typeof savedViewUpdateSchema>
export type SavedViewReorderInput = z.infer<typeof savedViewReorderSchema>

// ─── Inline edit (PATCH /contas-pagar/[id]/inline) ────────────────────

// Discriminated union por field — cada campo tem schema próprio.
export const inlineEditSchema = z.discriminatedUnion('field', [
  z.object({
    field: z.literal('description'),
    value: z.string().min(1, 'Descrição obrigatória').max(500),
  }),
  z.object({
    field: z.literal('amount'),
    value: z.coerce.number().positive('Valor deve ser positivo'),
  }),
  z.object({
    field: z.literal('dueDate'),
    value: z.coerce.date(),
  }),
  z.object({
    field: z.literal('categoryId'),
    // Pode ser CUID da categoria existente OU "__create__:NomeNovo" pra criar
    value: z.union([
      z.string().cuid(),
      z.string().regex(/^__create__:.{1,80}$/, 'Sentinel inválido'),
      z.null(),
    ]),
  }),
])

export type InlineEditInput = z.infer<typeof inlineEditSchema>

/** Helper pra detectar sentinel de criação. */
export function isCreateCategorySentinel(
  value: string | null,
): value is string {
  return typeof value === 'string' && value.startsWith('__create__:')
}

/** Extrai nome da categoria do sentinel "__create__:Nome". */
export function extractCategoryName(sentinel: string): string {
  return sentinel.replace(/^__create__:/, '').trim()
}
