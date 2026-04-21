import { z } from 'zod'

export const TIPOS_TRANSACAO = ['CREDIT', 'DEBIT'] as const
export const STATUS_TRANSACAO = ['PENDING', 'RECONCILED', 'IGNORED'] as const

export const transacaoSchema = z.object({
  bankAccountId: z.string().cuid(),
  categoryId: z.string().cuid().optional().nullable(),
  date: z.coerce.date(),
  description: z.string().min(1, 'Descrição obrigatória').max(255),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  type: z.enum(TIPOS_TRANSACAO),
  status: z.enum(STATUS_TRANSACAO).default('PENDING'),
  notes: z.string().max(1000).optional().nullable(),
})

export const transacaoUpdateSchema = transacaoSchema.partial().omit({ bankAccountId: true })

export type TransacaoInput = z.infer<typeof transacaoSchema>
