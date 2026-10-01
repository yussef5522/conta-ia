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
  /**
   * ⭐⭐⭐ A CONTA ONDE O CONTRATO É DEBITADO (01/10/2026) — **o sinal que estava sendo
   * selecionado e jogado fora.**
   *
   * ⛔⛔ O comentário do ramo (b) desta função já dizia *"palavra-chave + **a conta tem
   * empréstimo ativo** → candidatos"* — e **o código nunca olhou a conta**. Medido em prod:
   * a linha `DEBITO PRESTA SIEMP` do **banco caixa** voltava com **os 10 contratos da
   * empresa**, incluindo Banrisul e Sicredi, que não têm como ser debitados ali.
   *
   * ⚠️ `palpitesDaCaixa` já tinha o campo no `select` e o **descartava no map** — a doença do
   * select incompleto ao contrário: o dado chega e ninguém usa.
   */
  bankAccountId?: string | null
}

export type LoanPaymentDetection =
  | { kind: 'CONTRACT'; loanId: string; contractNumber: string; lender: string }
  | { kind: 'CANDIDATES'; candidates: Array<{ loanId: string; contractNumber: string | null; lender: string; dueDay: number | null }> }
  | { kind: 'NOT_REGISTERED'; contractNumber: string }
  | null

export function detectLoanPayment(
  tx: { description: string; type: string; date: string | Date; bankAccountId?: string | null },
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
    // (c) número apareceu mas não há empréstimo cadastrado com ele.
    // GUARD (04/08): só avisa "não cadastrado" se a descrição REALMENTE parece de
    // empréstimo — o extrator tem fallback de "≥10 dígitos" que pega CPF de PIX
    // (ex "PIX_DEB 11144477735 YUSS"). Exige nº C-prefixado (Sicredi) OU palavra
    // -chave de empréstimo; senão cai fora (não é empréstimo).
    const contractLike = extracted.some((c) => /^C\d/.test(c)) || LOAN_KEYWORD.test(desc)
    if (contractLike) return { kind: 'NOT_REGISTERED', contractNumber: extracted[0] }
  }

  // (b) palavra-chave + a conta tem empréstimo ativo → candidatos (usuário escolhe)
  if (LOAN_KEYWORD.test(desc) && active.length > 0) {
    /**
     * ⭐⭐ A CONTA ESTREITA OS CANDIDATOS — e ela **nunca estreita até zero**.
     *
     * ⛔ Se nenhum contrato for daquela conta, vale a lista inteira (o comportamento de
     * antes): o `bankAccountId` do contrato pode simplesmente não ter sido preenchido, e
     * **sumir com o candidato é pior que oferecer um a mais** — o dono vê o de sobra e
     * descarta; o que falta ele não tem como adivinhar.
     *
     * ⭐ Medido no caso real: 10 candidatos → **2** (os dois contratos da Caixa Econômica),
     * tirando os 5 do Sicredi, os 2 do Banrisul e o mútuo sem conta.
     */
    const daConta = tx.bankAccountId
      ? active.filter((l) => l.bankAccountId === tx.bankAccountId)
      : []
    const universo = daConta.length > 0 ? daConta : active
    const txDay = new Date(tx.date).getUTCDate()
    const ranked = [...universo].sort((a, b) => {
      const da = a.dueDay != null ? Math.abs(a.dueDay - txDay) : 99
      const db = b.dueDay != null ? Math.abs(b.dueDay - txDay) : 99
      return da - db
    })
    return { kind: 'CANDIDATES', candidates: ranked.map((l) => ({ loanId: l.id, contractNumber: l.contractNumber, lender: l.lender, dueDay: l.dueDay })) }
  }

  return null
}
