// Schemas Zod pra endpoints de regras — Onda 2 Sprint 2.1.

import { z } from 'zod'

export const updateRegraSchema = z
  .object({
    padrao: z.string().trim().min(2, 'Padrão muito curto').max(500).optional(),
    tipoMatch: z.enum(['EXACT', 'CONTAINS', 'CNPJ', 'NORMALIZED']).optional(),
    categoryId: z.string().cuid().nullable().optional(),
    supplierId: z.string().cuid().nullable().optional(),
    confianca: z.coerce.number().min(0).max(1).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Forneça pelo menos um campo pra atualizar.',
  })

export type UpdateRegraInput = z.infer<typeof updateRegraSchema>

export const listRegrasQuerySchema = z.object({
  q: z.string().trim().optional(),
  tipoMatch: z.enum(['EXACT', 'CONTAINS', 'CNPJ', 'NORMALIZED', 'ALL']).default('ALL'),
  categoryId: z.string().cuid().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ALL']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

export type ListRegrasQuery = z.infer<typeof listRegrasQuerySchema>
