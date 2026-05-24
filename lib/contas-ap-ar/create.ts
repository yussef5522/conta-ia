// Sprint 4.0.1.a — orquestrador de criação de PAYABLE/RECEIVABLE.
//
// Cria Transaction com lifecycle=PAYABLE ou RECEIVABLE.
// NÃO atualiza balance (lançamento pendente não afeta caixa).
// NÃO chama auto-categorizer ainda (Sprint 4.0.2 — quando wizard pós-OFX rodar).

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'
import {
  validateLifecycleState,
  defaultTypeFromLifecycle,
  type Lifecycle,
} from '@/lib/lifecycle'

export interface CreateContaInput {
  companyId: string
  lifecycle: Extract<Lifecycle, 'PAYABLE' | 'RECEIVABLE'>
  description: string
  amount: number
  dueDate: Date
  bankAccountId?: string | null
  categoryId?: string | null
  supplierId?: string | null
  customerId?: string | null
  competenceDate?: Date | null
  notes?: string | null
}

export class ContaCreateError extends Error {
  constructor(public readonly reason: string, public readonly status: number = 422) {
    super(reason)
    this.name = 'ContaCreateError'
  }
}

export async function createContaPendente(
  input: CreateContaInput,
  ctx: AuthContext,
) {
  // 1. Validações de lifecycle
  const validation = validateLifecycleState({
    lifecycle: input.lifecycle,
    status: 'PENDING',
    paymentDate: null,
    dueDate: input.dueDate,
    bankAccountId: input.bankAccountId ?? null,
  })
  if (!validation.valid) {
    throw new ContaCreateError(validation.error ?? 'lifecycle inválido')
  }

  // 2. Se bankAccountId informado, valida pertence à empresa
  if (input.bankAccountId) {
    const bank = await prisma.bankAccount.findFirst({
      where: { id: input.bankAccountId, companyId: input.companyId },
      select: { id: true },
    })
    if (!bank) {
      throw new ContaCreateError(
        'Conta bancária não pertence à empresa',
        404,
      )
    }
  }

  // 3. Cross-check: PAYABLE não aceita customerId, RECEIVABLE não aceita supplierId
  if (input.lifecycle === 'PAYABLE' && input.customerId) {
    throw new ContaCreateError('PAYABLE usa supplierId (fornecedor), não customerId')
  }
  if (input.lifecycle === 'RECEIVABLE' && input.supplierId) {
    throw new ContaCreateError('RECEIVABLE usa customerId (cliente), não supplierId')
  }

  // 4. Cria Transaction
  const type = defaultTypeFromLifecycle(input.lifecycle)
  if (!type) {
    throw new ContaCreateError('lifecycle não mapeia para CREDIT/DEBIT')
  }

  const transaction = await prisma.transaction.create({
    data: {
      // Lifecycle e datas
      lifecycle: input.lifecycle,
      dueDate: input.dueDate,
      // `date` espelha dueDate enquanto pendente; será reescrito na efetivação
      // pra refletir a data real do caixa
      date: input.dueDate,
      competenceDate: input.competenceDate ?? input.dueDate,
      paymentDate: null,
      // Conteúdo
      description: input.description,
      amount: input.amount,
      type,
      // Estados
      status: 'PENDING',
      origin: 'MANUAL',
      // FKs
      bankAccountId: input.bankAccountId ?? null,
      categoryId: input.categoryId ?? null,
      supplierId: input.supplierId ?? null,
      customerId: input.customerId ?? null,
      notes: input.notes ?? null,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      supplier: { select: { id: true, razaoSocial: true } },
      customer: { select: { id: true, razaoSocial: true } },
      bankAccount: { select: { id: true, name: true, bankName: true } },
    },
  })

  // 5. Audit
  await logAudit(ctx, {
    action: 'CREATE',
    entityType: input.lifecycle === 'PAYABLE' ? 'AccountPayable' : 'AccountReceivable',
    entityId: transaction.id,
    metadata: {
      description: transaction.description,
      amount: transaction.amount,
      dueDate: transaction.dueDate?.toISOString() ?? null,
      lifecycle: transaction.lifecycle,
    },
  })

  return transaction
}
