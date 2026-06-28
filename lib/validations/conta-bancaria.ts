import { z } from 'zod'

// CASH = Conta Caixa (Sprint Caixa). INVESTMENT legacy ainda aceito.
export const TIPOS_CONTA = ['CHECKING', 'SAVINGS', 'INVESTMENT', 'CASH'] as const
export type TipoConta = (typeof TIPOS_CONTA)[number]

export const TIPOS_CASH_KIND = ['MAIN', 'PETTY', 'PDV_TERMINAL'] as const
export type TipoCashKind = (typeof TIPOS_CASH_KIND)[number]

// Sprint Account Kind PJ/PF (27/06/2026) — PJ = empresa / PF = pessoal do dono.
// Decisão de pareamento (transferência vs aporte/retirada) é pela accountKind
// dos 2 lados, nunca pelo nome do banco.
export const ACCOUNT_KINDS = ['PJ', 'PF'] as const
export type AccountKindEnum = (typeof ACCOUNT_KINDS)[number]

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
  // Sprint Caixa — subtipo do Caixa
  cashKind: z.enum(TIPOS_CASH_KIND).optional().nullable(),
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
  // Sprint Account Kind PJ/PF (27/06/2026)
  accountKind: z.enum(ACCOUNT_KINDS).optional().default('PJ'),
})

export type ContaBancariaInput = z.infer<typeof contaBancariaSchema>
