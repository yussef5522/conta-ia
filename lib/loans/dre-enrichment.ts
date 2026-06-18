// Sprint Empréstimos Backend (17/06/2026) — bridge entre Loans e DRE.
//
// Caller carrega:
//   - todas as Loans da empresa (id + disbursementTransactionId)
//   - todas as LoanInstallments da empresa (id + reconciledTransactionId + interest)
// e chama enrichTransactionsForDRE pra marcar tx.isLoanDisbursement
// e tx.loanInterestSplit antes de passar pro calculateDRE.

import type { TransactionForDRE } from '@/lib/dre/types'

export interface LoanContextRow {
  /** Loan.disbursementTransactionId não-nulo */
  disbursementTransactionId: string
}

export interface InstallmentContextRow {
  /** LoanInstallment.reconciledTransactionId não-nulo */
  reconciledTransactionId: string
  /** LoanInstallment.interest (juros pré) */
  interest: number
  /** Sprint AI/Contrato — correção pós-fixado (CDI/SELIC/IPCA).
   *  DRE conta interest + correcao como DESPESAS_FINANCEIRAS. */
  correcao?: number
}

export interface LoanContext {
  loans: LoanContextRow[]
  installments: InstallmentContextRow[]
}

/**
 * Marca tx.isLoanDisbursement e tx.loanInterestSplit baseado no contexto.
 * Função pura — não muta nem o input nem o contexto, devolve nova lista.
 */
export function enrichTransactionsForDRE(
  txs: TransactionForDRE[],
  ctx: LoanContext,
): TransactionForDRE[] {
  const disbursementSet = new Set<string>()
  for (const l of ctx.loans) {
    if (l.disbursementTransactionId) disbursementSet.add(l.disbursementTransactionId)
  }
  const interestByTxId = new Map<string, number>()
  for (const i of ctx.installments) {
    if (i.reconciledTransactionId) {
      // DRE pega juros + correção. Amortização fora (baixa de passivo).
      interestByTxId.set(
        i.reconciledTransactionId,
        Math.round((i.interest + (i.correcao ?? 0)) * 100) / 100,
      )
    }
  }

  return txs.map((tx) => {
    const isDisb = disbursementSet.has(tx.id)
    const interest = interestByTxId.get(tx.id)
    if (!isDisb && interest === undefined) return tx
    return {
      ...tx,
      ...(isDisb ? { isLoanDisbursement: true } : {}),
      ...(interest !== undefined ? { loanInterestSplit: interest } : {}),
    }
  })
}
