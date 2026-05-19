// Schemas Zod compartilhados entre os 7 endpoints admin de cupons — Sprint 1.7.

import { z } from 'zod'
import { COUPON_CODE_REGEX } from './types'

// Comum: code (uppercase, alphanumérico, 4-20 chars)
const codeSchema = z
  .string()
  .min(4, 'Código deve ter 4-20 caracteres')
  .max(20, 'Código deve ter 4-20 caracteres')
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => COUPON_CODE_REGEX.test(s), {
    message: 'Use apenas letras maiúsculas e números (sem espaços/símbolos).',
  })

// type + value cross-validation (FREE_MONTHS exige freeMonths, etc)
export const createCouponSchema = z
  .object({
    code: codeSchema,
    description: z.string().max(500, 'Máx 500 chars').optional().nullable(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_MONTHS']),
    // value: número >= 0. Pra PERCENTAGE precisa ser <= 100.
    value: z.coerce.number().min(0, 'Valor não pode ser negativo'),
    freeMonths: z.coerce.number().int().positive().max(120).optional().nullable(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional().nullable(),
    maxUses: z.coerce.number().int().positive().optional().nullable(),
    maxUsesPerUser: z.coerce.number().int().positive().default(1),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Porcentagem não pode passar de 100%.',
      })
    }
    if (data.type === 'FREE_MONTHS') {
      if (!data.freeMonths || data.freeMonths <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['freeMonths'],
          message: 'Para "meses grátis", informe a quantidade de meses.',
        })
      }
    }
    if (data.validFrom && data.validUntil && data.validUntil <= data.validFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: 'Data final deve ser depois da data inicial.',
      })
    }
  })

export type CreateCouponInput = z.infer<typeof createCouponSchema>

// Update: code é IMUTÁVEL (regra de auditoria — snapshot preservado).
// Permite ajustar description, datas, limites, status (via PATCH).
export const updateCouponSchema = z
  .object({
    description: z.string().max(500).optional().nullable(),
    validUntil: z.coerce.date().optional().nullable(),
    maxUses: z.coerce.number().int().positive().optional().nullable(),
    maxUsesPerUser: z.coerce.number().int().positive().optional(),
  })
  .strict()

export type UpdateCouponInput = z.infer<typeof updateCouponSchema>

// Listing query params
export const listCouponsQuerySchema = z.object({
  q: z.string().trim().toUpperCase().optional(),
  status: z
    .enum(['ACTIVE', 'PAUSED', 'EXPIRED', 'EXHAUSTED', 'DEACTIVATED', 'ALL'])
    .default('ALL'),
  type: z
    .enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_MONTHS', 'ALL'])
    .default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>

// Validate público — só code
export const validatePublicSchema = z.object({
  code: codeSchema,
})

export type ValidatePublicInput = z.infer<typeof validatePublicSchema>
