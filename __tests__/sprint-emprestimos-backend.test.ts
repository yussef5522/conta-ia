// Sprint Empréstimos Backend (17/06/2026) — testes do motor + integração DRE.
//
// 4 blocos:
//   1) Motor amortização PRICE/SAC (puro)
//   2) Enrichment DRE (loan-context → tx flags)
//   3) DRE com loan flags (disbursement fora; só juros entra)
//   4) Integração: schema + import OFX + auto-conciliacao (presence)

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  generateSchedule,
  sumAmortizations,
  computePricePMT,
  computeOutstandingBalance,
  addMonths,
} from '@/lib/loans/amortization'
import { enrichTransactionsForDRE } from '@/lib/loans/dre-enrichment'
import { calculateDRE } from '@/lib/dre/calculator'
import type {
  TransactionForDRE,
  CategoryForDRE,
  CalculateDREOptions,
} from '@/lib/dre/types'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')

// ============================================================================
// 1) Motor amortização
// ============================================================================
describe('Sprint Empréstimos — motor PRICE', () => {
  it('PMT = P*i / (1 - (1+i)^-n) — caso 100k / 2,5% a.m. / 12 meses', () => {
    const pmt = computePricePMT(100000, 0.025, 12)
    // PRICE PMT = P*i / (1-(1+i)^-n) = 100000*0.025/(1-1.025^-12) ≈ 9748,71
    expect(pmt).toBeCloseTo(9748.71, 1)
  })

  it('100k / 2,5% / 12 PRICE → SUM(amortizations) === 100000.00 (exato)', () => {
    const sch = generateSchedule({
      principal: 100000,
      rateMonthly: 0.025,
      termMonths: 12,
      system: 'PRICE',
      firstDueDate: D('2026-08-01'),
    })
    expect(sch).toHaveLength(12)
    expect(sumAmortizations(sch)).toBe(100000)
    // Última parcela: closing zera
    expect(sch[11].closingBalance).toBe(0)
  })

  it('Parcela #1 PRICE: openingBalance=principal, interest=P*i, amort=PMT-juros', () => {
    const sch = generateSchedule({
      principal: 100000,
      rateMonthly: 0.025,
      termMonths: 12,
      system: 'PRICE',
      firstDueDate: D('2026-08-01'),
    })
    expect(sch[0].openingBalance).toBe(100000)
    expect(sch[0].interest).toBeCloseTo(2500, 1) // 100k * 2,5%
    expect(sch[0].number).toBe(1)
    expect(sch[0].dueDate).toEqual(D('2026-08-01'))
  })

  it('PRICE com taxa 0 → parcela = P/n (sem juros)', () => {
    const sch = generateSchedule({
      principal: 1200,
      rateMonthly: 0,
      termMonths: 12,
      system: 'PRICE',
      firstDueDate: D('2026-08-01'),
    })
    expect(sumAmortizations(sch)).toBe(1200)
    expect(sch.every((r) => r.payment === 100)).toBe(true)
    expect(sch.every((r) => r.interest === 0)).toBe(true)
  })
})

describe('Sprint Empréstimos — motor SAC', () => {
  it('100k / 2,5% / 12 SAC: 1ª parcela amort=8333.33 juros=2500', () => {
    const sch = generateSchedule({
      principal: 100000,
      rateMonthly: 0.025,
      termMonths: 12,
      system: 'SAC',
      firstDueDate: D('2026-08-01'),
    })
    expect(sch[0].amortization).toBeCloseTo(8333.33, 1)
    expect(sch[0].interest).toBeCloseTo(2500, 1)
    expect(sch[0].payment).toBeCloseTo(10833.33, 1)
  })

  it('SAC: parcela decresce (interest cai conforme saldo cai)', () => {
    const sch = generateSchedule({
      principal: 100000,
      rateMonthly: 0.025,
      termMonths: 12,
      system: 'SAC',
      firstDueDate: D('2026-08-01'),
    })
    for (let i = 1; i < sch.length; i++) {
      expect(sch[i].payment).toBeLessThan(sch[i - 1].payment + 0.01)
    }
  })

  it('SAC: SUM(amortizations) === principal exato', () => {
    const sch = generateSchedule({
      principal: 100000,
      rateMonthly: 0.025,
      termMonths: 12,
      system: 'SAC',
      firstDueDate: D('2026-08-01'),
    })
    expect(sumAmortizations(sch)).toBe(100000)
    expect(sch[11].closingBalance).toBe(0)
  })

  it('SAC valor não-redondo: SUM == principal mesmo com arredondamento', () => {
    const sch = generateSchedule({
      principal: 12345.67,
      rateMonthly: 0.018,
      termMonths: 24,
      system: 'SAC',
      firstDueDate: D('2026-08-01'),
    })
    expect(sumAmortizations(sch)).toBe(12345.67)
    expect(sch[23].closingBalance).toBe(0)
  })
})

describe('Sprint Empréstimos — utilitários', () => {
  it('addMonths preserva dia + encolhe quando excede', () => {
    expect(addMonths(D('2026-01-31'), 1)).toEqual(D('2026-02-28'))
    expect(addMonths(D('2026-08-15'), 3)).toEqual(D('2026-11-15'))
    expect(addMonths(D('2026-12-15'), 1)).toEqual(D('2027-01-15')) // virada de ano
  })

  it('computeOutstandingBalance = principal − SUM(amort PAID)', () => {
    expect(computeOutstandingBalance(100000, [10000, 5000])).toBe(85000)
    expect(computeOutstandingBalance(100000, [])).toBe(100000)
  })

  it('throws com inputs inválidos', () => {
    expect(() =>
      generateSchedule({ principal: 0, rateMonthly: 0.025, termMonths: 12, system: 'PRICE', firstDueDate: D('2026-08-01') }),
    ).toThrow(/principal/)
    expect(() =>
      generateSchedule({ principal: 1000, rateMonthly: -0.01, termMonths: 12, system: 'PRICE', firstDueDate: D('2026-08-01') }),
    ).toThrow(/rateMonthly/)
    expect(() =>
      generateSchedule({ principal: 1000, rateMonthly: 0.025, termMonths: 0, system: 'PRICE', firstDueDate: D('2026-08-01') }),
    ).toThrow(/termMonths/)
  })
})

// ============================================================================
// 2) Enrichment DRE
// ============================================================================
describe('Sprint Empréstimos — enrichment DRE', () => {
  const baseTx = (id: string, overrides: Partial<TransactionForDRE> = {}): TransactionForDRE => ({
    id,
    type: 'CREDIT',
    amount: 100,
    date: D('2026-08-01'),
    competenceDate: null,
    paymentDate: D('2026-08-01'),
    categoryId: 'cat-1',
    ...overrides,
  })

  it('marca isLoanDisbursement=true quando disbursementTransactionId bate', () => {
    const result = enrichTransactionsForDRE(
      [baseTx('tx-1'), baseTx('tx-2')],
      { loans: [{ disbursementTransactionId: 'tx-1' }], installments: [] },
    )
    expect(result[0].isLoanDisbursement).toBe(true)
    expect(result[1].isLoanDisbursement).toBeUndefined()
  })

  it('marca loanInterestSplit quando reconciledTransactionId bate', () => {
    const result = enrichTransactionsForDRE(
      [baseTx('tx-1', { type: 'DEBIT', amount: 9744.87 })],
      { loans: [], installments: [{ reconciledTransactionId: 'tx-1', interest: 2500 }] },
    )
    expect(result[0].loanInterestSplit).toBe(2500)
  })

  it('não muta o input original (função pura)', () => {
    const tx = baseTx('tx-1')
    enrichTransactionsForDRE([tx], { loans: [{ disbursementTransactionId: 'tx-1' }], installments: [] })
    expect(tx.isLoanDisbursement).toBeUndefined()
  })
})

// ============================================================================
// 3) DRE honrando flags
// ============================================================================
describe('Sprint Empréstimos — DRE filtra disbursement e split de juros', () => {
  const categorias: CategoryForDRE[] = [
    { id: 'cat-receita', name: 'Receita de Vendas', code: null, dreGroup: 'RECEITA_BRUTA', parentId: null, isActive: true, type: 'CREDIT' },
    { id: 'cat-juros', name: 'Juros sobre Empréstimos', code: null, dreGroup: 'DESPESAS_FINANCEIRAS', parentId: null, isActive: true, type: 'DEBIT' },
  ]
  const period = { startDate: D('2026-08-01'), endDate: D('2026-08-31'), regime: 'cash' as const }
  const opts: CalculateDREOptions = { period, comparison: { type: 'none' } }

  it('LIBERAÇÃO de empréstimo (CREDIT 100k) NÃO entra na receita', () => {
    const txs: TransactionForDRE[] = [
      // Receita real
      { id: 'rcb1', type: 'CREDIT', amount: 50000, date: D('2026-08-10'), competenceDate: null, paymentDate: D('2026-08-10'), categoryId: 'cat-receita' },
      // Liberação (não deve entrar)
      { id: 'lib1', type: 'CREDIT', amount: 100000, date: D('2026-08-01'), competenceDate: null, paymentDate: D('2026-08-01'), categoryId: 'cat-receita', isLoanDisbursement: true },
    ]
    const dre = calculateDRE(txs, categorias, opts)
    const receita = dre.groups.find((g) => g.group === 'RECEITA_BRUTA')
    expect(receita).toBeDefined()
    expect(receita!.total).toBe(50000) // só a venda real
  })

  it('PARCELA DEBIT 9744.87 com loanInterestSplit=2500 → DRE conta SÓ 2500', () => {
    const txs: TransactionForDRE[] = [
      { id: 'parc1', type: 'DEBIT', amount: 9748.71, date: D('2026-08-15'), competenceDate: null, paymentDate: D('2026-08-15'), categoryId: 'cat-juros', loanInterestSplit: 2500 },
    ]
    const dre = calculateDRE(txs, categorias, opts)
    const finan = dre.groups.find((g) => g.group === 'DESPESAS_FINANCEIRAS')
    expect(finan).toBeDefined()
    expect(finan!.total).toBe(2500) // só juros — amortização 7244,87 fora
  })

  it('Cenário completo: liberação + 1 parcela + 1 venda', () => {
    const txs: TransactionForDRE[] = [
      { id: 'lib', type: 'CREDIT', amount: 100000, date: D('2026-08-01'), competenceDate: null, paymentDate: D('2026-08-01'), categoryId: 'cat-receita', isLoanDisbursement: true },
      { id: 'venda', type: 'CREDIT', amount: 30000, date: D('2026-08-15'), competenceDate: null, paymentDate: D('2026-08-15'), categoryId: 'cat-receita' },
      { id: 'parc', type: 'DEBIT', amount: 9748.71, date: D('2026-08-20'), competenceDate: null, paymentDate: D('2026-08-20'), categoryId: 'cat-juros', loanInterestSplit: 2500 },
    ]
    const dre = calculateDRE(txs, categorias, opts)
    const receita = dre.groups.find((g) => g.group === 'RECEITA_BRUTA')!.total
    const finan = dre.groups.find((g) => g.group === 'DESPESAS_FINANCEIRAS')!.total
    expect(receita).toBe(30000)   // SÓ a venda
    expect(finan).toBe(2500)      // SÓ os juros
  })

  it('loanInterestSplit=0 (parcela só amortização sem juros) → ignora', () => {
    const txs: TransactionForDRE[] = [
      { id: 'p', type: 'DEBIT', amount: 8333.33, date: D('2026-08-15'), competenceDate: null, paymentDate: D('2026-08-15'), categoryId: 'cat-juros', loanInterestSplit: 0 },
    ]
    const dre = calculateDRE(txs, categorias, opts)
    const finan = dre.groups.find((g) => g.group === 'DESPESAS_FINANCEIRAS')
    expect(finan).toBeUndefined() // não criou grupo
  })

  it('regressão: TRANSFER continua excluído (não inflado)', () => {
    const txs: TransactionForDRE[] = [
      { id: 'venda', type: 'CREDIT', amount: 30000, date: D('2026-08-15'), competenceDate: null, paymentDate: D('2026-08-15'), categoryId: 'cat-receita' },
      { id: 'tr', type: 'TRANSFER', amount: 50000, date: D('2026-08-10'), competenceDate: null, paymentDate: D('2026-08-10'), categoryId: 'cat-receita' },
    ]
    const dre = calculateDRE(txs, categorias, opts)
    const receita = dre.groups.find((g) => g.group === 'RECEITA_BRUTA')!.total
    expect(receita).toBe(30000)
  })
})

// ============================================================================
// 4) Integração: schema + importer + auto-conciliacao (presence)
// ============================================================================
describe('Sprint Empréstimos — schema + integração', () => {
  it('Migration cria loans + loan_installments', () => {
    const sql = readFileSync(
      join(__dirname, '..', 'prisma/migrations/20260624000000_loans/migration.sql'),
      'utf-8',
    )
    expect(sql).toMatch(/CREATE TABLE "loans"/)
    expect(sql).toMatch(/CREATE TABLE "loan_installments"/)
    expect(sql).toMatch(/"amortizationSystem"\s+TEXT/)
    expect(sql).toMatch(/"loan_installments_loanId_number_key"/)
    expect(sql).toMatch(/"loans_disbursementTransactionId_key"/)
  })

  it('schema.prisma define Loan + LoanInstallment + relações inversas', () => {
    const schema = readFileSync(join(__dirname, '..', 'prisma/schema.prisma'), 'utf-8')
    expect(schema).toMatch(/model Loan \{/)
    expect(schema).toMatch(/model LoanInstallment \{/)
    expect(schema).toMatch(/loans\s+Loan\[\]/)
    expect(schema).toMatch(/loanDisbursement\s+Loan\?/)
    expect(schema).toMatch(/loanInstallmentPaid\s+LoanInstallment\?/)
  })

  it('Importer OFX chama autoConciliarParcelas após createMany', () => {
    const code = readFileSync(
      join(__dirname, '..', 'app/api/contas-bancarias/[id]/importar-ofx/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/import\(['"]@\/lib\/loans\/auto-conciliacao['"]\)/)
    expect(code).toMatch(/autoConciliarParcelas\(prisma,\s*conta\.companyId\)/)
    expect(code).toMatch(/auto-conciliação empréstimo falhou/)
  })

  it('auto-conciliacao.ts exporta autoConciliarParcelas + computeOutstandingBalance', () => {
    const code = readFileSync(join(__dirname, '..', 'lib/loans/auto-conciliacao.ts'), 'utf-8')
    expect(code).toMatch(/export async function autoConciliarParcelas/)
    expect(code).toMatch(/export async function computeOutstandingBalance/)
    expect(code).toMatch(/CONTRACT_NUMBER|EXACT_AMOUNT_DATE|AMBIGUOUS_AMOUNT_DATE/)
  })

  it('TransactionForDRE tem isLoanDisbursement + loanInterestSplit opcionais', () => {
    const code = readFileSync(join(__dirname, '..', 'lib/dre/types.ts'), 'utf-8')
    expect(code).toMatch(/isLoanDisbursement\?:\s*boolean/)
    expect(code).toMatch(/loanInterestSplit\?:\s*number/)
  })

  it('calculator.ts honra isLoanDisbursement + loanInterestSplit', () => {
    const code = readFileSync(join(__dirname, '..', 'lib/dre/calculator.ts'), 'utf-8')
    expect(code).toMatch(/tx\.isLoanDisbursement/)
    expect(code).toMatch(/loanInterestSplit/)
  })
})
