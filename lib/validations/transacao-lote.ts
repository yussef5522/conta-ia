import { z } from 'zod'

// Body do PATCH /api/transacoes/lote — atualização de categoria em massa.
// Limite de 500 por chamada pra evitar consultas absurdas; UI vai paginar
// muito antes disso (UI mostra batches de até 100).
export const transacaoLoteClassificacaoSchema = z.object({
  transactionIds: z
    .array(z.string().cuid('ID de transação inválido'))
    .min(1, 'Selecione ao menos uma transação')
    .max(500, 'Máximo 500 transações por requisição'),
  categoryId: z.string().cuid('ID de categoria inválido').nullable(),
})

export type TransacaoLoteClassificacaoInput = z.infer<typeof transacaoLoteClassificacaoSchema>

// Sprint 3.0.3 B2 — bulk update de status (Confirmar / Ignorar).
export const transacaoLoteStatusSchema = z.object({
  transactionIds: z
    .array(z.string().cuid('ID de transação inválido'))
    .min(1, 'Selecione ao menos uma transação')
    .max(500, 'Máximo 500 transações por requisição'),
  status: z.enum(['PENDING', 'RECONCILED', 'IGNORED']),
})

export type TransacaoLoteStatusInput = z.infer<typeof transacaoLoteStatusSchema>
