// ⭐⭐⭐ VINCULAR PAGAMENTO A PARCELA — UMA PORTA SÓ (11/09/2026).
//
// **O dono:** *"o ramo do import que grava vínculo de parcela chama o MESMO
// `computeLinkSplit` do painel — marcar PAID sem split deixaria os encargos (1.559,72 no
// caso real) FORA do DRE. Fonte única, red-then-green: vincular pelo import = vincular
// pelo painel, mesmo split, mesmo DRE."*
//
// ⛔⛔ O QUE O IMPORT FAZIA, medido: `case 'PAGAMENTO_EMPRESTIMO'` marcava
// `status:'PAID'` + `reconciledTransactionId` **e mais nada** — sem `paidTotal`, sem
// `paidInterest`, sem `paidCorrection`. Como o DRE lê **exatamente** esses campos
// (`buildLoanN1InterestTx`), a parcela entrava "paga" com **encargo ZERO**: R$ 1.559,72
// de despesa financeira **sumindo do resultado**, calados.
//
// ⚠️ E O IMPORT GRAVAVA PELA PORTA 1:1 (`reconciledTransactionId`) enquanto o painel usa
// a N:1 (`LoanInstallmentPayment`). **Duas portas pro mesmo fato** é a família documentada
// desde 14/08 (*"'linked' tem DUAS portas; checar UMA é o bug"*) — e o trigger do banco
// (`loan_installment_no_double_link`) recusa quem tiver as duas. Agora só existe uma.

import type { PrismaClient, Prisma } from '@prisma/client'
import { computeLinkSplit, storedScheduleValid, shouldWriteSplit } from './link-payment'

type Db = PrismaClient | Prisma.TransactionClient

export class VinculoDeParcelaError extends Error {
  code: string
  constructor(code: string, msg: string) { super(msg); this.code = code; this.name = 'VinculoDeParcelaError' }
}

export interface VincularInput {
  db: Db
  companyId: string
  loanId: string
  installmentNumber: number
  /** as linhas do extrato que compõem o pagamento (1 ou N — o painel permite o grupo) */
  transactionIds: string[]
}

export interface VincularResultado {
  linked: number
  status: 'PAID' | 'PARTIAL'
  paidTotal: number
  splitInjected: boolean
  isPartial: boolean
  agendaValida: boolean
}

/**
 * ⭐⭐ A ÚNICA porta de gravação do vínculo parcela↔pagamento. Painel e import chamam ESTA.
 *
 * ⚠️ Recebe o `db` — roda dentro da `$transaction` do import (onde a marcação é atômica
 * com a criação das linhas) ou abre a sua no painel.
 */
export async function vincularPagamentoDeParcela(input: VincularInput): Promise<VincularResultado> {
  const { db, companyId, loanId, installmentNumber, transactionIds } = input
  const prisma = db as PrismaClient

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, companyId },
    select: {
      id: true, bankAccountId: true, interestRateMonthly: true, rateType: true,
      scheduleSource: true, installmentsPaidBefore: true,
    },
  })
  if (!loan) throw new VinculoDeParcelaError('LOAN_NOT_FOUND', 'Empréstimo não encontrado nesta empresa')

  const target = await prisma.loanInstallment.findFirst({
    where: { loanId, number: installmentNumber },
    select: { id: true, amortization: true, openingBalance: true, reconciledTransactionId: true },
  })
  if (!target) throw new VinculoDeParcelaError('INSTALLMENT_NOT_FOUND', 'Parcela não encontrada')
  // ⛔ a porta 1:1 e a N:1 na mesma parcela = juros contado 2× no DRE (o trigger do banco
  // recusa, mas a mensagem daqui explica o que fazer).
  if (target.reconciledTransactionId) {
    throw new VinculoDeParcelaError('JA_VINCULADA_1_1',
      'Esta parcela já tem vínculo 1:1 — desfaça antes de vincular pelo grupo')
  }

  const txs = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      bankAccountId: loan.bankAccountId ?? undefined,
      type: 'DEBIT',
      loanInstallmentPaid: { is: null },
      loanInstallmentPayments: { none: {} },
    },
    select: { id: true, amount: true, date: true },
  })
  if (txs.length !== transactionIds.length) {
    throw new VinculoDeParcelaError('TX_INELIGIBLE',
      'Alguns lançamentos não são elegíveis (conta errada, já vinculados, ou não são débito)')
  }

  const paidTotal = txs.reduce((s, t) => s + t.amount, 0)
  const split = computeLinkSplit({
    installment: { amortization: target.amortization, openingBalance: target.openingBalance },
    rateMonthly: loan.interestRateMonthly, paidTotal,
  })

  const startNumber = loan.installmentsPaidBefore + 1
  const tracked = await prisma.loanInstallment.findMany({
    where: { loanId, number: { gte: startNumber } }, orderBy: { number: 'asc' },
    select: { number: true, openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true },
  })
  const agendaValida = storedScheduleValid(
    tracked, tracked[0]?.openingBalance ?? 0, loan.interestRateMonthly > 0, loan.rateType === 'POS',
  )
  const isZeroRate = loan.interestRateMonthly === 0
  const gravaSplit = shouldWriteSplit({
    scheduleSource: loan.scheduleSource, isZeroRate, agendaValida, isPartial: split.isPartial,
  })
  const paidDate = txs.reduce((max, t) => (t.date > max ? t.date : max), txs[0].date)
  const status: 'PAID' | 'PARTIAL' = split.isPartial ? 'PARTIAL' : 'PAID'

  for (const t of txs) {
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: target.id, transactionId: t.id, amount: t.amount },
    })
  }
  await prisma.loanInstallment.update({
    where: { id: target.id },
    data: {
      status, paidDate, paidTotal: split.paidTotal,
      // ⚠️ o split só grava quando a agenda sustenta (FASE 5.3) — senão fica "a definir",
      // que é honesto; inventar encargo é pior que não ter.
      ...(gravaSplit ? {
        paidInterest: split.paidInterest,
        paidCorrection: split.paidCorrection,
        paidPenalty: split.paidPenalty,
        closingBalance: split.closingBalance,
        ...(isZeroRate ? { amortization: split.amortization } : {}),
      } : {}),
    },
  })

  return {
    linked: txs.length, status, paidTotal: split.paidTotal,
    splitInjected: gravaSplit, isPartial: split.isPartial, agendaValida,
  }
}
