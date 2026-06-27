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
// Sprint Contract Suffix Fix (27/06/2026): helper único pra match de
// contrato com/sem sufixo "-N". Antes era duplicado aqui.
import {
  descriptionMatchesContract,
  normalizeForContractMatch as normalizeForContractMatchShared,
} from './contract-core'

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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function diffDays(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY
}

// Sprint Contract Suffix Fix (27/06/2026): mantido só pra retrocompat de
// outros usos internos — delega pro helper compartilhado. Match de contrato
// agora usa descriptionMatchesContract (que extrai o "core" sem sufixo).
function normalizeForContractMatch(s: string): string {
  return normalizeForContractMatchShared(s)
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
      interestRateMonthly: true,
      installments: {
        where: { status: 'OPEN' },
        select: {
          id: true,
          number: true,
          dueDate: true,
          payment: true,
          interest: true,
          amortization: true,
          openingBalance: true,
          isEstimate: true,
        },
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

    // Sprint Contract Suffix Fix (27/06/2026): hasContract avaliado pela
    // mesma lógica do helper compartilhado (extrai core sem sufixo "-N").
    const hasContractToMatch =
      !!loan.contractNumber && loan.contractNumber.length >= 5

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

        // Sprint AI/Contrato (17/06/2026) — tolerância expandida pra ESTIMATE
        // (pós-fixado): o valor real pode variar significativamente do estimado
        // por causa da correção CDI. Aceita até 25% de diff quando contrato bate
        // ou ±15% genérico.
        const strongAmountTol = ins.isEstimate
          ? Math.max(ins.payment * 0.05, STRONG_AMOUNT_TOL)
          : STRONG_AMOUNT_TOL
        const ambiguousAmountTol = ins.isEstimate
          ? Math.max(ins.payment * 0.15, AMBIGUOUS_AMOUNT_TOL)
          : AMBIGUOUS_AMOUNT_TOL

        // (1) contractNumber match — agora via helper compartilhado, que
        // extrai o "core" do contractNumber (ignora sufixo "-N"). Resolve
        // C41033828-8 vs descrição "LIQUIDACAO DE PARCELA-C41033828".
        if (
          hasContractToMatch &&
          descriptionMatchesContract(tx.description, loan.contractNumber) &&
          amountDiff <= (ins.isEstimate ? Math.max(ins.payment * 0.30, STRONG_AMOUNT_TOL) : strongAmountTol)
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

        // (3) janela mais larga = ambíguo (ou strong quando ESTIMATE com janela curta)
        if (amountDiff <= ambiguousAmountTol && dateDiff <= AMBIGUOUS_DATE_WINDOW_DAYS) {
          ambiguousCandidates.push(tx)
        }
      }

      if (strongMatch) {
        try {
          // Sprint AI/Contrato (17/06/2026):
          // Quando ins.isEstimate (pós-fixado), recalcula juros + correção +
          // closingBalance com base no realPayment. Mantém amortização constante
          // (= ins.amortization), porque é fixa pelo SAC.
          //   juros     = openingBalance * rateMonthly (fixo pelo contrato)
          //   correcao  = realPayment - amortization - juros
          //   closing   = openingBalance - amortization
          // realPayment é salvo na coluna pra DRE enrichment usar.
          const realPayment = strongMatch.tx.amount
          let updateData: {
            status: string
            paidDate: Date
            reconciledTransactionId: string
            realPayment: number
            interest?: number
            correcao?: number
            closingBalance?: number
            payment?: number
          } = {
            status: 'PAID',
            paidDate: strongMatch.tx.date,
            reconciledTransactionId: strongMatch.tx.id,
            realPayment,
          }
          if (ins.isEstimate) {
            const interest = round2(ins.openingBalance * loan.interestRateMonthly)
            const correcao = round2(realPayment - ins.amortization - interest)
            const closingBalance = round2(ins.openingBalance - ins.amortization)
            updateData = {
              ...updateData,
              interest,
              correcao,
              closingBalance,
              payment: realPayment,
            }
          }

          await prisma.$transaction(async (txClient) => {
            const upd = await txClient.loanInstallment.updateMany({
              where: { id: ins.id, status: 'OPEN', reconciledTransactionId: null },
              data: updateData,
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
            payment: ins.isEstimate ? realPayment : ins.payment,
            interest: ins.isEstimate
              ? round2(ins.openingBalance * loan.interestRateMonthly)
              : ins.interest,
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
