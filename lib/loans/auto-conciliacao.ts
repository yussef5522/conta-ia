// Sprint Empréstimos Backend (17/06/2026) — auto-conciliação de parcela.
//
// Pós-import OFX: pra cada parcela OPEN dos empréstimos da empresa, busca
// tx DEBIT no extrato do bankAccount do empréstimo. Match:
//   FORTE   → marca PAID + paidDate + reconciledTransactionId
//             flag a tx vira input do DRE com split de juros
//   AMBÍGUO → não marca (sugestão pendente — UI Sprint B mostra)
//
// Regras de match (em ordem de força):
//   1. STRONG: tx.description contém Loan.contractNumber (≥ 5 chars)
//      AND tx.amount ≈ installment.payment (±R$ 0,50)
//   2. STRONG: tx.amount === installment.payment (exato ±R$ 0,01)
//              AND |tx.date − installment.dueDate| ≤ 3 dias
//   3. AMBIGUOUS: tx.amount dentro ±R$ 1,00 AND |dias| ≤ 5
//
// Sem cross-account. Loan tem bankAccountId fixo — pareamos só na conta
// dele. Multi-tenant: caller passa companyId; carrega Loans dessa empresa.

import type { PrismaClient } from '@prisma/client'

export interface AutoConciliacaoResult {
  matched: Array<{
    loanId: string
    installmentId: string
    installmentNumber: number
    transactionId: string
    payment: number
    interest: number
    amortization: number
    reason: 'CONTRACT_NUMBER' | 'EXACT_AMOUNT_DATE'
  }>
  ambiguous: Array<{
    loanId: string
    installmentId: string
    installmentNumber: number
    candidateTransactionIds: string[]
    reason: 'AMBIGUOUS_AMOUNT_DATE'
  }>
  loansActivated: number    // loans que viraram PAID_OFF nesta rodada
}

const STRONG_AMOUNT_TOL = 0.5  // R$ 0,50 quando temos contractNumber
const EXACT_AMOUNT_TOL = 0.01  // R$ 0,01 (centavo) quando match exato
const AMBIGUOUS_AMOUNT_TOL = 1.0
const STRONG_DATE_WINDOW_DAYS = 3
const AMBIGUOUS_DATE_WINDOW_DAYS = 5
const MS_PER_DAY = 24 * 60 * 60 * 1000

function diffDays(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY
}

function normalizeForContractMatch(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Auto-concilia parcelas com tx OFX recém-importadas. Caller chama no fim
 * do import OFX (igual ao scan-retroativo de transferências).
 *
 * Multi-tenant: companyId obrigatório. Função carrega só Loans dessa empresa.
 */
export async function autoConciliarParcelas(
  prisma: PrismaClient,
  companyId: string,
  options?: { sinceDays?: number },
): Promise<AutoConciliacaoResult> {
  if (!companyId) {
    throw new Error('companyId obrigatório')
  }
  const sinceDays = options?.sinceDays ?? 7
  const sinceDate = new Date(Date.now() - sinceDays * MS_PER_DAY)

  // 1) Loans ACTIVE com installments OPEN da empresa
  const loans = await prisma.loan.findMany({
    where: { companyId, status: { in: ['ACTIVE', 'LATE'] } },
    select: {
      id: true,
      bankAccountId: true,
      contractNumber: true,
      installments: {
        where: { status: 'OPEN' },
        select: { id: true, number: true, dueDate: true, payment: true, interest: true, amortization: true },
        orderBy: { number: 'asc' },
      },
    },
  })

  if (loans.length === 0) {
    return { matched: [], ambiguous: [], loansActivated: 0 }
  }

  const matched: AutoConciliacaoResult['matched'] = []
  const ambiguous: AutoConciliacaoResult['ambiguous'] = []
  const installmentsAlreadyClaimed = new Set<string>()
  const txAlreadyUsed = new Set<string>()

  for (const loan of loans) {
    if (loan.installments.length === 0) continue

    // Busca DEBIT na conta do empréstimo dos últimos N dias, ainda
    // disponíveis (não pareadas a nada).
    const candidates = await prisma.transaction.findMany({
      where: {
        bankAccountId: loan.bankAccountId,
        type: 'DEBIT',
        origin: 'OFX',
        lifecycle: 'EFFECTED',
        createdAt: { gte: sinceDate },
        loanInstallmentPaid: null, // tx ainda livre
        reconciledWithId: null,
      },
      select: { id: true, date: true, amount: true, description: true },
    })
    if (candidates.length === 0) continue

    const contractKey =
      loan.contractNumber && loan.contractNumber.length >= 5
        ? normalizeForContractMatch(loan.contractNumber)
        : null

    for (const ins of loan.installments) {
      if (installmentsAlreadyClaimed.has(ins.id)) continue

      // Filtro 1: contractNumber em descrição
      let strongMatch:
        | { tx: (typeof candidates)[number]; reason: 'CONTRACT_NUMBER' | 'EXACT_AMOUNT_DATE' }
        | null = null
      const ambiguousCandidates: typeof candidates = []

      for (const tx of candidates) {
        if (txAlreadyUsed.has(tx.id)) continue
        const amountDiff = Math.abs(tx.amount - ins.payment)
        const dateDiff = diffDays(tx.date, ins.dueDate)

        // (1) contractNumber match
        if (
          contractKey &&
          normalizeForContractMatch(tx.description).includes(contractKey) &&
          amountDiff <= STRONG_AMOUNT_TOL
        ) {
          strongMatch = { tx, reason: 'CONTRACT_NUMBER' }
          break
        }

        // (2) valor exato + data próxima
        if (amountDiff <= EXACT_AMOUNT_TOL && dateDiff <= STRONG_DATE_WINDOW_DAYS) {
          // Se já tem outro candidato strong, vira ambíguo — fica conservador.
          if (strongMatch) {
            ambiguousCandidates.push(tx, strongMatch.tx)
            strongMatch = null
          } else {
            strongMatch = { tx, reason: 'EXACT_AMOUNT_DATE' }
          }
          continue
        }

        // (3) janela mais larga = ambíguo
        if (amountDiff <= AMBIGUOUS_AMOUNT_TOL && dateDiff <= AMBIGUOUS_DATE_WINDOW_DAYS) {
          ambiguousCandidates.push(tx)
        }
      }

      if (strongMatch) {
        try {
          await prisma.$transaction(async (txClient) => {
            const upd = await txClient.loanInstallment.updateMany({
              where: { id: ins.id, status: 'OPEN', reconciledTransactionId: null },
              data: {
                status: 'PAID',
                paidDate: strongMatch!.tx.date,
                reconciledTransactionId: strongMatch!.tx.id,
              },
            })
            if (upd.count !== 1) {
              throw new Error('Race: installment já foi marcada')
            }
          })
          matched.push({
            loanId: loan.id,
            installmentId: ins.id,
            installmentNumber: ins.number,
            transactionId: strongMatch.tx.id,
            payment: ins.payment,
            interest: ins.interest,
            amortization: ins.amortization,
            reason: strongMatch.reason,
          })
          installmentsAlreadyClaimed.add(ins.id)
          txAlreadyUsed.add(strongMatch.tx.id)
        } catch {
          // race ou unique constraint — segue (ambiguous fica de fora também)
        }
      } else if (ambiguousCandidates.length > 0) {
        const ids = Array.from(new Set(ambiguousCandidates.map((c) => c.id)))
        ambiguous.push({
          loanId: loan.id,
          installmentId: ins.id,
          installmentNumber: ins.number,
          candidateTransactionIds: ids,
          reason: 'AMBIGUOUS_AMOUNT_DATE',
        })
      }
    }
  }

  // Recalcula status do Loan: se todas as parcelas PAID → PAID_OFF.
  let loansActivated = 0
  const loanIdsTocados = new Set(matched.map((m) => m.loanId))
  for (const loanId of loanIdsTocados) {
    const remaining = await prisma.loanInstallment.count({
      where: { loanId, status: { in: ['OPEN', 'LATE'] } },
    })
    if (remaining === 0) {
      await prisma.loan.update({
        where: { id: loanId },
        data: { status: 'PAID_OFF' },
      })
      loansActivated += 1
    }
  }

  return { matched, ambiguous, loansActivated }
}

/**
 * Conveniência: calcula saldo devedor atual de um empréstimo.
 *   outstandingBalance = principal − SUM(amortization das parcelas PAID)
 */
export async function computeOutstandingBalance(
  prisma: PrismaClient,
  loanId: string,
): Promise<number> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { principal: true },
  })
  if (!loan) throw new Error(`Loan ${loanId} não encontrado`)
  const paid = await prisma.loanInstallment.aggregate({
    where: { loanId, status: 'PAID' },
    _sum: { amortization: true },
  })
  const sumPaid = paid._sum.amortization ?? 0
  return Math.round((loan.principal - sumPaid) * 100) / 100
}
