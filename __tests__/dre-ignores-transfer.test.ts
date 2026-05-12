// Garante que o engine DRE puro IGNORA transações com type='TRANSFER'.
// Sem isso, transferências entre contas da mesma empresa inflariam DRE
// (Yussef: 13 academias × 3-4 contas, várias transferências/mês).

import { describe, it, expect } from 'vitest'
import { calculateDRE } from '@/lib/dre/calculator'
import type {
  TransactionForDRE,
  CategoryForDRE,
  CalculateDREOptions,
} from '@/lib/dre/types'

const RECEITA_CAT: CategoryForDRE = {
  id: 'cat-rec',
  name: 'Mensalidades',
  code: '3.01.001',
  dreGroup: 'RECEITA_BRUTA',
  parentId: null,
  isActive: true,
  type: 'CREDIT',
}

const DESPESA_CAT: CategoryForDRE = {
  id: 'cat-desp',
  name: 'Folha',
  code: '4.01.001',
  dreGroup: 'DESPESAS_PESSOAL',
  parentId: null,
  isActive: true,
  type: 'DEBIT',
}

const categories = [RECEITA_CAT, DESPESA_CAT]

const period = {
  startDate: new Date('2026-05-01T00:00:00Z'),
  endDate: new Date('2026-05-31T23:59:59Z'),
  regime: 'competence' as const,
}
const options: CalculateDREOptions = { period }

function tx(
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER',
  amount: number,
  categoryId: string | null,
  id = `tx-${Math.random()}`,
): TransactionForDRE {
  return {
    id,
    type,
    amount,
    date: new Date('2026-05-15T12:00:00Z'),
    competenceDate: new Date('2026-05-15T12:00:00Z'),
    paymentDate: null,
    categoryId,
  }
}

describe('calculateDRE ignora TRANSFER (Sprint 0.5 Dia 2)', () => {
  it('TRANSFER não conta em RECEITA_BRUTA mesmo com categoryId de receita', () => {
    const transactions = [
      tx('CREDIT', 10000, RECEITA_CAT.id),
      tx('TRANSFER', 50000, RECEITA_CAT.id), // tenta inflar — deve ser ignorada
    ]
    const r = calculateDRE(transactions, categories, options)
    expect(r.totals.receitaBruta).toBe(10000)
  })

  it('TRANSFER não conta em DESPESAS_PESSOAL', () => {
    const transactions = [
      tx('DEBIT', 8000, DESPESA_CAT.id),
      tx('TRANSFER', 30000, DESPESA_CAT.id),
    ]
    const r = calculateDRE(transactions, categories, options)
    expect(r.totals.totalDespesasPessoal).toBe(8000)
  })

  it('TRANSFER sem categoryId não vai pra uncategorized', () => {
    const transactions = [
      tx('CREDIT', 5000, RECEITA_CAT.id),
      tx('TRANSFER', 1000, null), // sem categoria — não deve contar
      tx('TRANSFER', 1000, null),
    ]
    const r = calculateDRE(transactions, categories, options)
    expect(r.uncategorized.total).toBe(0)
    expect(r.uncategorized.transactionCount).toBe(0)
  })

  it('cenário realista: par de TRANSFER (saída + entrada) não infla nada', () => {
    // 13 academias scenario: transfer 20k entre 2 contas da mesma empresa
    const transactions = [
      tx('CREDIT', 50000, RECEITA_CAT.id), // receita real
      tx('TRANSFER', 20000, null, 'transfer-out'), // saída no Banrisul
      tx('TRANSFER', 20000, null, 'transfer-in'), // entrada no Sicoob
      tx('DEBIT', 30000, DESPESA_CAT.id), // despesa real
    ]
    const r = calculateDRE(transactions, categories, options)
    expect(r.totals.receitaBruta).toBe(50000)
    expect(r.totals.totalDespesasPessoal).toBe(30000)
    // Sem TRANSFER inflando: lucroBruto = receitaLiquida - custos = 50000 - 0
    // resultadoOperacional = lucroBruto - despesasPessoal = 50000 - 30000 = 20000
    expect(r.totals.resultadoOperacional).toBe(20000)
  })

  it('DRE sem TRANSFER tem mesmos totais que DRE com TRANSFER misturada', () => {
    const semTransfer = [
      tx('CREDIT', 10000, RECEITA_CAT.id),
      tx('DEBIT', 4000, DESPESA_CAT.id),
    ]
    const comTransfer = [
      ...semTransfer,
      tx('TRANSFER', 7777, RECEITA_CAT.id),
      tx('TRANSFER', 7777, DESPESA_CAT.id),
    ]
    const r1 = calculateDRE(semTransfer, categories, options)
    const r2 = calculateDRE(comTransfer, categories, options)
    expect(r2.totals.receitaBruta).toBe(r1.totals.receitaBruta)
    expect(r2.totals.totalDespesasPessoal).toBe(r1.totals.totalDespesasPessoal)
    expect(r2.totals.lucroLiquido).toBe(r1.totals.lucroLiquido)
  })

  it('metadata.transactionsProcessed conta TRANSFER no filtro de período', () => {
    // Engine filtra TRANSFER NO LOOP de agregação, mas o filtro de período
    // (filterTransactionsByPeriod) roda ANTES. Então transactionsProcessed
    // inclui as TRANSFER que estão no período (não diferencia).
    const transactions = [
      tx('CREDIT', 1000, RECEITA_CAT.id),
      tx('TRANSFER', 500, null),
    ]
    const r = calculateDRE(transactions, categories, options)
    expect(r.metadata.transactionsProcessed).toBe(2)
  })
})
