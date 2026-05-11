// Validação de transferências entre contas da mesma empresa (Sprint 0.5 Dia 2).
// Camada 1 (Zod, pura): forma do input.
// Camada 2 (assertSameCompany): regra de negócio que precisa de DB.

import { z } from 'zod'

export const transferCreateSchema = z
  .object({
    fromAccountId: z.string().cuid('fromAccountId inválido'),
    toAccountId: z.string().cuid('toAccountId inválido'),
    amount: z.coerce.number().positive('Valor deve ser positivo'),
    date: z.coerce.date(),
    description: z.string().min(1).max(255).optional(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: 'Conta de origem e destino devem ser diferentes',
    path: ['toAccountId'],
  })

export type TransferInput = z.infer<typeof transferCreateSchema>

// Regra de negócio que exige fetch das contas: ambas devem pertencer à MESMA empresa.
// Lança Error com mensagem em pt-BR (handleApiError vira 500; rota deve traduzir pra 400).
export function assertSameCompany(
  fromAccount: { companyId: string } | null,
  toAccount: { companyId: string } | null,
): void {
  if (!fromAccount) {
    throw new TransferValidationError('Conta de origem não encontrada')
  }
  if (!toAccount) {
    throw new TransferValidationError('Conta de destino não encontrada')
  }
  if (fromAccount.companyId !== toAccount.companyId) {
    throw new TransferValidationError(
      'Transferência só é permitida entre contas da mesma empresa',
    )
  }
}

// Erro tipado pra a rota mapear pra 400 (em vez de 500 genérico).
export class TransferValidationError extends Error {
  status = 400
  constructor(message: string) {
    super(message)
    this.name = 'TransferValidationError'
  }
}
