import { z } from 'zod'

// DRE Groups válidos (alinhado com lib/categories/templates/_common.ts).
export const DRE_GROUPS = [
  'RECEITA_BRUTA',
  'DEDUCOES',
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_PESSOAL',
  'RECEITAS_FINANCEIRAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_RECEITAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
  'DISTRIBUICAO_LUCROS',
  'INVESTIMENTOS',
  'TRANSFERENCIA',
] as const

export const CATEGORY_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const

const REGIMES_TRIBUTARIOS = [
  'SIMPLES_NACIONAL_I',
  'SIMPLES_NACIONAL_II',
  'SIMPLES_NACIONAL_III',
  'SIMPLES_NACIONAL_IV',
  'SIMPLES_NACIONAL_V',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'MEI',
] as const

// Hex color (com ou sem #) — aceita 3 ou 6 chars.
const hexColorRegex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const categoriaCreateSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(1, 'Nome não pode ser vazio')
    .max(80, 'Nome deve ter no máximo 80 caracteres')
    .trim(),
  type: z.enum(CATEGORY_TYPES, { required_error: 'Tipo é obrigatório' }),
  dreGroup: z.enum(DRE_GROUPS).optional().nullable(),
  parentId: z.string().cuid('ID de categoria pai inválido').optional().nullable(),
  code: z.string().max(20, 'Código contábil deve ter no máximo 20 caracteres').optional().nullable(),
  description: z
    .string()
    .max(200, 'Descrição deve ter no máximo 200 caracteres')
    .optional()
    .nullable(),
  color: z
    .string()
    .regex(hexColorRegex, 'Cor deve ser hex válido (ex: #10b981)')
    .optional(),
  icon: z.string().max(50).optional().nullable(),
  order: z.number().finite().optional(),
  visibleInRegimes: z.array(z.enum(REGIMES_TRIBUTARIOS)).optional().nullable(),
})

export const categoriaUpdateSchema = categoriaCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CategoriaCreateInput = z.infer<typeof categoriaCreateSchema>
export type CategoriaUpdateInput = z.infer<typeof categoriaUpdateSchema>
