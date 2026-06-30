// Sprint 4.0.2 + Sprint Conciliacao-Strict (30/06/2026) — busca candidatos
// compatíveis com uma tx OFX.
//
// Regra Yussef (= padrão QuickBooks/Xero): o lado direito da conciliação só
// mostra **Contas a Pagar/Receber EM ABERTO**. Nunca despesas já efetivadas,
// nunca tx de outras contas, nunca órfãs Excel.
//
// Histórico:
//   - Sprint 4.0.2: RAMO 1 — PAYABLE/RECEIVABLE pendente (correto).
//   - Sprint A (03/06): adicionou RAMO 2 (EFFECTED órfão MANUAL/IMPORT_EXCEL)
//     pra resolver "tela Candidatos vazios" após hotfix lifecycle. **REMOVIDO
//     em 30/06** — resolvia sintoma errado, criava 151 candidatos errados na
//     Cacula (despesas em dinheiro caixa loja, transferências, órfãs Excel).
//   - 30/06: RAMO 1 estrito — paymentDate IS NULL + type=ofx.type + bankAccountId
//     na mesma conta (ou null pra PAYABLE sem banco) + multi-tenant via 4 OR.
//
// Mexer aqui NÃO afeta os outros 2 fluxos de pareamento:
//   - Pareamento de transferência entre bancos: lib/transfers/scan-retroativo.ts
//     (query própria, intocada)
//   - Casamento de parcela de empréstimo: lib/loans/auto-conciliacao.ts
//     (query própria, intocada)

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
  // PAYABLE/RECEIVABLE em aberto: dueDate é a verdade (vencimento).
  // Fallbacks defensivos (não devem acontecer em estado normal):
  //   paymentDate (não deveria — em aberto = paymentDate null)
  //   date (último recurso)
  return row.dueDate ?? row.paymentDate ?? row.date
}

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

  // Multi-tenant: candidato precisa pertencer à empresa via 1 das 4 relações.
  // PAYABLE/RECEIVABLE em aberto frequentemente NÃO tem bankAccount preenchido
  // (foi criada via /contas-a-pagar sem escolher banco) — daí entra pelo
  // supplier/customer/category.
  const companyScope = {
    OR: [
      { bankAccount: { companyId } },
      { supplier: { companyId } },
      { customer: { companyId } },
      { category: { companyId } },
    ],
  }

  // Filtro CONTA: aceita PAYABLE sem banco (será setado ao conciliar) OU da
  // MESMA conta do extrato. Bloqueia PAYABLE de outra conta — sem isso o
  // sistema oferecia conta a pagar do Banrisul como candidato pro extrato
  // da Stone, criando casamentos errados.
  const sameAccountOrNull = {
    OR: [
      { bankAccountId: null },
      ...(ofx.bankAccountId ? [{ bankAccountId: ofx.bankAccountId }] : []),
    ],
  }

  const candidates = await prisma.transaction.findMany({
    where: {
      // RAMO 1 ESTRITO — só Conta a Pagar/Receber EM ABERTO.
      lifecycle: targetLifecycle,
      status: 'PENDING',
      type: ofx.type, // direção: DEBIT↔PAYABLE; CREDIT↔RECEIVABLE
      reconciledWithId: null,
      paymentDate: null, // em aberto = nunca paga (defesa em profundidade)
      amount: { gte: minAmount, lte: maxAmount },
      dueDate: { gte: minDate, lte: maxDate },
      AND: [companyScope, sameAccountOrNull],
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
    lifecycle: c.lifecycle as 'PAYABLE' | 'RECEIVABLE',
    description: c.description,
    amount: c.amount,
    dueDate: resolveTargetDate(c as CandidateRow),
    supplierId: c.supplierId,
    customerId: c.customerId,
    categoryId: c.categoryId,
  }))
}
