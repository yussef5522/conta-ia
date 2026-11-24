/**
 * ⭐⭐⭐ A SOBRA DO MÊS É ENCARGO DO MÊS, NÃO PARCELA SEGUINTE — CASO REAL DE 16/11 (24/11/2026)
 *
 * ```
 * C41022570-0 · Sicredi PRONAMPE · SAC · taxa 0,4868%/mês · agenda IMPORTED (interest 0)
 * #16 venc 15/11 · capital 4.166,66 · abertura 87.500,02 · fecha 83.333,36
 * 16/11  DEBIT 5.347,30  "LIQUIDACAO DE PARCELA-C41022570"   ⎫ o evento de novembro
 * 16/11  DEBIT   215,68  "AMORTIZACAO CONTRATO-C41022570"    ⎭ Σ 5.562,98
 * ```
 * ⛔ O defeito: a 2ª linha procurava parcela ABERTA e caía na #17 (dezembro) como "parcial —
 * capital". O banco manda: a #16 fica PAGA com 5.562,98 (encargos 1.396,32) e a #17 CHEIA.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { vincularPagamentoDeParcela, VinculoDeParcelaError } from '../vincular-pagamento'
import { parcelaDoEvento, somaNoEventoDoMes, bloqueioDoVinculo } from '../link-payment'
import { sugerirVinculoEmprestimo } from '../sugerir-vinculo'

const CNPJ = '50607080003311'
const TAXA = 0.004868
const CAP = 4166.66
const d = (s: string) => new Date(`${s}T12:00:00Z`)

let companyId = ''
let contaId = ''
let loanId = ''
let txLiq = ''
let txAmort = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'SOBRA DO MES' } })).id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', accountType: 'CHECKING', balance: 0 } })).id
  loanId = (await prisma.loan.create({
    data: {
      companyId, bankAccountId: contaId, lender: 'Sicredi', contractNumber: 'C41022570-0', principal: 150000,
      interestRateMonthly: TAXA, rateType: 'POS', termMonths: 36, disbursementDate: d('2024-08-15'),
      firstDueDate: d('2025-08-15'), amortizationSystem: 'SAC', scheduleSource: 'IMPORTED', installmentsPaidBefore: 12, status: 'ACTIVE',
    },
  })).id
  // #15 paga (out: 5.601,95 → encargo real 1.435,25), #16 e #17 abertas
  const linhas: [number, string, number, number][] = [[15, '2026-10-15', 4166.7, 91666.72], [16, '2026-11-15', CAP, 87500.02], [17, '2026-12-15', CAP, 83333.36]]
  for (const [n, venc, amort, abre] of linhas) {
    await prisma.loanInstallment.create({
      data: {
        loanId, number: n, dueDate: d(venc), openingBalance: abre, interest: 0, amortization: amort, payment: amort, closingBalance: Math.round((abre - amort) * 100) / 100,
        ...(n === 15 ? { status: 'PAID', paidDate: d('2026-10-15'), paidTotal: 5601.95, paidInterest: 446.23, paidCorrection: 989.02, paidPenalty: 0 } : {}),
      },
    })
  }
  const tx = (amount: number, description: string) => prisma.transaction.create({
    data: { bankAccountId: contaId, type: 'DEBIT', amount, date: d('2026-11-16'), description, origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING' },
  }).then((t) => t.id)
  txLiq = await tx(5347.3, 'LIQUIDACAO DE PARCELA-C41022570')
  txAmort = await tx(215.68, 'AMORTIZACAO CONTRATO-C41022570')
})
afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

const parcelasLite = async () => (await prisma.loanInstallment.findMany({ where: { loanId }, include: { payments: { include: { transaction: true } } } }))
  .map((p) => ({ number: p.number, dueDate: p.dueDate, payment: p.payment, status: p.status, paidTotal: p.paidTotal, interest: p.interest, rateMonthly: TAXA, diasPagos: p.payments.map((x) => x.transaction.date) }))
const loanLite = () => [{ id: loanId, contractNumber: 'C41022570-0', lender: 'Sicredi', status: 'ACTIVE', dueDay: null, bankAccountId: contaId }]

describe('a sobra do evento do mês fica na parcela do mês', () => {
  it('o palpite da 2ª linha aponta a #16 (encargo apurado), nunca a #17 como parcial', async () => {
    await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 16, transactionIds: [txLiq] })
    const s = sugerirVinculoEmprestimo(
      { description: 'AMORTIZACAO CONTRATO-C41022570', type: 'DEBIT', date: d('2026-11-16'), amount: 215.68, bankAccountId: contaId },
      loanLite(), { [loanId]: await parcelasLite() },
    )
    expect(s).toMatchObject({ kind: 'SUGERIDO', installmentNumber: 16, parcial: false })
  })

  it('a porta aceita somar na #16 já quitada: PAGA 5.562,98 = capital 4.166,66 + encargos 1.396,32; #17 fica CHEIA', async () => {
    await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 16, transactionIds: [txLiq] })
    const r = await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 16, transactionIds: [txAmort] })
    expect(r).toMatchObject({ status: 'PAID', paidTotal: 5562.98 })
    const p16 = await prisma.loanInstallment.findFirstOrThrow({ where: { loanId, number: 16 } })
    expect(p16).toMatchObject({ status: 'PAID', paidTotal: 5562.98, closingBalance: 83333.36 })
    expect(Math.round(((p16.paidInterest ?? 0) + (p16.paidCorrection ?? 0)) * 100) / 100).toBe(1396.32)
    const p17 = await prisma.loanInstallment.findFirstOrThrow({ where: { loanId, number: 17 }, include: { payments: true } })
    expect(p17).toMatchObject({ status: 'OPEN', paidTotal: null, payments: [] })
  })

  it('⛔ o dono AINDA pode mandar pra seguinte escolhendo a parcela na tela (installmentNumber explícito)', async () => {
    await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 16, transactionIds: [txLiq] })
    const r = await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 17, transactionIds: [txAmort] })
    expect(r.status).toBe('PARTIAL')
  })
})

describe('as bordas da régua (puro)', () => {
  const pagas = [
    { number: 16, dueDate: d('2026-11-15'), status: 'PAID', interest: 0, diasPagos: [d('2026-11-16')] },
    { number: 17, dueDate: d('2026-12-15'), status: 'OPEN', interest: 0, diasPagos: [] },
  ]
  it('o evento é o DIA do débito que quitou: outro dia, ou parcela do mês ABERTA → régua de sempre (null)', () => {
    expect(parcelaDoEvento(pagas, d('2026-11-16'), TAXA)?.number).toBe(16)
    expect(parcelaDoEvento(pagas, d('2026-11-17'), TAXA)).toBeNull()
    expect(parcelaDoEvento(pagas, d('2026-12-15'), TAXA)).toBeNull()
  })
  it('encargo CONHECIDO (juros na agenda) ou taxa 0 não entra', () => {
    expect(parcelaDoEvento([{ ...pagas[0], interest: 300 }], d('2026-11-16'), TAXA)).toBeNull()
    expect(parcelaDoEvento(pagas, d('2026-11-16'), 0)).toBeNull()
    expect(somaNoEventoDoMes({ interest: 0 }, [d('2026-11-16')], [d('2026-11-16')], TAXA)).toBe(true)
    expect(somaNoEventoDoMes({ interest: 0 }, [d('2026-11-16')], [d('2026-11-17')], TAXA)).toBe(false)
    expect(somaNoEventoDoMes({ interest: 0 }, [], [d('2026-11-16')], TAXA)).toBe(false)
  })
  it('⛔ mesmo evento NÃO afrouxa o teto: somar além dele continua SOMA_ESTOUROU', () => {
    const b = bloqueioDoVinculo({
      installmentNumber: 16, temVinculo11: false, status: 'PAID', jaVinculados: { quantos: 1, soma: 5347.3 },
      paidTotal: 20000, amortization: CAP, interest: 0, openingBalance: 87500.02, rateMonthly: TAXA, mesmoEvento: true,
    })
    expect(b?.code).toBe('SOMA_ESTOUROU')
    const fora = bloqueioDoVinculo({
      installmentNumber: 16, temVinculo11: false, status: 'PAID', jaVinculados: { quantos: 1, soma: 5347.3 },
      paidTotal: 5562.98, amortization: CAP, interest: 0, openingBalance: 87500.02, rateMonthly: TAXA, mesmoEvento: false,
    })
    expect(fora?.code).toBe('JA_QUITADA')
  })
})
