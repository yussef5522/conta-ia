// Sprint 5.0.2.d — Tests do data aggregator (função pura, sem DB).

import { describe, it, expect } from 'vitest'
import {
  aggregateFromTransactions,
  type TxLite,
} from '@/lib/tax/ai-analysis/data-aggregator'

const PERIOD_START = new Date('2025-05-25T00:00:00Z')
const PERIOD_END = new Date('2026-05-25T00:00:00Z')

function tx(overrides: Partial<TxLite>): TxLite {
  return {
    amount: 0,
    type: 'DEBIT',
    paymentDate: new Date('2026-01-15T00:00:00Z'),
    date: new Date('2026-01-15T00:00:00Z'),
    description: null,
    competenceDate: null,
    category: null,
    supplier: null,
    ...overrides,
  }
}

describe('aggregateFromTransactions — receitas e despesas', () => {
  it('soma CREDIT como receita, DEBIT como despesa', () => {
    const txs: TxLite[] = [
      tx({ amount: 1000, type: 'CREDIT' }),
      tx({ amount: 500, type: 'CREDIT' }),
      tx({ amount: 300, type: 'DEBIT' }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.receitaTotal).toBe(1500)
    expect(r.despesaTotal).toBe(300)
    expect(r.margemBruta).toBeCloseTo((1500 - 300) / 1500)
  })

  it('IGNORA TRANSFER (não infla receita/despesa)', () => {
    const txs: TxLite[] = [
      tx({ amount: 1000, type: 'CREDIT' }),
      tx({ amount: 999, type: 'TRANSFER' }), // não conta
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.receitaTotal).toBe(1000)
  })

  it('receitaMensalMedia = receitaTotal / monthsBack', () => {
    const txs: TxLite[] = [tx({ amount: 12000, type: 'CREDIT' })]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.receitaMensalMedia).toBe(1000)
  })

  it('margemBruta = 0 quando receita = 0 (sem div by zero)', () => {
    const txs: TxLite[] = [tx({ amount: 100, type: 'DEBIT' })]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.margemBruta).toBe(0)
  })
})

describe('aggregateFromTransactions — agrupamentos', () => {
  it('agrupa receita por mês (sorted asc)', () => {
    const txs: TxLite[] = [
      tx({
        amount: 100,
        type: 'CREDIT',
        paymentDate: new Date('2026-03-15T00:00:00Z'),
      }),
      tx({
        amount: 200,
        type: 'CREDIT',
        paymentDate: new Date('2026-03-20T00:00:00Z'),
      }),
      tx({
        amount: 50,
        type: 'CREDIT',
        paymentDate: new Date('2026-01-10T00:00:00Z'),
      }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.receitaPorMes).toEqual([
      { mes: '2026-01', valor: 50 },
      { mes: '2026-03', valor: 300 },
    ])
  })

  it('agrupa despesa por categoria (sorted desc), com %', () => {
    const aluguel = { name: 'Aluguel', dreGroup: 'DESPESAS_OCUPACAO' }
    const energia = { name: 'Energia', dreGroup: 'DESPESAS_OCUPACAO' }
    const txs: TxLite[] = [
      tx({ amount: 1000, type: 'DEBIT', category: aluguel }),
      tx({ amount: 200, type: 'DEBIT', category: aluguel }),
      tx({ amount: 300, type: 'DEBIT', category: energia }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.despesasPorCategoria[0]).toMatchObject({
      category: 'Aluguel',
      valor: 1200,
    })
    expect(r.despesasPorCategoria[0].pct).toBeCloseTo(80)
    expect(r.despesasPorCategoria[1].category).toBe('Energia')
  })

  it('categoria null vira "Sem categoria"', () => {
    const txs: TxLite[] = [tx({ amount: 500, type: 'DEBIT', category: null })]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.despesasPorCategoria[0].category).toBe('Sem categoria')
  })
})

describe('aggregateFromTransactions — folha identificada', () => {
  it('soma despesas com dreGroup DESPESAS_PESSOAL/CUSTO_PESSOAL/PRO_LABORE', () => {
    const txs: TxLite[] = [
      tx({
        amount: 5000,
        type: 'DEBIT',
        category: { name: 'Salário Funcionário', dreGroup: 'DESPESAS_PESSOAL' },
      }),
      tx({
        amount: 3000,
        type: 'DEBIT',
        category: { name: 'Pró-labore Sócio', dreGroup: 'PRO_LABORE' },
      }),
      tx({
        amount: 100,
        type: 'DEBIT',
        category: { name: 'Outros', dreGroup: 'OUTROS' },
      }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.folhaIdentificada).toBe(8000)
  })

  it('detecta por keyword no nome se dreGroup não bater', () => {
    const txs: TxLite[] = [
      tx({
        amount: 2000,
        type: 'DEBIT',
        category: { name: 'INSS Patronal', dreGroup: 'OUTROS' },
      }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.folhaIdentificada).toBe(2000)
  })
})

describe('aggregateFromTransactions — top fornecedores', () => {
  it('agrupa por supplier.razaoSocial, sorted desc, max 10', () => {
    const sup = (nome: string) => ({ razaoSocial: nome })
    const txs: TxLite[] = [
      tx({ amount: 1000, type: 'DEBIT', supplier: sup('Sysco') }),
      tx({ amount: 500, type: 'DEBIT', supplier: sup('Sysco') }),
      tx({ amount: 800, type: 'DEBIT', supplier: sup('Ambev') }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.fornecedoresTop[0]).toMatchObject({
      nome: 'Sysco',
      valor12m: 1500,
      transacoes: 2,
    })
    expect(r.fornecedoresTop[1].nome).toBe('Ambev')
  })

  it('fallback pra description quando não há supplier', () => {
    const txs: TxLite[] = [
      tx({ amount: 100, type: 'DEBIT', supplier: null, description: 'PIX SUPERMERCADO XYZ' }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.fornecedoresTop[0].nome).toContain('SUPERMERCADO')
  })

  it('limita a 10', () => {
    const txs: TxLite[] = Array.from({ length: 15 }, (_, i) =>
      tx({
        amount: 100 + i,
        type: 'DEBIT',
        supplier: { razaoSocial: `Fornecedor ${i}` },
      }),
    )
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.fornecedoresTop).toHaveLength(10)
  })
})

describe('aggregateFromTransactions — impostos detectados', () => {
  it('detecta DAS Simples', () => {
    const txs: TxLite[] = [
      tx({ amount: 5000, type: 'DEBIT', description: 'Pagamento DAS Simples Nacional 03/2026' }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.impostosDetectados.find((i) => i.tipo === 'DAS Simples')?.valor12m).toBe(5000)
  })

  it('detecta INSS, FGTS, ICMS, ISS', () => {
    const txs: TxLite[] = [
      tx({ amount: 1000, type: 'DEBIT', description: 'INSS competência 02/2026' }),
      tx({ amount: 500, type: 'DEBIT', description: 'FGTS folha' }),
      tx({ amount: 2000, type: 'DEBIT', description: 'GUIA ICMS RS' }),
      tx({ amount: 300, type: 'DEBIT', description: 'ISS prefeitura' }),
    ]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    const tipos = r.impostosDetectados.map((i) => i.tipo)
    expect(tipos).toContain('INSS')
    expect(tipos).toContain('FGTS')
    expect(tipos).toContain('ICMS')
    expect(tipos).toContain('ISS')
  })

  it('não detecta nada se nada bate', () => {
    const txs: TxLite[] = [tx({ amount: 100, type: 'DEBIT', description: 'Compra material' })]
    const r = aggregateFromTransactions(txs, 12, PERIOD_START, PERIOD_END)
    expect(r.impostosDetectados).toHaveLength(0)
  })
})

describe('aggregateFromTransactions — edge cases', () => {
  it('array vazio → tudo zero', () => {
    const r = aggregateFromTransactions([], 12, PERIOD_START, PERIOD_END)
    expect(r.receitaTotal).toBe(0)
    expect(r.despesaTotal).toBe(0)
    expect(r.fornecedoresTop).toHaveLength(0)
    expect(r.impostosDetectados).toHaveLength(0)
  })

  it('preserva periodStart/periodEnd', () => {
    const r = aggregateFromTransactions([], 12, PERIOD_START, PERIOD_END)
    expect(r.periodStart).toBe(PERIOD_START)
    expect(r.periodEnd).toBe(PERIOD_END)
  })
})
