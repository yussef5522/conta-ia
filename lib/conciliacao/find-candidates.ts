// Sprint 4.0.2 + Sprint A (03/06/2026) — busca candidatos compatíveis com uma tx OFX.
//
// Filtros aplicados via SQL (pré-filtragem barata) — o ranking fino fica pra
// scoreMatch em memória.
//
// Janela:
//   - ±15 dias entre OFX.date e a "data alvo" do candidato
//   - Valor candidate dentro ±20% do OFX.amount
//   - Mesma empresa (multi-tenant via bankAccount/supplier/customer/category OR)
//
// Universo de candidatos (RAMOS):
//   RAMO 1 — clássico (Sprint 4.0.2):
//     lifecycle ∈ {PAYABLE, RECEIVABLE} + status='PENDING' + reconciledWithId=NULL
//     Data alvo = dueDate
//
//   RAMO 2 — Sprint A (HOTFIX órfãos):
//     lifecycle='EFFECTED' + origin IN {IMPORT_EXCEL, MANUAL} + reconciledWithId=NULL
//     Direção compatível com OFX (DEBIT↔DEBIT pra PAYABLE, CREDIT↔CREDIT pra RECEIVABLE)
//     Data alvo = paymentDate || dueDate || date
//   ↪ Razão: hotfix lifecycle de 28/05 + import Excel com isPaid=true geraram
//     contas pagas como EFFECTED direto, sem link OFX. Antes da Sprint A o
//     matcher procurava só PAYABLE → tela "Candidatos vazios" em todos os casos.
//   ↪ NUNCA inclui OFX no ramo 2 (não faz sentido conciliar OFX-vs-OFX).

import { prisma } from '@/lib/db'
import type { MatchCandidate, OFXTransaction } from './match'

const WINDOW_DAYS = 15
const AMOUNT_TOLERANCE = 0.20

type CandidateRow = {
  id: string
  lifecycle: string
  description: string
  amount: number
  dueDate: Date | null
  paymentDate: Date | null
  date: Date
  supplierId: string | null
  customerId: string | null
  categoryId: string | null
}

export function resolveTargetDate(row: CandidateRow): Date {
  // Pra PAYABLE/RECEIVABLE: dueDate é a verdade (vencimento).
  // Pra EFFECTED órfão: paymentDate (quando foi pago) é o melhor sinal;
  // fallback pra dueDate (se Excel preencheu) ou date contábil.
  return row.dueDate ?? row.paymentDate ?? row.date
}

export async function findReconciliationCandidates(
  ofx: OFXTransaction,
  companyId: string,
): Promise<MatchCandidate[]> {
  const targetLifecycle = ofx.type === 'DEBIT' ? 'PAYABLE' : 'RECEIVABLE'
  const orphanType = ofx.type // EFFECTED órfão: mesma direção do OFX

  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000
  const minDate = new Date(ofx.date.getTime() - windowMs)
  const maxDate = new Date(ofx.date.getTime() + windowMs)

  const minAmount = ofx.amount * (1 - AMOUNT_TOLERANCE)
  const maxAmount = ofx.amount * (1 + AMOUNT_TOLERANCE)

  // Multi-tenant: candidato precisa pertencer à empresa via 1 das 4 relações.
  const companyScope = {
    OR: [
      { bankAccount: { companyId } },
      { supplier: { companyId } },
      { customer: { companyId } },
      { category: { companyId } },
    ],
  }

  const candidates = await prisma.transaction.findMany({
    where: {
      reconciledWithId: null,
      amount: { gte: minAmount, lte: maxAmount },
      AND: [
        companyScope,
        {
          OR: [
            // RAMO 1 — clássico PAYABLE/RECEIVABLE pendente
            {
              lifecycle: targetLifecycle,
              status: 'PENDING',
              dueDate: { gte: minDate, lte: maxDate },
            },
            // RAMO 2 — EFFECTED órfão (Sprint A)
            {
              lifecycle: 'EFFECTED',
              origin: { in: ['IMPORT_EXCEL', 'MANUAL'] },
              type: orphanType,
              OR: [
                // a) paymentDate na janela (Excel/Manual com pagamento registrado)
                { paymentDate: { gte: minDate, lte: maxDate } },
                // b) sem paymentDate, fallback dueDate na janela
                {
                  paymentDate: null,
                  dueDate: { gte: minDate, lte: maxDate },
                },
                // c) sem nada → date contábil
                {
                  paymentDate: null,
                  dueDate: null,
                  date: { gte: minDate, lte: maxDate },
                },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      lifecycle: true,
      description: true,
      amount: true,
      dueDate: true,
      paymentDate: true,
      date: true,
      supplierId: true,
      customerId: true,
      categoryId: true,
    },
    take: 50,
  })

  return candidates.map((c) => ({
    id: c.id,
    // EFFECTED órfão entra no algoritmo como se fosse PAYABLE/RECEIVABLE pra
    // efeito de scoring de direção. O scorer só precisa saber a direção esperada.
    lifecycle:
      c.lifecycle === 'EFFECTED'
        ? targetLifecycle
        : (c.lifecycle as 'PAYABLE' | 'RECEIVABLE'),
    description: c.description,
    amount: c.amount,
    dueDate: resolveTargetDate(c as CandidateRow),
    supplierId: c.supplierId,
    customerId: c.customerId,
    categoryId: c.categoryId,
  }))
}
