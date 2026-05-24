// Sprint 4.0.1.b — validações Zod pra recorrentes.

import { z } from 'zod'

export const FREQUENCIES = ['MONTHLY', 'WEEKLY', 'QUARTERLY', 'YEARLY'] as const
export const RECURRENCE_TYPES = ['PAYABLE', 'RECEIVABLE'] as const

export const recurringScheduleCreateSchema = z
  .object({
    companyId: z.string().cuid(),
    description: z.string().min(1).max(255),
    amount: z.coerce.number().positive(),
    type: z.enum(RECURRENCE_TYPES),
    frequency: z.enum(FREQUENCIES),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    supplierId: z.string().cuid().optional().nullable(),
    customerId: z.string().cuid().optional().nullable(),
    categoryId: z.string().cuid().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.frequency === 'WEEKLY' && (data.dayOfWeek === null || data.dayOfWeek === undefined)) {
        return false
      }
      if (
        ['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(data.frequency) &&
        (data.dayOfMonth === null || data.dayOfMonth === undefined)
      ) {
        return false
      }
      return true
    },
    {
      message:
        'WEEKLY requer dayOfWeek; MONTHLY/QUARTERLY/YEARLY requerem dayOfMonth',
    },
  )
  .refine(
    (data) => !data.endDate || data.endDate >= data.startDate,
    { message: 'endDate deve ser >= startDate' },
  )
  .refine(
    (data) => {
      if (data.type === 'PAYABLE' && data.customerId) return false
      if (data.type === 'RECEIVABLE' && data.supplierId) return false
      return true
    },
    { message: 'PAYABLE usa supplierId; RECEIVABLE usa customerId' },
  )

export type RecurringScheduleCreateInput = z.infer<typeof recurringScheduleCreateSchema>

export const recurringScheduleUpdateSchema = z.object({
  description: z.string().min(1).max(255).optional(),
  amount: z.coerce.number().positive().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  active: z.boolean().optional(),
  supplierId: z.string().cuid().optional().nullable(),
  customerId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export type RecurringScheduleUpdateInput = z.infer<typeof recurringScheduleUpdateSchema>
