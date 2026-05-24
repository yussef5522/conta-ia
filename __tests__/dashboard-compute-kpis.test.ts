import { describe, it, expect } from 'vitest'
import { computeKPIsFromData } from '@/lib/dashboard/compute-kpis'
import { derivePeriods } from '@/lib/dashboard/period'
import type { CategoryForDRE, TransactionForDRE } from '@/lib/dre/types'
import type { CashflowTransaction } from '@/lib/cashflow/consolidated'

const REF = new Date('2026-05-15T12:00:00Z')

const RECEITA: CategoryForDRE = {
  id: 'cat-rec',
  name: 'Mensalidades',
  code: '3.01',
  dreGroup: 'RECEITA_BRUTA',
  parentId: null,
  isActive: true,
  type: 'CREDIT',
}
const DESPESA: CategoryForDRE = {
  id: 'cat-desp',
  name: 'Folha',
  code: '4.01',
  dreGroup: 'DESPESAS_PESSOAL',
  parentId: null,
  isActive: true,
  type: 'DEBIT',
}

function txDRE(
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER',
  amount: number,
  date: string,
  categoryId: string | null = null,
): TransactionForDRE {
  const d = new Date(date)
  return {
    id: `dre-${date}-${amount}`,
    type,
    amount,
    date: d,
    competenceDate: d,
    paymentDate: null,
    categoryId,
  }
}

function txCash(
  type: 'CREDIT' | 'DEBIT',
  amount: number,
  date: string,
): CashflowTransaction {
  return { id: `cf-${date}-${amount}`, type, amount, date: new Date(date) }
}

describe('computeKPIsFromData — Sprint 1 Dia 1', () => {
  it('saldo atual vem do accountsBalanceTotal (cache do banco)', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 50_000,
      categories: [],
      transactionsForDRE: [],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.saldoAtual.value).toBe(50_000)
  })

  it('receita do mês = soma de CREDIT em RECEITA_BRUTA (regime competência)', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [RECEITA],
      transactionsForDRE: [
        txDRE('CREDIT', 10_000, '2026-05-10', RECEITA.id),
        txDRE('CREDIT', 5_000, '2026-05-20', RECEITA.id),
      ],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.receitaMes.value).toBe(15_000)
  })

  it('despesas = custos + despesas operacionais', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [DESPESA],
      transactionsForDRE: [
        txDRE('DEBIT', 3_000, '2026-05-10', DESPESA.id),
        txDRE('DEBIT', 2_000, '2026-05-20', DESPESA.id),
      ],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.despesasMes.value).toBe(5_000)
  })

  it('resultado = resultado operacional (receita - deduções - CMV - despesas operacionais)', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [RECEITA, DESPESA],
      transactionsForDRE: [
        txDRE('CREDIT', 10_000, '2026-05-10', RECEITA.id),
        txDRE('DEBIT', 3_000, '2026-05-15', DESPESA.id),
      ],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    // Sem deduções/financeiras/impostos no cenário:
    // resultadoOperacional = receita - despesa operacional = 10k - 3k = 7k
    expect(r.resultadoMes.value).toBe(7_000)
  })

  it('TRANSFER NÃO infla receita/despesa do KPI (defesa em profundidade)', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [RECEITA],
      transactionsForDRE: [
        txDRE('CREDIT', 5_000, '2026-05-10', RECEITA.id),
        txDRE('TRANSFER', 50_000, '2026-05-10', RECEITA.id),
      ],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.receitaMes.value).toBe(5_000) // TRANSFER skipada pelo engine DRE
  })

  it('delta de receita: 15k atual vs 10k anterior → +5k, +50%, direction=up', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [RECEITA],
      transactionsForDRE: [
        txDRE('CREDIT', 10_000, '2026-04-15', RECEITA.id), // mês anterior
        txDRE('CREDIT', 15_000, '2026-05-15', RECEITA.id), // mês atual
      ],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.receitaMes.delta.absolute).toBe(5_000)
    expect(r.receitaMes.delta.percent).toBe(50)
    expect(r.receitaMes.delta.direction).toBe('up') // higher-is-better
  })

  it('delta de despesa: 5k atual vs 8k anterior → -3k, mas direction=up (lower-is-better)', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [DESPESA],
      transactionsForDRE: [
        txDRE('DEBIT', 8_000, '2026-04-15', DESPESA.id),
        txDRE('DEBIT', 5_000, '2026-05-15', DESPESA.id),
      ],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.despesasMes.delta.absolute).toBe(-3_000)
    expect(r.despesasMes.delta.direction).toBe('up') // despesa caiu = bom
  })

  it('delta com mês anterior zerado → percent=null mas direction calculável', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [RECEITA],
      transactionsForDRE: [txDRE('CREDIT', 1_000, '2026-05-15', RECEITA.id)],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.receitaMes.delta.absolute).toBe(1_000)
    expect(r.receitaMes.delta.percent).toBeNull()
    expect(r.receitaMes.delta.direction).toBe('up')
  })

  it('sparkline receita 12m: 12 buckets fixos com gaps preenchidos por 0', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [],
      transactionsForDRE: [],
      transactionsLast30d: [],
      transactionsLast12m: [txCash('CREDIT', 5_000, '2026-05-10')],
    })
    expect(r.receitaMes.spark).toHaveLength(12)
    // Mês corrente é o último bucket (índice 11) — deve ter o valor
    expect(r.receitaMes.spark[11].value).toBe(5_000)
    // Bucket 0 (jun/2025) → 0
    expect(r.receitaMes.spark[0].value).toBe(0)
  })

  it('sparkline saldo 30d: 30 buckets cumulativos terminando no saldo atual', () => {
    // 1 entrada de 1k há 5 dias. Saldo atual 10k. Saldo de 30 dias atrás era 9k.
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 10_000,
      categories: [],
      transactionsForDRE: [],
      transactionsLast30d: [txCash('CREDIT', 1_000, '2026-05-10')],
      transactionsLast12m: [],
    })
    expect(r.saldoAtual.spark).toHaveLength(30)
    // Último bucket = saldo atual
    expect(r.saldoAtual.spark[29].value).toBe(10_000)
    // Primeiro bucket = saldo 30 dias atrás = 10k - 1k = 9k
    expect(r.saldoAtual.spark[0].value).toBe(9_000)
  })

  it('margem líquida: 7k resultado / 10k receita = 70%', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [RECEITA, DESPESA],
      transactionsForDRE: [
        txDRE('CREDIT', 10_000, '2026-05-10', RECEITA.id),
        txDRE('DEBIT', 3_000, '2026-05-12', DESPESA.id),
      ],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.margemLiquida).toBe(70)
  })

  it('margem com receita zero → 0 (não NaN)', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-1',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [],
      transactionsForDRE: [],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.margemLiquida).toBe(0)
  })

  it('companyId vazio LANÇA (multi-tenant guard)', () => {
    expect(() =>
      computeKPIsFromData({
        companyId: '',
        referenceDate: REF,
        periods: derivePeriods(REF),
        accountsBalanceTotal: 0,
        categories: [],
        transactionsForDRE: [],
        transactionsLast30d: [],
        transactionsLast12m: [],
      }),
    ).toThrow(/multi-tenant/i)
  })

  it('result.companyId === input.companyId (rastreabilidade)', () => {
    const r = computeKPIsFromData({
      companyId: 'comp-academia-3',
      referenceDate: REF,
      periods: derivePeriods(REF),
      accountsBalanceTotal: 0,
      categories: [],
      transactionsForDRE: [],
      transactionsLast30d: [],
      transactionsLast12m: [],
    })
    expect(r.companyId).toBe('comp-academia-3')
  })
})
