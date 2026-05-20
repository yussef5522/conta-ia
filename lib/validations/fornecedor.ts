// Schemas Zod pra fornecedores — Onda 2 Sprint 2.2.

import { z } from 'zod'
import { isValidCNPJ, unformatCNPJ } from '@/lib/fornecedores/format'

const cnpjSchema = z
  .string()
  .trim()
  .transform((v) => unformatCNPJ(v))
  .refine((v) => v === '' || isValidCNPJ(v), {
    message: 'CNPJ inválido (14 dígitos + verificadores).',
  })

export const createFornecedorSchema = z.object({
  razaoSocial: z.string().trim().min(2, 'Razão social muito curta').max(200),
  nomeFantasia: z.string().trim().max(200).optional().nullable(),
  cnpj: cnpjSchema.optional().nullable(),
  categoryId: z.string().cuid().nullable().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type CreateFornecedorInput = z.infer<typeof createFornecedorSchema>

export const updateFornecedorSchema = z
  .object({
    razaoSocial: z.string().trim().min(2).max(200).optional(),
    nomeFantasia: z.string().trim().max(200).optional().nullable(),
    cnpj: cnpjSchema.optional().nullable(),
    categoryId: z.string().cuid().nullable().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().max(1000).optional().nullable(),
    // Se true, propaga categoryId pras regras associadas a esse fornecedor
    aplicarEmRegras: z.boolean().optional(),
  })
  .strict()

export type UpdateFornecedorInput = z.infer<typeof updateFornecedorSchema>

export const listFornecedoresQuerySchema = z.object({
  q: z.string().trim().optional(),
  fonte: z
    .enum(['MANUAL', 'BRASILAPI', 'CLAUDE', 'KEYWORD', 'ALL'])
    .default('ALL'),
  categoryId: z.string().cuid().optional(),
  comCnpj: z.enum(['all', 'true', 'false']).default('all'),
  isActive: z.enum(['all', 'true', 'false']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

export type ListFornecedoresQuery = z.infer<typeof listFornecedoresQuerySchema>
