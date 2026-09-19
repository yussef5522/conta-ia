// ⭐⭐ DESFAZER O VÍNCULO — a porta que faltava (19/09/2026)
//
// **O caso real que a criou:** a linha `LIQUIDACAO DE PARCELA-C41022570` (R$ 5.617,23) foi
// parar na parcela **#24 do C41022227-1** (vínculo cruzado, nascido do palpite cego). A #24
// ficou com **2 pagamentos somando R$ 12.520,68 e `paidTotal` R$ 5.617,23** — inconsistente.
//
// ⛔ O `DELETE` da rota antiga não servia: ele mexe só no caminho 1:1 e **deixa os
// `LoanInstallmentPayment` de pé** — parcela OPEN segurando pagamento é pior que o defeito.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { desfazerVinculoDeParcela, DesfazerVinculoError } from '@/lib/loans/desfazer-vinculo'
import { vincularPagamentoDeParcela } from '@/lib/loans/vincular-pagamento'

let companyId = ''
let loanId = ''
let contaId = ''
const txIds: string[] = []

beforeEach(async () => {
  const c = await prisma.company.create({ data: { name: 'Teste Desfazer', cnpj: `${Date.now()}`.slice(-14) } })
  companyId = c.id
  const conta = await prisma.bankAccount.create({
    data: { companyId, name: 'conta teste', bankName: 'Sicredi', accountType: 'CHECKING', balance: 0 },
  })
  contaId = conta.id
  const loan = await prisma.loan.create({
    data: {
      companyId, lender: 'Sicredi', contractNumber: 'C-TESTE-1', principal: 100000,
      interestRateMonthly: 0.01, termMonths: 3, firstDueDate: new Date('2026-09-14'), disbursementDate: new Date('2026-07-14'),
      status: 'ACTIVE', amortizationSystem: 'SAC', rateType: 'PRE',
      bankAccountId: contaId, scheduleSource: 'IMPORTED', installmentsPaidBefore: 0,
      installments: {
        create: [{
          number: 1, dueDate: new Date('2026-09-14'), status: 'OPEN',
          openingBalance: 100000, amortization: 4166.64, interest: 0, payment: 4166.64, closingBalance: 95833.36,
        }],
      },
    },
  })
  loanId = loan.id
  for (const valor of [5617.23, 6903.45]) {
    const t = await prisma.transaction.create({
      data: {
        bankAccountId: contaId, date: new Date('2026-09-15'), amount: valor, type: 'DEBIT',
        description: `LIQUIDACAO DE PARCELA-${valor}`, lifecycle: 'EFFECTED', status: 'PENDING', origin: 'OFX',
      },
    })
    txIds.push(t.id)
  }
})

afterEach(async () => {
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  txIds.length = 0
})

describe('⭐⭐ desfazer devolve a parcela ao estado de quem NUNCA foi paga', () => {
  it('⭐ o caso real: 2 pagamentos na parcela, solto UM, o outro é re-vinculado pela porta única', async () => {
    // reproduz o estado de prod: os dois lançamentos na MESMA parcela
    await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 1, transactionIds: [txIds[0]] })
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: (await prisma.loanInstallment.findFirstOrThrow({ where: { loanId, number: 1 } })).id, transactionId: txIds[1], amount: 6903.45 },
    })
    const antes = await prisma.loanInstallment.findFirstOrThrow({
      where: { loanId, number: 1 }, select: { paidTotal: true, payments: { select: { amount: true } } },
    })
    const soma = antes.payments.reduce((s, p) => s + p.amount, 0)
    expect(soma, 'o cenário tem que reproduzir a inconsistência').toBeCloseTo(12520.68, 2)
    expect(antes.paidTotal, 'paidTotal diverge da soma — é o defeito de prod').not.toBeCloseTo(soma, 2)

    // ⭐ solto o CRUZADO
    const r = await desfazerVinculoDeParcela({ companyId, loanId, installmentNumber: 1, transactionIds: [txIds[0]] })
    expect(r.soltos).toBe(1)
    expect(r.restantes).toEqual([txIds[1]])

    const meio = await prisma.loanInstallment.findFirstOrThrow({
      where: { loanId, number: 1 },
      select: { status: true, paidTotal: true, paidInterest: true, paidDate: true, payments: { select: { id: true } } },
    })
    // ⛔ a parcela volta a "nunca paga" — split limpo, nada de remendo
    expect(meio.status).toBe('OPEN')
    expect(meio.paidTotal).toBeNull()
    expect(meio.paidInterest).toBeNull()
    expect(meio.paidDate).toBeNull()
    expect(meio.payments, 'o pagamento que sobrou continua lá — quem recalcula é o re-vínculo').toHaveLength(1)

    // ⭐ e o que sobrou é re-gravado pela PORTA ÚNICA, que recalcula o split do zero
    await desfazerVinculoDeParcela({ companyId, loanId, installmentNumber: 1 })
    await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 1, transactionIds: [txIds[1]] })
    const fim = await prisma.loanInstallment.findFirstOrThrow({
      where: { loanId, number: 1 }, select: { status: true, paidTotal: true, payments: { select: { amount: true } } },
    })
    expect(fim.paidTotal).toBeCloseTo(6903.45, 2)
    expect(fim.payments).toHaveLength(1)
    expect(fim.paidTotal, 'agora o paidTotal BATE com a soma dos pagamentos')
      .toBeCloseTo(fim.payments.reduce((s, p) => s + p.amount, 0), 2)
  })

  it('⭐ e a linha solta fica LIVRE pra ser vinculada no contrato certo', async () => {
    await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 1, transactionIds: [txIds[0]] })
    await desfazerVinculoDeParcela({ companyId, loanId, installmentNumber: 1 })
    // ⛔ antes do fix, a 2ª tentativa batia em "já vinculada" pra sempre
    const r = await vincularPagamentoDeParcela({ db: prisma, companyId, loanId, installmentNumber: 1, transactionIds: [txIds[0]] })
    expect(r.linked).toBe(1)
  })

  it('⛔ parcela sem vínculo nenhum recusa ENSINANDO, não em silêncio', async () => {
    await expect(desfazerVinculoDeParcela({ companyId, loanId, installmentNumber: 1 }))
      .rejects.toThrow(DesfazerVinculoError)
    await expect(desfazerVinculoDeParcela({ companyId, loanId, installmentNumber: 1 }))
      .rejects.toThrow(/não tem vínculo nenhum/)
  })

  it('⛔ contrato de OUTRA empresa é recusado (REGRA 8: posse por id + empresa)', async () => {
    await expect(desfazerVinculoDeParcela({ companyId: 'outra-empresa', loanId, installmentNumber: 1 }))
      .rejects.toThrow(/não encontrado nesta empresa/i)
  })
})
