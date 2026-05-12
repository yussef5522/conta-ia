import { z } from 'zod'

export const TIPOS_CONTA = ['CHECKING', 'SAVINGS', 'INVESTMENT'] as const
export type TipoConta = (typeof TIPOS_CONTA)[number]

export const contaBancariaSchema = z.object({
  name: z
    .string({ required_error: 'Nome da conta é obrigatório' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100),
  bankName: z.string().max(100).optional().or(z.literal('')),
  bankCode: z.string().max(10).optional().or(z.literal('')),
  agency: z.string().max(20).optional().or(z.literal('')),
  accountNumber: z.string().max(30).optional().or(z.literal('')),
  accountType: z.enum(TIPOS_CONTA, { required_error: 'Tipo de conta é obrigatório' }),
  balance: z.coerce.number({ invalid_type_error: 'Saldo deve ser um número' }).default(0),
  // Cheque especial (Sprint 0.5 Dia 4)
  allowNegativeBalance: z.coerce.boolean().optional().default(true),
  creditLimit: z.coerce
    .number({ invalid_type_error: 'Limite deve ser um número' })
    .min(0, 'Limite deve ser >= 0')
    .optional()
    .default(0),
  lowBalanceThreshold: z.coerce
    .number({ invalid_type_error: 'Alerta deve ser um número' })
    .min(0, 'Alerta deve ser >= 0')
    .optional()
    .nullable(),
})

export type ContaBancariaInput = z.infer<typeof contaBancariaSchema>
