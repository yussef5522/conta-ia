// Validação Zod dos query params do endpoint GET /dre.

import { z } from 'zod'

export const dreQuerySchema = z
  .object({
    // Período obrigatório (ISO 8601)
    startDate: z.string().datetime({ message: 'startDate inválido (ISO 8601)' }),
    endDate: z.string().datetime({ message: 'endDate inválido (ISO 8601)' }),

    // Regime contábil. Yussef 11/06/2026: default mudou pra cash (dia de pagamento).
    // Motivo: planilhas Excel chegam com competenceDate frequentemente errado
    // (compras pagas em jun com data de compra em mai/abr). Regime caixa usa
    // paymentDate (fallback pra `date`) que é a verdade financeira do extrato.
    regime: z.enum(['competence', 'cash']).default('cash'),

    // Tipo de comparação
    comparison: z
      .enum([
        'none',
        'previous_period',
        'same_period_last_year',
        'previous_year',
        'ytd_vs_ytd',
        'custom',
      ])
      .default('none'),

    // Pra comparison='custom' precisa desses dois
    comparisonStartDate: z.string().datetime().optional(),
    comparisonEndDate: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    // startDate <= endDate
    if (new Date(data.startDate).getTime() > new Date(data.endDate).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'endDate deve ser posterior ou igual a startDate',
      })
    }

    // Se comparison='custom', precisa das duas datas
    if (data.comparison === 'custom') {
      if (!data.comparisonStartDate || !data.comparisonEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['comparisonStartDate'],
          message:
            'comparisonStartDate e comparisonEndDate são obrigatórios quando comparison=custom',
        })
      } else if (
        new Date(data.comparisonStartDate).getTime() >
        new Date(data.comparisonEndDate).getTime()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['comparisonEndDate'],
          message: 'comparisonEndDate deve ser posterior ou igual a comparisonStartDate',
        })
      }
    }
  })

export type DREQueryParams = z.infer<typeof dreQuerySchema>
