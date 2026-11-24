// ⭐⭐⭐ A PRÉVIA DO VÍNCULO — o que a porta única VAI gravar, antes do clique (25/11/2026).
//
// ⛔⛔ R54 — UMA PORTA SÓ PRA PAGAR PARCELA. Este motor morava na rota
// `vincular-parcela/preview`, servida por um modal (`LinkPaymentModal`) que **ninguém
// importava**: a exceção da conta garantida, o teto e a régua de bloqueio estavam certos e
// **inalcançáveis** (porta sem maçaneta). Ele agora é função com dono e serve o "marcar paga"
// do detalhe — a MESMA régua (`bloqueioDoVinculo`) e o MESMO split (`computeLinkSplit`) que
// `vincularPagamentoDeParcela` aplica na gravação. A tela não tem como oferecer o que a porta
// recusa, nem mostrar um split que ela não grava.

import type { PrismaClient, Prisma } from '@prisma/client'
import {
  buildLinkGroup, computeLinkSplit, storedScheduleValid, shouldWriteSplit, pickTargetInstallment,
  parcelaDoEvento, somaNoEventoDoMes, bloqueioDoVinculo,
} from './link-payment'
import { exigeContaDoEmprestimo } from './exige-conta'
import { encargoRealRecente } from './encargo-real-recente'
import { arredondar2 } from './estado-da-parcela'

type Db = PrismaClient | Prisma.TransactionClient

const DIAS_ANTES = 45
const DIAS_DEPOIS = 15

export class PreviaDoVinculoError extends Error {
  constructor(public code: 'LOAN_NOT_FOUND' | 'SEM_PARCELA', msg: string) { super(msg) }
}

export interface PreviaInput {
  companyId: string
  loanId: string
  installmentNumber?: number
  transactionIds?: string[]
  originTxId?: string
}

export async function previaDoVinculo(db: Db, input: PreviaInput) {
  const prisma = db as PrismaClient
  const { companyId, loanId } = input

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, companyId },
    select: {
      bankAccountId: true, contractNumber: true, lender: true,
      interestRateMonthly: true, rateType: true, installmentsPaidBefore: true, scheduleSource: true,
    },
  })
  if (!loan) throw new PreviaDoVinculoError('LOAN_NOT_FOUND', 'Empréstimo não encontrado nesta empresa')

  const installments = await prisma.loanInstallment.findMany({
    where: { loanId }, orderBy: { number: 'asc' },
    select: {
      id: true, number: true, dueDate: true, amortization: true, openingBalance: true, closingBalance: true,
      interest: true, correcao: true, payment: true, status: true, isEstimate: true, reconciledTransactionId: true,
      payments: { select: { amount: true, transaction: { select: { date: true } } } },
    },
  })

  // ⭐ os contratos CADASTRADOS — a exceção da conta garantida (19/10) precisa deles
  const contratosCadastrados = (
    await prisma.loan.findMany({ where: { companyId }, select: { contractNumber: true } })
  ).map((l) => l.contractNumber)

  const startNumber = loan.installmentsPaidBefore + 1
  const openList = installments.filter((i) => i.number >= startNumber && i.status !== 'PAID')

  const conta = exigeContaDoEmprestimo(loan, 'pré-visualizar o vínculo')
  const alvoPedido = input.installmentNumber != null
    ? installments.find((i) => i.number === input.installmentNumber)
    : undefined
  // a janela é a da parcela pedida (o "marcar paga" de uma linha) ou a de todas as abertas
  const vencs = (alvoPedido ? [alvoPedido] : openList.length ? openList : installments).map((i) => i.dueDate.getTime())
  const CANDIDATO_WHERE = {
    bankAccountId: conta, type: 'DEBIT' as const, lifecycle: 'EFFECTED' as const,
    loanInstallmentPaid: { is: null }, loanInstallmentPayments: { none: {} },
  }
  const pendJanela = vencs.length === 0 ? [] : await prisma.transaction.findMany({
    where: {
      ...CANDIDATO_WHERE,
      date: {
        gte: new Date(Math.min(...vencs) - DIAS_ANTES * 86400_000),
        lte: new Date(Math.max(...vencs) + DIAS_DEPOIS * 86400_000),
      },
    },
    orderBy: { date: 'asc' },
    select: { id: true, description: true, amount: true, date: true },
  })
  const semente = input.originTxId && !pendJanela.some((t) => t.id === input.originTxId)
    ? await prisma.transaction.findFirst({
        where: { ...CANDIDATO_WHERE, id: input.originTxId },
        select: { id: true, description: true, amount: true, date: true },
      })
    : null
  const pend = semente ? [semente, ...pendJanela] : pendJanela

  const originTx = input.originTxId ? pend.find((t) => t.id === input.originTxId) : undefined
  const pick = pickTargetInstallment(openList, originTx?.date ?? null, originTx?.amount ?? null)
  const doEvento = originTx
    ? parcelaDoEvento(
        installments.filter((i) => i.number >= startNumber).map((i) => ({ ...i, diasPagos: i.payments.map((p) => p.transaction.date) })),
        originTx.date, loan.interestRateMonthly,
      )
    : null
  const targetNumber = input.installmentNumber ?? doEvento?.number ?? pick.target?.number
  const target = targetNumber != null ? installments.find((i) => i.number === targetNumber) : undefined
  if (!target) throw new PreviaDoVinculoError('SEM_PARCELA', 'Nenhuma parcela em aberto pra vincular')

  const group = buildLinkGroup({
    pend, contractNumber: loan.contractNumber, originTxId: input.originTxId,
    transactionIds: input.transactionIds, contratosCadastrados,
  })
  const jaVinculado = arredondar2(target.payments.reduce((s, p) => s + p.amount, 0))
  const paidTotalGravado = arredondar2(jaVinculado + group.paidTotal)

  const encReal = await encargoRealRecente(db, loanId)
  const bloqueio = bloqueioDoVinculo({
    installmentNumber: target.number,
    temVinculo11: target.reconciledTransactionId != null,
    status: target.status,
    jaVinculados: { quantos: target.payments.length, soma: jaVinculado },
    paidTotal: paidTotalGravado,
    amortization: target.amortization,
    interest: target.interest,
    openingBalance: target.openingBalance,
    rateMonthly: loan.interestRateMonthly,
    encargoRealRecente: encReal,
    mesmoEvento: somaNoEventoDoMes(
      target, target.payments.map((p) => p.transaction.date),
      group.candidates.filter((t) => t.selected).map((t) => t.date), loan.interestRateMonthly,
    ),
  })
  const split = computeLinkSplit({
    installment: { amortization: target.amortization, openingBalance: target.openingBalance },
    rateMonthly: loan.interestRateMonthly, paidTotal: paidTotalGravado,
  })
  const tracked = installments.filter((i) => i.number >= startNumber)
  const agendaValida = storedScheduleValid(
    tracked, tracked[0]?.openingBalance ?? 0, loan.interestRateMonthly > 0, loan.rateType === 'POS',
  )

  return {
    loan: { contractNumber: loan.contractNumber, lender: loan.lender, rateType: loan.rateType },
    installment: {
      number: target.number, dueDate: target.dueDate, amortization: target.amortization, payment: target.payment,
      openingBalance: target.openingBalance, status: target.status, isEstimate: target.isEstimate,
    },
    openInstallments: openList.map((i) => ({ number: i.number, dueDate: i.dueDate, status: i.status })),
    candidates: group.candidates.map((t) => ({ id: t.id, description: t.description, amount: t.amount, date: t.date, selected: t.selected })),
    paidTotal: group.paidTotal,
    jaVinculado,
    paidTotalGravado,
    split,
    agendaValida,
    bloqueio,
    splitInjected: shouldWriteSplit({
      scheduleSource: loan.scheduleSource,
      isZeroRate: loan.interestRateMonthly === 0,
      agendaValida,
      isPartial: split.isPartial,
    }),
  }
}

export type PreviaDoVinculo = Awaited<ReturnType<typeof previaDoVinculo>>
