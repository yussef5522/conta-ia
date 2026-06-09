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
  /** Sprint Fix-Caixa-Vinculo (08/06/2026): se preenchido, "lança já paga":
   *  cria EFFECTED em vez de PAYABLE + atualiza balance da conta. Exige
   *  bankAccountId. Se ausente, comportamento clássico: PAYABLE futura
   *  SEM vínculo de conta (bankAccountId zerado pra não criar estado órfão). */
  paymentDate?: Date | null
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
  // Sprint Fix-Caixa-Vinculo (08/06/2026): se o user informou paymentDate +
  // bankAccountId no form, "lança já paga" → cria EFFECTED + atualiza balance.
  // Senão, força bankAccountId=null pra não criar estado órfão (PAYABLE
  // grudada numa conta sem ter sido paga — sintoma da Sprint Bug Caixa).
  const lancaJaPaga = input.paymentDate != null && input.bankAccountId != null
  const lifecycleEfetivo = lancaJaPaga ? 'EFFECTED' : input.lifecycle
  const bankAccountIdEfetivo = lancaJaPaga ? input.bankAccountId : null
  const paymentDateEfetivo = lancaJaPaga ? input.paymentDate : null
  const statusEfetivo = lancaJaPaga ? 'RECONCILED' : 'PENDING'

  // 1. Validações de lifecycle (sob estado final)
  const validation = validateLifecycleState({
    lifecycle: lifecycleEfetivo,
    status: statusEfetivo,
    paymentDate: paymentDateEfetivo,
    dueDate: input.dueDate,
    bankAccountId: bankAccountIdEfetivo,
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

  // 4. Cria Transaction (+ atualiza balance atomic se lança-já-paga)
  const type = defaultTypeFromLifecycle(input.lifecycle)
  if (!type) {
    throw new ContaCreateError('lifecycle não mapeia para CREDIT/DEBIT')
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        // Lifecycle e datas
        lifecycle: lifecycleEfetivo,
        dueDate: input.dueDate,
        // `date` reflete pagamento real se já paga; senão dueDate
        date: paymentDateEfetivo ?? input.dueDate,
        competenceDate: input.competenceDate ?? input.dueDate,
        paymentDate: paymentDateEfetivo,
        // Conteúdo
        description: input.description,
        amount: input.amount,
        type,
        // Estados
        status: statusEfetivo,
        origin: 'MANUAL',
        // FKs — bankAccountId só preenchido se lança-já-paga
        bankAccountId: bankAccountIdEfetivo,
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

    // Sprint Fix-Caixa-Vinculo: se lançada já paga, atualiza balance
    if (lancaJaPaga && bankAccountIdEfetivo) {
      const delta = type === 'CREDIT' ? input.amount : -input.amount
      await tx.bankAccount.update({
        where: { id: bankAccountIdEfetivo },
        data: { balance: { increment: delta } },
      })
    }
    return created
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
