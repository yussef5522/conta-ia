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
import { exigeContaDoEmprestimo, MutuoSemContaError } from './exige-conta'
// ⭐⭐ R54 (25/11/2026) — o casamento automático do OFX grava pela PORTA ÚNICA
import { vincularPagamentoDeParcela } from './vincular-pagamento'

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
    where: { companyId, status: { in: ['ACTIVE', 'LATE'] }, archivedAt: null },
    select: {
      id: true,
      bankAccountId: true,
      contractNumber: true,
      interestRateMonthly: true,
      installments: {
        // ⭐ R55 (25/11) — parcial agora é OPEN com pedaços; o automático não mexe nela
        where: { status: 'OPEN', payments: { none: {} } },
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

  /**
   * ⭐ N+1 curado (25/11/2026): as candidatas de TODAS as contas vêm numa leitura só.
   * ⛔ NUNCA `loan.bankAccountId` cru: com null vira `IS NULL` e casa com as transações
   * órfãs de conta. Mútuo sem trânsito não tem o que conciliar (`exigeContaDoEmprestimo`).
   */
  const contas = Array.from(new Set(
    loans.filter((l) => l.installments.length > 0)
      .map((l) => exigeContaDoEmprestimo(l, 'conciliar automaticamente')),
  ))
  const todasCandidatas = contas.length === 0 ? [] : await prisma.transaction.findMany({
    where: {
      bankAccountId: { in: contas },
      type: 'DEBIT',
      origin: 'OFX',
      lifecycle: 'EFFECTED',
      createdAt: { gte: sinceDate },
      loanInstallmentPaid: null, // tx ainda livre
      // ⭐ R54 — livre da porta N:1 também (antes só a 1:1 era olhada)
      loanInstallmentPayments: { none: {} },
      reconciledWithId: null,
    },
    select: { id: true, date: true, amount: true, description: true, bankAccountId: true },
  })
  const candidatasPorConta = new Map<string, typeof todasCandidatas>()
  for (const t of todasCandidatas) {
    if (!t.bankAccountId) continue
    const a = candidatasPorConta.get(t.bankAccountId) ?? []
    a.push(t)
    candidatasPorConta.set(t.bankAccountId, a)
  }

  for (const loan of loans) {
    if (loan.installments.length === 0) continue
    const candidates = candidatasPorConta.get(exigeContaDoEmprestimo(loan, 'conciliar automaticamente')) ?? []
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
        // (pós-fixado): o valor real pode variar do estimado pela correção.
        const strongAmountTol = ins.isEstimate
          ? Math.max(ins.payment * 0.05, STRONG_AMOUNT_TOL)
          : STRONG_AMOUNT_TOL
        const ambiguousAmountTol = ins.isEstimate
          ? Math.max(ins.payment * 0.15, AMBIGUOUS_AMOUNT_TOL)
          : AMBIGUOUS_AMOUNT_TOL

        // (1) contractNumber match via helper compartilhado (ignora sufixo "-N")
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

        // (3) janela mais larga = ambíguo
        if (amountDiff <= ambiguousAmountTol && dateDiff <= AMBIGUOUS_DATE_WINDOW_DAYS) {
          ambiguousCandidates.push(tx)
        }
      }

      if (strongMatch) {
        try {
          /**
           * ⛔⛔ R54/R55 (25/11/2026) — antes este ramo gravava o vínculo 1:1 e REESCREVIA a
           * agenda (`payment`/`interest`/`correcao`/`closingBalance`) no pós-fixado. Agora é a
           * porta única: pedaço N:1 + encargos apurados, as MESMAS travas (teto, já quitada) e a
           * agenda intacta. Recusa da porta (ou parcial) = a parcela fica pra caixa de entrada.
           */
          const tx = strongMatch.tx
          const r = await prisma.$transaction(async (db) => {
            const res = await vincularPagamentoDeParcela({
              db, companyId, loanId: loan.id, installmentNumber: ins.number, transactionIds: [tx.id],
            })
            // parcial não é casamento automático — desfaz a gravação inteira
            if (res.isPartial) throw new Error('parcial')
            return res
          })
          matched.push({
            loanId: loan.id,
            installmentId: ins.id,
            installmentNumber: ins.number,
            transactionId: tx.id,
            payment: r.paidTotal,
            interest: ins.interest,
            amortization: ins.amortization,
            reason: strongMatch.reason,
          })
          installmentsAlreadyClaimed.add(ins.id)
          txAlreadyUsed.add(tx.id)
        } catch {
          // recusa da porta, parcial ou corrida — segue (fica pra caixa de entrada)
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

  // ⭐ N+1 curado (25/11): quem fecha o contrato agora é a porta; aqui só se CONTA quem fechou,
  // numa leitura só
  const tocados = Array.from(new Set(matched.map((m) => m.loanId)))
  const loansActivated = tocados.length === 0 ? 0 : await prisma.loan.count({
    where: { id: { in: tocados }, status: 'PAID_OFF' },
  })

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
