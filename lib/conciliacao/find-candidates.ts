// Sprint 4.0.2 — busca candidatos PAYABLE/RECEIVABLE compatíveis com uma tx OFX.
//
// Filtros aplicados via SQL (pré-filtragem barata) — o ranking fino fica pra
// scoreMatch em memória.
//
// Janela:
//   - ±15 dias entre OFX.date e candidate.dueDate (cobre boletos antecipados/atrasados)
//   - Valor candidate dentro ±20% do OFX.amount (passa pelo filtro de 5% no score depois)
//   - Mesma empresa (multi-tenant via bankAccount/supplier/customer/category OR)
//   - lifecycle PAYABLE ou RECEIVABLE (já filtrado por compatibilidade de direção)
//   - status='PENDING' (RECONCILED já tá conciliada; IGNORED não conta)
//   - reconciledWithId IS NULL (não está conciliada com outra OFX)

import { prisma } from '@/lib/db'
import type { MatchCandidate, OFXTransaction } from './match'

const WINDOW_DAYS = 15
const AMOUNT_TOLERANCE = 0.20

export async function findReconciliationCandidates(
  ofx: OFXTransaction,
  companyId: string,
): Promise<MatchCandidate[]> {
  const targetLifecycle = ofx.type === 'DEBIT' ? 'PAYABLE' : 'RECEIVABLE'

  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000
  const minDate = new Date(ofx.date.getTime() - windowMs)
  const maxDate = new Date(ofx.date.getTime() + windowMs)

  const minAmount = ofx.amount * (1 - AMOUNT_TOLERANCE)
  const maxAmount = ofx.amount * (1 + AMOUNT_TOLERANCE)

  const candidates = await prisma.transaction.findMany({
    where: {
      lifecycle: targetLifecycle,
      status: 'PENDING',
      reconciledWithId: null,
      dueDate: { gte: minDate, lte: maxDate },
      amount: { gte: minAmount, lte: maxAmount },
      OR: [
        { bankAccount: { companyId } },
        { supplier: { companyId } },
        { customer: { companyId } },
        { category: { companyId } },
      ],
    },
    select: {
      id: true,
      lifecycle: true,
      description: true,
      amount: true,
      dueDate: true,
      supplierId: true,
      customerId: true,
      categoryId: true,
    },
    take: 50,
  })

  return candidates
    .filter((c): c is typeof c & { dueDate: Date } => c.dueDate !== null)
    .map((c) => ({
      id: c.id,
      lifecycle: c.lifecycle as 'PAYABLE' | 'RECEIVABLE',
      description: c.description,
      amount: c.amount,
      dueDate: c.dueDate,
      supplierId: c.supplierId,
      customerId: c.customerId,
      categoryId: c.categoryId,
    }))
}
