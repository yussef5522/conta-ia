// Sprint 5.0.1 — validações Zod do módulo tributário.

import { z } from 'zod'

export const taxProfileUpsertSchema = z.object({
  regime: z.enum(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL']),
  simplesAnexo: z
    .enum(['ANEXO_I', 'ANEXO_II', 'ANEXO_III', 'ANEXO_IV', 'ANEXO_V'])
    .nullable()
    .optional(),
  folha12m: z.coerce.number().min(0).max(999_999_999).default(0),
  proLabore: z.coerce.number().min(0).max(999_999_999).default(0),
  cnae: z.string().max(20).optional().nullable(),
  enabled: z.boolean().optional().default(true),
}).refine(
  (data) => {
    if (data.regime === 'SIMPLES_NACIONAL' && !data.simplesAnexo) return false
    return true
  },
  { message: 'simplesAnexo é obrigatório quando regime é SIMPLES_NACIONAL' },
)

export type TaxProfileUpsertInput = z.infer<typeof taxProfileUpsertSchema>

export const taxCalculateSchema = z.object({
  paYear: z.coerce.number().int().min(2020).max(2099),
  paMonth: z.coerce.number().int().min(1).max(12),
  receitaBrutaMes: z.coerce.number().min(0).max(999_999_999),
})

export type TaxCalculateInput = z.infer<typeof taxCalculateSchema>
