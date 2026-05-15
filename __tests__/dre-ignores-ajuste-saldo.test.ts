// Garante que o engine DRE NÃO infla com transações de Ajuste de Saldo.
// Sprint 1.5: categoria "Ajuste de Saldo" tem dreGroup='AJUSTE_SALDO', que
// está em NON_DRE_GROUPS → aparece em nonDreGroups, não em receita/despesa/lucro.

import { describe, it, expect } from 'vitest'
import { calculateDRE } from '@/lib/dre/calculator'
import { NON_DRE_GROUP_SET, NON_DRE_GROUP_LABELS } from '@/lib/dre/types'
import type {
  TransactionForDRE,
  CategoryForDRE,
  CalculateDREOptions,
} from '@/lib/dre/types'

const RECEITA: CategoryForDRE = {
  id: 'cat-rec',
  name: 'Mensalidades',
  code: '3.01',
  dreGroup: 'RECEITA_BRUTA',
  parentId: null,
  isActive: true,
  type: 'CREDIT',
}
const AJUSTE: CategoryForDRE = {
  id: 'cat-ajuste',
  name: 'Ajuste de Saldo',
  code: null,
  dreGroup: 'AJUSTE_SALDO',
  parentId: null,
  isActive: true,
  type: 'TRANSFER',
}

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
  const d = new Date('2026-05-15T12:00:00Z')
  return { id, type, amount, date: d, competenceDate: d, paymentDate: null, categoryId }
}

describe('DRE ignora AJUSTE_SALDO (Sprint 1.5)', () => {
  it('AJUSTE_SALDO está registrado como grupo NÃO-DRE', () => {
    expect(NON_DRE_GROUP_SET.has('AJUSTE_SALDO')).toBe(true)
    expect(NON_DRE_GROUP_LABELS.AJUSTE_SALDO).toBe('Ajustes Técnicos de Saldo')
  })

  it('transação de ajuste DEBIT gigante NÃO infla despesa nem reduz lucro', () => {
    const transactions = [
      tx('CREDIT', 10000, RECEITA.id),
      tx('DEBIT', 450000, AJUSTE.id), // ajuste de -450k (cenário Banrisul real)
    ]
    const r = calculateDRE(transactions, [RECEITA, AJUSTE], options)
    expect(r.totals.receitaBruta).toBe(10000)
    expect(r.totals.totalDespesasOperacionais).toBe(0) // ajuste NÃO é despesa
    expect(r.totals.totalCustos).toBe(0)
    expect(r.totals.lucroLiquido).toBe(10000) // só a receita real
  })

  it('transação de ajuste CREDIT NÃO infla receita', () => {
    const transactions = [
      tx('CREDIT', 5000, RECEITA.id),
      tx('CREDIT', 100000, AJUSTE.id), // ajuste positivo de 100k
    ]
    const r = calculateDRE(transactions, [RECEITA, AJUSTE], options)
    expect(r.totals.receitaBruta).toBe(5000) // ajuste NÃO conta como receita
  })

  it('ajuste aparece em nonDreGroups (linha informativa), não em uncategorized', () => {
    const transactions = [tx('DEBIT', 450000, AJUSTE.id, 'ajuste-1')]
    const r = calculateDRE(transactions, [RECEITA, AJUSTE], options)
    const ajusteGroup = r.nonDreGroups.find((g) => g.group === 'AJUSTE_SALDO')
    expect(ajusteGroup).toBeDefined()
    expect(ajusteGroup!.total).toBe(450000)
    expect(ajusteGroup!.transactionCount).toBe(1)
    // NÃO deve cair em uncategorized
    expect(r.uncategorized.transactionCount).toBe(0)
  })

  it('DRE com e sem ajuste tem o MESMO lucro líquido', () => {
    const semAjuste = [tx('CREDIT', 20000, RECEITA.id)]
    const comAjuste = [
      ...semAjuste,
      tx('DEBIT', 450000, AJUSTE.id),
      tx('CREDIT', 80000, AJUSTE.id),
    ]
    const r1 = calculateDRE(semAjuste, [RECEITA, AJUSTE], options)
    const r2 = calculateDRE(comAjuste, [RECEITA, AJUSTE], options)
    expect(r2.totals.lucroLiquido).toBe(r1.totals.lucroLiquido)
    expect(r2.totals.receitaBruta).toBe(r1.totals.receitaBruta)
  })
})
