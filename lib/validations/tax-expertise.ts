// Sprint 5.0.2.b — Zod schema do POST /api/empresas/[id]/tax-expertise.

import { z } from 'zod'

export const taxExpertiseSchema = z.object({
  cnae: z.string().min(7).max(20),
  receitaMensal: z.number().min(0).max(50_000_000),
  hasDelivery: z.boolean().optional(),
  vendeBebidas: z.boolean().optional(),
})

export type TaxExpertiseInput = z.infer<typeof taxExpertiseSchema>
