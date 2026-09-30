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
  // Sprint Contraparte PIX (31/07/2026) — edição manual do favorecido/pagador.
  // Ao vir no PUT, a origem vira MANUAL (imune a sobrescrita por PDF/OFX).
  counterpartyName: z.string().max(200).optional().nullable(),
  // Sprint FASE 4 (01/08/2026) — quando true + categorizando uma tx com
  // contraparte, cria/atualiza a regra "contraparte → categoria" (por empresa).
  createCounterpartyRule: z.boolean().optional(),
})

/**
 * ⭐⭐ A CONTA VOLTOU PRO UPDATE (30/09/2026) — ela era `omit` desde sempre, e por isso a
 * tela de editar lançamento **não tinha como consertar conta errada**. Errar a conta no
 * seletor é rotina (a venda em dinheiro de R$ 2.112,00 de 17/09 foi lançada na stone em
 * vez do cofre), e a única saída era apagar e lançar de novo.
 *
 * ⛔ Aceitar o campo NÃO afrouxa nada: quem decide se a linha PODE se mover é
 * `podeMoverDeConta` (lib/transacoes/mover-de-conta.ts), no servidor — linha de extrato
 * nunca troca de conta. O schema só deixa de recusar a PERGUNTA.
 */
export const transacaoUpdateSchema = transacaoSchema.partial()

export type TransacaoInput = z.infer<typeof transacaoSchema>
