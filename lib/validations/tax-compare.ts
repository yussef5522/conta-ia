// Sprint 5.0.2 — Zod schema pra POST /tax-compare.

import { z } from 'zod'

const ATIVIDADES = [
  'COMERCIO',
  'INDUSTRIA',
  'SERVICOS',
  'SERVICOS_HOSPITALARES',
  'TRANSPORTE_CARGAS',
  'TRANSPORTE_PASSAGEIROS',
  'REVENDA_COMBUSTIVEIS',
  'CONSTRUCAO_CIVIL',
] as const

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

export const taxCompareSchema = z.object({
  receitaBrutaMes: z.coerce.number().min(0).max(999_999_999),
  // Anexo Simples opcional (se não informado, Simples vira "não aplicável")
  anexoSimples: z
    .enum(['ANEXO_I', 'ANEXO_II', 'ANEXO_III', 'ANEXO_IV', 'ANEXO_V'])
    .nullable()
    .optional(),
  atividade: z.enum(ATIVIDADES),
  margemRealPercent: z.coerce.number().min(0).max(100).default(15),
  estado: z.enum(UFS).nullable().optional(),
  hasICMS: z.boolean().default(false),
  hasISS: z.boolean().default(false),
  creditosPIS: z.coerce.number().min(0).optional(),
  creditosCOFINS: z.coerce.number().min(0).optional(),
  // Sprint 5.0.2.f
  comprasMes: z.coerce.number().min(0).optional(),
  cnaeCode: z.string().max(20).nullable().optional(),
  hasSocioPJ: z.boolean().optional(),
  hasDebitos: z.boolean().optional(),
})

export type TaxCompareInput = z.infer<typeof taxCompareSchema>

export const ATIVIDADE_LABELS: Record<(typeof ATIVIDADES)[number], string> = {
  COMERCIO: 'Comércio em geral',
  INDUSTRIA: 'Indústria',
  SERVICOS: 'Serviços em geral',
  SERVICOS_HOSPITALARES: 'Serviços hospitalares',
  TRANSPORTE_CARGAS: 'Transporte de cargas',
  TRANSPORTE_PASSAGEIROS: 'Transporte de passageiros',
  REVENDA_COMBUSTIVEIS: 'Revenda de combustíveis',
  CONSTRUCAO_CIVIL: 'Construção civil',
}
