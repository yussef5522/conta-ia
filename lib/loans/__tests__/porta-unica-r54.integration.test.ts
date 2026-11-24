/**
 * ⭐⭐⭐ R54 + R55 — UMA PORTA SÓ PRA PAGAR PARCELA, E A AGENDA É SAGRADA (25/11/2026).
 * Lei: docs/emprestimos-referencia.html (header, R54/R55).
 *
 * ⛔ O que este teste EXECUTA (REGRA 3 — comportamento, nunca grep):
 *  1. o "marcar paga" (o mesmo fio que a rota usa) grava PEDAÇO N:1 + encargos apurados, e os
 *     campos da AGENDA (payment/interest/correcao/amortization/closingBalance) saem intactos;
 *  2. desfazer devolve TUDO (status, data, vínculo, paid*, realPayment) — e a agenda segue intacta;
 *  3. o casamento automático do OFX grava pela MESMA porta (pedaço N:1, nunca 1:1) e não reescreve
 *     a agenda do pós-fixado (era o `payment: realPayment` / `correcao` recalculada de antes);
 *  4. o parcial fica OPEN com o pago gravado — o status 'PARTIAL' (fora do schema) não nasce mais;
 *  5. a última parcela paga fecha o contrato (PAID_OFF) — quem fazia isso era a porta 1:1 que morreu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { vincularPagamentoDeParcela } from '../vincular-pagamento'
import { desfazerVinculoDeParcela } from '../desfazer-vinculo'
import { autoConciliarParcelas } from '../auto-conciliacao'

const CNPJ = '50607080002390'
const TAXA = 0.004868
const AGENDA = { openingBalance: 87500.02, interest: 0, amortization: 4166.66, correcao: 0, payment: 4166.66, closingBalance: 83333.36 }

let companyId: string
let contaId: string
let loanId: string

const marcarPaga = (n: number, transactionIds: string[]) =>
  prisma.$transaction((db) => vincularPagamentoDeParcela({ db, companyId, loanId, installmentNumber: n, transactionIds }))

const agendaDe = (n: number) =>
  prisma.loanInstallment.findFirstOrThrow({
    where: { loanId, number: n },
    select: {
      openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true,
      status: true, paidDate: true, reconciledTransactionId: true, realPayment: true,
      paidTotal: true, paidInterest: true, paidCorrection: true, paidPenalty: true,
      payments: { select: { transactionId: true, amount: true } },
    },
  })

const linha = async (desc: string, amount: number, dia = '2026-11-16') =>
  (await prisma.transaction.create({
    data: {
      bankAccountId: contaId, date: new Date(`${dia}T12:00:00Z`), description: desc, amount,
      type: 'DEBIT', status: 'PENDING', lifecycle: 'EFFECTED', origin: 'OFX',
    },
  })).id

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'PORTA UNICA R54' } })).id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', accountType: 'CHECKING', balance: 0 } })).id
  loanId = (await prisma.loan.create({
    data: {
      companyId, bankAccountId: contaId, lender: 'Sicredi', contractNumber: 'C41022570-0',
      principal: 150000, interestRateMonthly: TAXA, rateType: 'POS', indexer: 'SELIC', termMonths: 2,
      disbursementDate: new Date('2024-12-15T00:00:00Z'), firstDueDate: new Date('2026-11-15T00:00:00Z'),
      amortizationSystem: 'SAC', scheduleSource: 'IMPORTED', installmentsPaidBefore: 0, status: 'ACTIVE',
    },
  })).id
  await prisma.loanInstallment.create({ data: { loanId, number: 1, dueDate: new Date('2026-11-15T00:00:00Z'), status: 'OPEN', isEstimate: true, ...AGENDA } })
  await prisma.loanInstallment.create({
    data: {
      loanId, number: 2, dueDate: new Date('2026-12-15T00:00:00Z'), status: 'OPEN', isEstimate: true,
      openingBalance: 83333.36, interest: 0, amortization: 4166.66, correcao: 0, payment: 4166.66, closingBalance: 79166.70,
    },
  })
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐ marcar paga = porta única, e a agenda sai intacta (R54 + R55)', () => {
  it('grava pedaço N:1 + encargo apurado; payment/interest/correcao/amortization/closing NÃO mudam', async () => {
    const tx = await linha('LIQUIDACAO DE PARCELA-C41022570', 4800)
    const r = await marcarPaga(1, [tx])
    expect(r.status).toBe('PAID')

    const p = await agendaDe(1)
    expect(p.payments).toEqual([{ transactionId: tx, amount: 4800 }])
    expect(p.reconciledTransactionId, 'a porta 1:1 morreu').toBeNull()
    expect(p.status).toBe('PAID')
    expect(p.paidTotal).toBe(4800)
    // encargo apurado = pago − capital (pino P13 da lei: pago − capital; aqui 4.800,00 − 4.166,66 = 633,34, dentro do teto sem histórico)
    expect(Math.round(((p.paidInterest ?? 0) + (p.paidCorrection ?? 0)) * 100) / 100).toBe(633.34)
    // ⛔⛔ R55 — a agenda é a do banco
    expect({
      openingBalance: p.openingBalance, interest: p.interest, amortization: p.amortization,
      correcao: p.correcao, payment: p.payment, closingBalance: p.closingBalance,
    }).toEqual(AGENDA)
  })

  it('desfazer devolve TUDO — e a agenda continua a do banco', async () => {
    const tx = await linha('LIQUIDACAO DE PARCELA-C41022570', 4800)
    await marcarPaga(1, [tx])
    await prisma.$transaction((db) => desfazerVinculoDeParcela({ db, companyId, loanId, installmentNumber: 1 }))

    const p = await agendaDe(1)
    expect(p.payments).toEqual([])
    expect(p.status).toBe('OPEN')
    expect(p.paidDate).toBeNull()
    expect(p.reconciledTransactionId).toBeNull()
    expect([p.paidTotal, p.paidInterest, p.paidCorrection, p.paidPenalty, p.realPayment]).toEqual([null, null, null, null, null])
    expect({
      openingBalance: p.openingBalance, interest: p.interest, amortization: p.amortization,
      correcao: p.correcao, payment: p.payment, closingBalance: p.closingBalance,
    }).toEqual(AGENDA)
  })

  it('⛔ parcial fica OPEN com o pago gravado — o status PARTIAL não nasce mais', async () => {
    const tx = await linha('AMORTIZACAO CONTRATO-C61022527', 2000)
    const r = await marcarPaga(1, [tx])
    expect(r.isPartial).toBe(true)
    const p = await agendaDe(1)
    expect(p.status).toBe('OPEN')
    expect(p.paidTotal).toBe(2000)
    expect(p.closingBalance, 'o parcial também não escreve na agenda').toBe(AGENDA.closingBalance)
  })

  it('a última parcela paga fecha o contrato (PAID_OFF)', async () => {
    await marcarPaga(1, [await linha('LIQUIDACAO DE PARCELA-C41022570', 4800)])
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loanId } })).status).toBe('ACTIVE')
    await marcarPaga(2, [await linha('LIQUIDACAO DE PARCELA-C41022570', 4700, '2026-12-15')])
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loanId } })).status).toBe('PAID_OFF')
  })
})

describe('⭐ o casamento automático do OFX é a MESMA porta', () => {
  it('casa pelo nº do contrato → pedaço N:1 + encargo apurado, sem 1:1 e sem reescrever a agenda', async () => {
    const tx = await linha('LIQUIDACAO DE PARCELA-C41022570', 4300.12, '2026-11-15')
    const r = await autoConciliarParcelas(prisma, companyId, { sinceDays: 3650 })
    expect(r.matched.map((m) => m.transactionId)).toEqual([tx])

    const p = await agendaDe(1)
    expect(p.reconciledTransactionId).toBeNull()
    expect(p.payments).toEqual([{ transactionId: tx, amount: 4300.12 }])
    expect(p.paidTotal).toBe(4300.12)
    expect(p.realPayment, 'a marca do caminho 1:1 antigo').toBeNull()
    expect({
      openingBalance: p.openingBalance, interest: p.interest, amortization: p.amortization,
      correcao: p.correcao, payment: p.payment, closingBalance: p.closingBalance,
    }).toEqual(AGENDA)
  })
})
