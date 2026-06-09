// Sprint 4.0.1.a — Validações de Contas a Pagar/Receber + Customer.

import { z } from 'zod'

// Customer (cliente) — espelha fornecedor schema.
export const customerSchema = z.object({
  razaoSocial: z.string().min(1, 'Razão social obrigatória').max(200),
  nomeFantasia: z.string().max(200).optional().nullable(),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos numéricos')
    .optional()
    .nullable(),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos numéricos')
    .optional()
    .nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export type CustomerInput = z.infer<typeof customerSchema>

// Conta a pagar (PAYABLE).
//   - bankAccountId opcional (user pode não saber ainda qual conta usará)
//   - dueDate obrigatório (data esperada de pagamento)
//   - amount positivo
//   - supplier opcional, customer NÃO se aplica (use contaAReceber)
export const contaAPagarCreateSchema = z.object({
  companyId: z.string().cuid('companyId inválido'),
  description: z.string().min(1, 'Descrição obrigatória').max(255),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  dueDate: z.coerce.date(),
  bankAccountId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  supplierId: z.string().cuid().optional().nullable(),
  competenceDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // Sprint Fix-Caixa-Vinculo (08/06/2026): se informado + bankAccountId,
  // "lança já paga" — cria EFFECTED em vez de PAYABLE + atualiza saldo.
  paymentDate: z.coerce.date().optional().nullable(),
})

export type ContaAPagarCreateInput = z.infer<typeof contaAPagarCreateSchema>

// Sprint 5.0.3.0a-fix — PATCH conta a pagar pendente (ou já paga).
// Todos os campos são opcionais (partial update). paymentDate=null limpa pagamento.
export const contaAPagarUpdateSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória').max(255).optional(),
  amount: z.coerce.number().positive('Valor deve ser positivo').optional(),
  dueDate: z.coerce.date().optional(),
  paymentDate: z.coerce.date().nullable().optional(),
  categoryId: z.string().cuid().nullable().optional(),
  supplierId: z.string().cuid().nullable().optional(),
  employeeId: z.string().cuid().nullable().optional(),
  bankAccountId: z.string().cuid().nullable().optional(),
  competenceDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export type ContaAPagarUpdateInput = z.infer<typeof contaAPagarUpdateSchema>

// Conta a receber (RECEIVABLE). Mesmo shape, mas com customerId em vez de supplierId.
export const contaAReceberCreateSchema = z.object({
  companyId: z.string().cuid('companyId inválido'),
  description: z.string().min(1, 'Descrição obrigatória').max(255),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  dueDate: z.coerce.date(),
  bankAccountId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  customerId: z.string().cuid().optional().nullable(),
  competenceDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // Sprint Fix-Caixa-Vinculo (08/06/2026): se informado + bankAccountId,
  // "recebe já" — cria EFFECTED + atualiza saldo.
  paymentDate: z.coerce.date().optional().nullable(),
})

export type ContaAReceberCreateInput = z.infer<typeof contaAReceberCreateSchema>

// Efetivação manual (PATCH /api/transacoes/[id]/efetivar).
// Marca PAYABLE/RECEIVABLE como EFFECTED (sem conciliar com OFX).
export const efetivarSchema = z.object({
  paymentDate: z.coerce.date(),
  bankAccountId: z.string().cuid('bankAccountId obrigatório na efetivação'),
})

export type EfetivarInput = z.infer<typeof efetivarSchema>
