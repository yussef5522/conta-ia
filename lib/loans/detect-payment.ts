// Sprint Casar Pagamento (04/08/2026) — FASE 3: detecta que uma transação de
// Pendentes é PAGAMENTO de empréstimo e a qual contrato pertence.
//
// Ordem de confiança (validada nos extratos reais dos 3 bancos):
//   (a) NÚMERO DE CONTRATO na descrição — só Sicredi ("AMORTIZACAO CONTRATO-C…",
//       "LIQUIDACAO DE PARCELA-C…"). Vínculo direto, normaliza sufixo -N.
//   (b) PALAVRA-CHAVE + a conta tem empréstimo ativo — Banrisul manda só
//       "EMPRESTIMO", Caixa "DEBITO PRESTA SIEMP" (sem número). Devolve os
//       candidatos pro usuário ESCOLHER — NUNCA adivinha (a caçula tem 2 no
//       Banrisul e 2 na Caixa). Ranqueia por proximidade do dia de vencimento.
//   (c) contrato na descrição SEM empréstimo cadastrado → avisa "cadastrar".
//
// Pura — sem DB. NUNCA decide sozinho no caso (b).

import { descriptionMatchesContract } from './contract-core'
import { extractContractCandidatesFromDescription } from './match-contract-in-description'

const LOAN_KEYWORD = /empr[eé]stimo|emprestimo|amortizac|liquidac|presta|contrato|financ|parcela|pronampe/i

export interface DetectLoanLite {
  id: string
  contractNumber: string | null
  lender: string
  status: string
  /** dia de vencimento típico (1..31) — sinal auxiliar de ranking. */
  dueDay: number | null
}

export type LoanPaymentDetection =
  | { kind: 'CONTRACT'; loanId: string; contractNumber: string; lender: string }
  | { kind: 'CANDIDATES'; candidates: Array<{ loanId: string; contractNumber: string | null; lender: string; dueDay: number | null }> }
  | { kind: 'NOT_REGISTERED'; contractNumber: string }
  | null

export function detectLoanPayment(
  tx: { description: string; type: string; date: string | Date },
  loans: DetectLoanLite[],
): LoanPaymentDetection {
  if (tx.type !== 'DEBIT') return null
  const desc = tx.description ?? ''
  const active = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'LATE')

  // (a) contrato na descrição
  const extracted = extractContractCandidatesFromDescription(desc)
  if (extracted.length > 0) {
    for (const loan of active) {
      if (loan.contractNumber && descriptionMatchesContract(desc, loan.contractNumber)) {
        return { kind: 'CONTRACT', loanId: loan.id, contractNumber: loan.contractNumber, lender: loan.lender }
      }
    }
    // (c) número apareceu mas não há empréstimo cadastrado com ele
    return { kind: 'NOT_REGISTERED', contractNumber: extracted[0] }
  }

  // (b) palavra-chave + a conta tem empréstimo ativo → candidatos (usuário escolhe)
  if (LOAN_KEYWORD.test(desc) && active.length > 0) {
    const txDay = new Date(tx.date).getUTCDate()
    const ranked = [...active].sort((a, b) => {
      const da = a.dueDay != null ? Math.abs(a.dueDay - txDay) : 99
      const db = b.dueDay != null ? Math.abs(b.dueDay - txDay) : 99
      return da - db
    })
    return { kind: 'CANDIDATES', candidates: ranked.map((l) => ({ loanId: l.id, contractNumber: l.contractNumber, lender: l.lender, dueDay: l.dueDay })) }
  }

  return null
}
