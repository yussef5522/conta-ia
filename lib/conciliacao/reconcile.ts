// Sprint 4.0.2 — orquestrador atomic de conciliação OFX ↔ PAYABLE/RECEIVABLE.
//
// Estratégia LINK (não MERGE — decisão Sprint 4.0.1.a):
//   1. PAYABLE.lifecycle = EFFECTED (vira realizado)
//   2. PAYABLE.paymentDate = OFX.date (data real do caixa)
//   3. PAYABLE.bankAccountId = OFX.bankAccountId (herda a conta efetiva)
//   4. PAYABLE.reconciledWithId = OFX.id (link)
//   5. OFX permanece (preserva FITID, dedupHash, importId pra auditoria fiscal)
//
// Anti-dup no DRE caixa: filtra `lifecycle='EFFECTED' AND reconciledWithId IS NULL`.
// A PAYABLE conciliada aponta pra OFX → ela é "ignorada"; OFX é a fonte do valor real.
// (Adicionado em lib/cashflow/query.ts + DRE route — ver tarefa #155.)

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/rbac'

export class ReconciliationError extends Error {
  constructor(public readonly reason: string, public readonly status: number = 422) {
    super(reason)
    this.name = 'ReconciliationError'
  }
}

export interface ReconcileInput {
  ofxTransactionId: string
  candidateId: string
  // Quando true (default false), pula validação de canTransition pra usar em backfills
  force?: boolean
}

export async function reconcileTransactions(
  input: ReconcileInput,
  ctx: AuthContext,
) {
  // Carrega ambas com relations pra validar
  const [ofx, candidate] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: input.ofxTransactionId },
      include: { bankAccount: { select: { companyId: true } } },
    }),
    prisma.transaction.findUnique({
      where: { id: input.candidateId },
      include: {
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    }),
  ])

  if (!ofx) throw new ReconciliationError('Transação OFX não encontrada', 404)
  if (!candidate) throw new ReconciliationError('Conta pendente não encontrada', 404)

  // OFX precisa ser EFFECTED + ter bankAccount real
  if (ofx.lifecycle !== 'EFFECTED' || !ofx.bankAccountId) {
    throw new ReconciliationError('Transação OFX inválida (precisa lifecycle=EFFECTED)')
  }
  if (ofx.reconciledWithId) {
    throw new ReconciliationError('Transação OFX já está conciliada')
  }

  // Candidato precisa ser PAYABLE/RECEIVABLE
  if (candidate.lifecycle !== 'PAYABLE' && candidate.lifecycle !== 'RECEIVABLE') {
    throw new ReconciliationError(
      `Candidato inválido — lifecycle ${candidate.lifecycle} (esperado PAYABLE/RECEIVABLE)`,
    )
  }
  if (candidate.reconciledWithId) {
    throw new ReconciliationError('Candidato já está conciliado com outra OFX')
  }

  // Coerência direção
  if (ofx.type === 'DEBIT' && candidate.lifecycle !== 'PAYABLE') {
    throw new ReconciliationError('OFX DEBIT só concilia com PAYABLE')
  }
  if (ofx.type === 'CREDIT' && candidate.lifecycle !== 'RECEIVABLE') {
    throw new ReconciliationError('OFX CREDIT só concilia com RECEIVABLE')
  }

  // Multi-tenant: ambas têm que estar na mesma empresa
  const ofxCompanyId = ofx.bankAccount!.companyId
  const candidateCompanyId =
    candidate.bankAccount?.companyId ??
    candidate.supplier?.companyId ??
    candidate.customer?.companyId ??
    candidate.category?.companyId
  if (!candidateCompanyId || candidateCompanyId !== ofxCompanyId) {
    throw new ReconciliationError('OFX e candidato pertencem a empresas diferentes')
  }
  if (ctx.company?.id !== ofxCompanyId) {
    throw new ReconciliationError('Contexto de autenticação não corresponde à empresa')
  }
  ctx.requirePermission('transaction.update')

  // Operação atomic
  const updated = await prisma.$transaction(async (trx) => {
    // PAYABLE/RECEIVABLE vira EFFECTED com link
    const candidateUpdated = await trx.transaction.update({
      where: { id: candidate.id },
      data: {
        lifecycle: 'EFFECTED',
        paymentDate: ofx.date,
        date: ofx.date,
        bankAccountId: ofx.bankAccountId,
        reconciledWithId: ofx.id,
        status: 'RECONCILED',
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        bankAccount: { select: { id: true, name: true, bankName: true } },
      },
    })

    // NÃO mexemos no balance — a OFX já atualizou quando foi criada.
    // NÃO atualizamos OFX.reconciledWithId (relação é unidirecional do candidato pra OFX,
    // pra usar a constraint UNIQUE que existe no candidato apenas).

    await logAudit(
      ctx,
      {
        action: 'UPDATE',
        entityType: 'Reconciliation',
        entityId: candidate.id,
        fieldsChanged: {
          lifecycle: { before: candidate.lifecycle, after: 'EFFECTED' },
          paymentDate: { before: null, after: ofx.date.toISOString() },
          bankAccountId: { before: candidate.bankAccountId, after: ofx.bankAccountId },
          reconciledWithId: { before: null, after: ofx.id },
        },
        metadata: {
          ofxTransactionId: ofx.id,
          ofxDescription: ofx.description,
          ofxAmount: ofx.amount,
          candidateDescription: candidate.description,
          candidateAmount: candidate.amount,
        },
      },
      trx,
    )

    return candidateUpdated
  })

  return { candidate: updated, ofx }
}

export async function undoReconciliation(
  candidateId: string,
  ctx: AuthContext,
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: candidateId },
    include: {
      bankAccount: { select: { companyId: true } },
      supplier: { select: { companyId: true } },
      customer: { select: { companyId: true } },
      category: { select: { companyId: true } },
    },
  })

  if (!tx) throw new ReconciliationError('Transação não encontrada', 404)
  if (!tx.reconciledWithId) {
    throw new ReconciliationError('Transação não está conciliada')
  }
  // Só desfaz se ela ERA PAYABLE/RECEIVABLE (preservado em metadata do audit).
  // Por simplicidade aqui: assume que toda tx com reconciledWithId+lifecycle=EFFECTED
  // era pendente antes. Pra detectar a lifecycle original, lemos do audit log.
  const lastAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Reconciliation', entityId: candidateId, action: 'UPDATE' },
    orderBy: { timestamp: 'desc' },
  })
  if (!lastAudit) {
    throw new ReconciliationError(
      'Não foi possível desfazer (audit log da conciliação não encontrado)',
    )
  }

  // Resolve companyId via fallbacks (mesmo padrão de reconcileTransactions)
  const companyId =
    tx.bankAccount?.companyId ??
    tx.supplier?.companyId ??
    tx.customer?.companyId ??
    tx.category?.companyId
  if (!companyId) throw new ReconciliationError('Empresa não resolvida', 422)

  if (ctx.company?.id !== companyId) {
    throw new ReconciliationError('Contexto de autenticação não corresponde à empresa')
  }
  ctx.requirePermission('transaction.update')

  // Extrai lifecycle original do fieldsChanged (gravado como JSON string)
  let fieldsChanged: Record<string, { before: unknown; after: unknown }> = {}
  if (typeof lastAudit.fieldsChanged === 'string' && lastAudit.fieldsChanged) {
    try {
      fieldsChanged = JSON.parse(lastAudit.fieldsChanged)
    } catch {
      fieldsChanged = {}
    }
  }
  const originalLifecycle = fieldsChanged.lifecycle?.before as
    | 'PAYABLE'
    | 'RECEIVABLE'
    | undefined
  if (originalLifecycle !== 'PAYABLE' && originalLifecycle !== 'RECEIVABLE') {
    throw new ReconciliationError('Lifecycle original inválido no audit')
  }

  const reverted = await prisma.$transaction(async (trx) => {
    const updated = await trx.transaction.update({
      where: { id: candidateId },
      data: {
        lifecycle: originalLifecycle,
        paymentDate: null,
        bankAccountId: null,
        reconciledWithId: null,
        status: 'PENDING',
      },
    })

    await logAudit(
      ctx,
      {
        action: 'UPDATE',
        entityType: 'Reconciliation',
        entityId: candidateId,
        metadata: { undone: true, restoredLifecycle: originalLifecycle },
      },
      trx,
    )

    return updated
  })

  return reverted
}
