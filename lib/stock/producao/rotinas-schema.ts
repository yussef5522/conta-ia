// ⭐ o corpo da rotina nas rotas (Zod) — um schema, dois verbos (criar e editar)
import { z } from 'zod'
import { MAX_NOME_TAREFA } from './tarefa'

const dow = z.number().int().min(0).max(6)
export const schemaDaRotina = z.object({
  nome: z.string().min(1).max(MAX_NOME_TAREFA),
  regra: z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('diaria') }),
    z.object({ tipo: z.literal('dias'), dows: z.array(dow).min(1).max(7) }),
    z.object({ tipo: z.literal('semanal'), dow }),
    z.object({ tipo: z.literal('mensal'), dia: z.number().int().min(1).max(31) }),
  ]),
  ate: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  /** id da pessoa ou 'LIVRE' (R28) */
  quem: z.string().min(1),
  itens: z.array(z.string().max(200)).min(1).max(60),
})
